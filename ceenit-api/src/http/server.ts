import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError, Ctx } from '../domain/context';
import { createInvoice, getSellerInvoice, listInvoices, paidCount, toSellerView } from '../domain/invoices';
import { approveRequest, declineRequest, listRequests, publicInvoice, requestNewLink, resolvePayment } from '../domain/links';
import { contactForToken, getSellerByContact, linkNameAvailable, logoutAll, registerSeller, requestCode, verifyCode } from '../domain/sellers';
import { formatUsdt, parseUsdt } from '../money';
import { hex20ToAddress, isValidTronAddress } from '../tron/address';
import type { FakeTron } from '../tron/fake';

const method = z.enum(['phone', 'email']);

export function buildServer(ctx: Ctx, opts: { fake?: FakeTron } = {}) {
  const app = Fastify({ logger: false, bodyLimit: 20_000 });
  const { cfg } = ctx;

  // CORS: the buyer web page and the app call this API from other origins.
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (cfg.corsOrigin === '*' || (origin && cfg.corsOrigin.split(',').includes(origin))) {
      reply.header('Access-Control-Allow-Origin', cfg.corsOrigin === '*' ? '*' : origin);
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      reply.header('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') return reply.code(204).send();
  });

  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof AppError) return reply.code(err.status).send({ error: err.code, message: err.message });
    if (err instanceof z.ZodError) return reply.code(400).send({ error: 'bad_request', message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ error: 'bad_request', message: e.message });
    console.error('[http] unexpected error:', err);
    return reply.code(500).send({ error: 'server_error', message: 'Something went wrong.' });
  });

  /** Reads the Bearer token and returns the seller's contact. Throws 401 if missing or expired. */
  async function contactOf(req: FastifyRequest): Promise<string> {
    const m = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '');
    const contact = m ? await contactForToken(ctx, m[1]!) : null;
    if (!contact) throw new AppError('unauthorised', 401, 'Please log in.');
    return contact;
  }
  async function sellerOf(req: FastifyRequest) {
    const seller = await getSellerByContact(ctx, await contactOf(req));
    if (!seller) throw new AppError('no_account', 403, 'Finish setting up your account first.');
    return seller;
  }

  app.get('/health', async () => ({ ok: true, network: cfg.network }));

  // ---------- Public: the buyer's pages ----------
  app.get('/v1/public/invoices/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().min(4).max(20) }).parse(req.params);
    reply.header('Cache-Control', 'no-store');
    return publicInvoice(ctx, id);
  });

  app.post('/v1/public/invoices/:id/request-new-link', async (req) => {
    const { id } = z.object({ id: z.string().min(4).max(20) }).parse(req.params);
    const body = z.object({ buyerName: z.string().max(80).default('') }).parse(req.body ?? {});
    await requestNewLink(ctx, id, body.buyerName);
    return publicInvoice(ctx, id);
  });

  app.get('/v1/public/sellers/:slug', async (req) => {
    const { slug } = z.object({ slug: z.string().max(40) }).parse(req.params);
    const [s] = await ctx.db.query<{ slug: string; shop_name: string; category: string; city: string; created_at: Date }>(
      `select slug, shop_name, category, city, created_at from sellers where slug = $1`,
      [slug],
    );
    if (!s) throw new AppError('not_found', 404);
    return { slug: s.slug, name: s.shop_name, category: s.category, city: s.city, since: s.created_at.toLocaleString('en-GB', { month: 'long', year: 'numeric' }) };
  });

  app.get('/v1/link-names/:name', async (req) => {
    const { name } = z.object({ name: z.string().max(40) }).parse(req.params);
    return { name, available: await linkNameAvailable(ctx, name) };
  });

  // Lets the app check a wallet address (including its built-in checksum) before sign up reaches the last step.
  app.get('/v1/wallets/:address/check', async (req) => {
    const { address } = z.object({ address: z.string().max(60) }).parse(req.params);
    return { valid: isValidTronAddress(address) };
  });

  // ---------- Login ----------
  app.post('/v1/auth/request-code', async (req) => {
    const b = z.object({ method, contact: z.string().min(5).max(120) }).parse(req.body);
    const r = await requestCode(ctx, b.method, b.contact);
    return { sent: true, ...r };
  });

  app.post('/v1/auth/verify-code', async (req) => {
    const b = z.object({ method, contact: z.string().min(5).max(120), code: z.string().regex(/^\d{6}$/) }).parse(req.body);
    return verifyCode(ctx, b.method, b.contact, b.code);
  });

  app.post('/v1/auth/logout-all', async (req) => {
    await logoutAll(ctx, await contactOf(req));
    return { ok: true };
  });

  // ---------- Seller account ----------
  app.post('/v1/sellers', async (req, reply) => {
    const contact = await contactOf(req);
    const b = z
      .object({
        method,
        fullName: z.string().min(2).max(80),
        shopName: z.string().min(2).max(80),
        category: z.string().min(2).max(30),
        city: z.string().min(2).max(60),
        linkName: z.string().min(3).max(30),
        wallet: z.string().length(34),
      })
      .parse(req.body);
    const seller = await registerSeller(ctx, { ...b, contact });
    return reply.code(201).send(await meView(seller!));
  });

  async function meView(s: NonNullable<Awaited<ReturnType<typeof getSellerByContact>>>) {
    return {
      id: s.id,
      slug: s.slug,
      shopName: s.shop_name,
      fullName: s.full_name,
      category: s.category,
      city: s.city,
      contact: s.contact,
      plan: s.plan,
      wallet: s.wallet,
      link: `${cfg.publicBaseUrl}/${s.slug}`,
      freeUsed: await paidCount(ctx, s.id),
      freeTotal: cfg.freeTransactions,
    };
  }

  app.get('/v1/me', async (req) => meView(await sellerOf(req)));

  // ---------- Seller: payment links ----------
  app.post('/v1/invoices', async (req, reply) => {
    const seller = await sellerOf(req);
    const b = z
      .object({
        item: z.string().min(2).max(120),
        amount: z.string().max(20),
        reference: z.string().max(80).optional(),
        expiryMinutes: z.number().int(),
        acknowledgedNoCancel: z.boolean(),
      })
      .parse(req.body);
    const row = await createInvoice(ctx, { sellerId: seller.id, item: b.item, amount: b.amount, reference: b.reference, expiryMinutes: b.expiryMinutes, ack: b.acknowledgedNoCancel });
    return reply.code(201).send(toSellerView(row, cfg.publicBaseUrl));
  });

  app.get('/v1/invoices', async (req) => {
    const seller = await sellerOf(req);
    return (await listInvoices(ctx, seller.id)).map((r) => toSellerView(r, cfg.publicBaseUrl));
  });

  app.get('/v1/invoices/:id', async (req) => {
    const seller = await sellerOf(req);
    const { id } = z.object({ id: z.string().max(20) }).parse(req.params);
    const row = await getSellerInvoice(ctx, seller.id, id);
    const payments = await ctx.db.query<{ tx_id: string; outcome: string; amount_micro: string; confirmations: number; confirmed: boolean; success: boolean | null; checks: unknown; resolved: boolean; block_time: Date }>(
      `select tx_id, outcome, amount_micro::text as amount_micro, confirmations, confirmed, success, checks, resolved, block_time from payments where invoice_id = $1 order by created_at`,
      [id],
    );
    return {
      ...toSellerView(row, cfg.publicBaseUrl),
      payments: payments.map((p) => ({ txId: p.tx_id, outcome: p.outcome, amount: formatUsdt(BigInt(p.amount_micro)), confirmations: p.confirmations, confirmed: p.confirmed, success: p.success, checks: p.checks, resolved: p.resolved, at: p.block_time.toISOString() })),
    };
  });

  app.post('/v1/payments/:txId/resolve', async (req) => {
    const seller = await sellerOf(req);
    const { txId } = z.object({ txId: z.string().regex(/^[0-9a-f]{64}$/) }).parse(req.params);
    await resolvePayment(ctx, seller.id, txId);
    return { ok: true };
  });

  // ---------- Seller: new-link requests from buyers ----------
  app.get('/v1/link-requests', async (req) => {
    const seller = await sellerOf(req);
    return (await listRequests(ctx, seller.id)).map((q) => ({ id: q.id, invoiceId: q.invoice_id, buyerName: q.buyer_name, item: q.item, previousAmount: formatUsdt(BigInt(q.old_amount)), requestsMade: q.request_count, at: q.created_at.toISOString() }));
  });

  app.post('/v1/link-requests/:id/approve', async (req) => {
    const seller = await sellerOf(req);
    const { id } = z.object({ id: z.string().max(20) }).parse(req.params);
    const b = z.object({ amount: z.string().max(20).optional(), expiryMinutes: z.number().int().optional() }).parse(req.body ?? {});
    if (b.amount) parseUsdt(b.amount);
    return toSellerView(await approveRequest(ctx, seller.id, id, b), cfg.publicBaseUrl);
  });

  app.post('/v1/link-requests/:id/decline', async (req) => {
    const seller = await sellerOf(req);
    const { id } = z.object({ id: z.string().max(20) }).parse(req.params);
    await declineRequest(ctx, seller.id, id);
    return { ok: true };
  });

  // ---------- Development only: pretend to be a buyer paying, and pretend time passes on TRON ----------
  if (opts.fake && process.env.NODE_ENV !== 'production') {
    const fake = opts.fake;
    app.post('/dev/simulate-payment', async (req) => {
      const b = z.object({ to: z.string().length(34), amount: z.string(), from: z.string().length(34).optional(), fakeToken: z.boolean().optional(), fail: z.boolean().optional() }).parse(req.body);
      const txId = fake.sendUsdt({
        from: b.from ?? 'TQn9Y2khDGZMt1r4pYvMwiJ3sdd5AU2gXc',
        to: b.to,
        amountMicro: parseUsdt(b.amount),
        contract: b.fakeToken ? 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj' : undefined,
        success: b.fail ? false : true,
      });
      return { txId };
    });
    // A ready-made seller so the buyer page can be tried without going through sign up.
    const demoSeller = async () => {
      const contact = '2348000000000';
      let seller = await getSellerByContact(ctx, contact);
      if (!seller) {
        seller = await registerSeller(ctx, { contact, method: 'phone', fullName: 'Emeka Okafor', shopName: 'Emeka Autos', category: 'Cars', city: 'Lagos, Nigeria', linkName: 'emeka-autos', wallet: hex20ToAddress('d330000000000000000000000000000000000001') });
        await ctx.db.query(`update sellers set plan = 'seller' where id = $1`, [seller!.id]); // no free-plan limit for the demo seller
      }
      return seller!;
    };
    app.post('/dev/demo-invoice', async (req) => {
      const b = z.object({ amount: z.string().default('8000'), item: z.string().default('Toyota Camry 2015') }).parse(req.body ?? {});
      const seller = await demoSeller();
      const row = await createInvoice(ctx, { sellerId: seller.id, item: b.item, amount: b.amount, expiryMinutes: 30, ack: true });
      return { id: row.id, amount: formatUsdt(BigInt(row.amount_micro)), wallet: seller.wallet };
    });
    app.post('/dev/expire/:id', async (req) => {
      const { id } = z.object({ id: z.string().max(20) }).parse(req.params);
      await ctx.db.query(`update invoices set status = 'expired', expires_at = now() - interval '1 minute', created_at = least(created_at, now() - interval '31 minutes') where id = $1 and status = 'pending'`, [id]);
      return { ok: true };
    });
    app.post('/dev/approve-request/:id', async (req) => {
      const { id } = z.object({ id: z.string().max(20) }).parse(req.params);
      const [q] = await ctx.db.query<{ id: string; seller_id: string }>(`select q.id, i.seller_id from link_requests q join invoices i on i.id = q.invoice_id where q.invoice_id = $1 and q.status = 'pending'`, [id]);
      if (!q) throw new AppError('no_pending_request', 404);
      const fresh = await approveRequest(ctx, q.seller_id, q.id, {});
      return { id: fresh.id };
    });
    app.post('/dev/mine', async (req) => {
      const b = z.object({ blocks: z.number().int().min(1).max(200).default(20) }).parse(req.body ?? {});
      fake.mine(b.blocks);
      return fake.blocks;
    });
  }

  return app;
}

export type { FastifyReply };
