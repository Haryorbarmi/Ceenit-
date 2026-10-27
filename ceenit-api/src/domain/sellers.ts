import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { isUniqueViolation } from '../db';
import { isValidTronAddress } from '../tron/address';
import { AppError, Ctx } from './context';
import { newId } from './invoices';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export type Method = 'phone' | 'email';

/** Phone numbers become digits only (234…), emails are lowercased. */
export function normaliseContact(method: Method, raw: string): string {
  if (method === 'email') {
    const e = raw.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e) || e.length > 120) throw new AppError('invalid_contact', 400, 'Enter a valid email.');
    return e;
  }
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('0')) d = '234' + d.slice(1); // Nigerian local format 0801… becomes 234801…
  else if (d.length === 10) d = '234' + d;
  if (d.length < 11 || d.length > 15) throw new AppError('invalid_contact', 400, 'Enter a valid phone number.');
  return d;
}

const MAX_CODES_PER_HOUR = 5;
const MAX_WRONG_TRIES = 5;

export async function requestCode(ctx: Ctx, method: Method, rawContact: string): Promise<{ devCode?: string }> {
  const contact = normaliseContact(method, rawContact);
  const [existing] = await ctx.db.query<{ sent_count: number; window_start: Date }>(`select sent_count, window_start from otp_codes where contact = $1`, [contact]);
  const inWindow = existing && Date.now() - existing.window_start.getTime() < 3_600_000;
  if (inWindow && existing.sent_count >= MAX_CODES_PER_HOUR) throw new AppError('too_many_requests', 429, 'Too many codes requested. Try again in an hour.');

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await ctx.db.query(
    `insert into otp_codes (contact, code_hash, expires_at, attempts, sent_count, window_start)
     values ($1, $2, now() + interval '10 minutes', 0, $3, $4::timestamptz)
     on conflict (contact) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0,
       sent_count = excluded.sent_count, window_start = excluded.window_start`,
    [contact, hash(`${contact}:${code}`), inWindow ? existing.sent_count + 1 : 1, (inWindow ? existing.window_start : new Date()).toISOString()],
  );
  await ctx.sendCode(contact, method, code);
  return ctx.cfg.devReturnCode ? { devCode: code } : {};
}

export async function verifyCode(ctx: Ctx, method: Method, rawContact: string, code: string): Promise<{ token: string; hasAccount: boolean }> {
  const contact = normaliseContact(method, rawContact);
  const [row] = await ctx.db.query<{ code_hash: string; expires_at: Date; attempts: number }>(`select code_hash, expires_at, attempts from otp_codes where contact = $1`, [contact]);
  if (!row || row.expires_at.getTime() < Date.now()) throw new AppError('code_expired', 400, 'That code has expired. Request a new one.');
  if (row.attempts >= MAX_WRONG_TRIES) throw new AppError('locked', 429, 'Too many wrong tries. Request a new code.');
  if (!safeEqual(row.code_hash, hash(`${contact}:${code}`))) {
    await ctx.db.query(`update otp_codes set attempts = attempts + 1 where contact = $1`, [contact]);
    throw new AppError('wrong_code', 400, 'That code is not right.');
  }
  await ctx.db.query(`delete from otp_codes where contact = $1`, [contact]);
  const token = randomBytes(32).toString('hex');
  await ctx.db.query(`insert into sessions (token_hash, contact, expires_at) values ($1, $2, now() + interval '30 days')`, [hash(token), contact]);
  const [seller] = await ctx.db.query(`select 1 from sellers where contact = $1`, [contact]);
  return { token, hasAccount: !!seller };
}

export async function contactForToken(ctx: Ctx, token: string): Promise<string | null> {
  const [s] = await ctx.db.query<{ contact: string }>(`select contact from sessions where token_hash = $1 and expires_at > now()`, [hash(token)]);
  return s?.contact ?? null;
}

export async function logoutAll(ctx: Ctx, contact: string): Promise<void> {
  await ctx.db.query(`delete from sessions where contact = $1`, [contact]);
}

const RESERVED = ['admin', 'pay', 'support', 'ceenit', 'help', 'login', 'api', 'app', 'www', 'receipt', 'static', 'about', 'terms', 'privacy'];
const LINK_NAME = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function checkLinkName(name: string): string | null {
  if (!LINK_NAME.test(name)) return 'Use 3 to 30 lowercase letters, numbers or hyphens.';
  if (RESERVED.includes(name)) return 'That name is not available.';
  return null;
}

export async function linkNameAvailable(ctx: Ctx, name: string): Promise<boolean> {
  if (checkLinkName(name)) return false;
  const [row] = await ctx.db.query(`select 1 from sellers where slug = $1`, [name]);
  return !row;
}

export type RegisterInput = { contact: string; method: Method; fullName: string; shopName: string; category: string; city: string; linkName: string; wallet: string };

export async function registerSeller(ctx: Ctx, i: RegisterInput) {
  const nameProblem = checkLinkName(i.linkName);
  if (nameProblem) throw new AppError('invalid_link_name', 400, nameProblem);
  if (!isValidTronAddress(i.wallet)) throw new AppError('invalid_wallet', 400, 'This is not a valid TRON (TRC20) address.');
  const sellerId = newId(12);
  try {
    await ctx.db.transaction(async (tx) => {
      await tx.query(`insert into sellers (id, slug, full_name, shop_name, category, city, contact, contact_method) values ($1, $2, $3, $4, $5, $6, $7, $8)`, [sellerId, i.linkName, i.fullName.trim(), i.shopName.trim(), i.category, i.city.trim(), i.contact, i.method]);
      await tx.query(`insert into wallets (id, seller_id, address) values ($1, $2, $3)`, [newId(12), sellerId, i.wallet]);
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const [mine] = await ctx.db.query(`select 1 from sellers where contact = $1`, [i.contact]);
      throw mine ? new AppError('already_registered', 409) : new AppError('link_name_taken', 409, 'That link name is taken.');
    }
    throw e;
  }
  return getSellerByContact(ctx, i.contact);
}

export type SellerRow = { id: string; slug: string; full_name: string; shop_name: string; category: string; city: string; contact: string; contact_method: Method; plan: string; plan_until: Date | null; sub_cancelled: boolean; created_at: Date; wallet: string };

export async function getSellerByContact(ctx: Ctx, contact: string): Promise<SellerRow | null> {
  const [s] = await ctx.db.query<SellerRow>(
    `select s.id, s.slug, s.full_name, s.shop_name, s.category, s.city, s.contact, s.contact_method, s.plan, s.plan_until, s.sub_cancelled, s.created_at, w.address as wallet
       from sellers s join wallets w on w.seller_id = s.id and w.active where s.contact = $1`,
    [contact],
  );
  return s ?? null;
}
