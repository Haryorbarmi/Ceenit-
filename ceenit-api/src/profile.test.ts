import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from './config';
import { openDb } from './db';
import { Ctx } from './domain/context';
import { publicProfile, setLike, setPhoto } from './domain/profile';
import { registerSeller } from './domain/sellers';
import { hex20ToAddress } from './tron/address';
import { FakeTron } from './tron/fake';

let n = 900;
async function setup(plan: string, until: Date | null = null) {
  const cfg = loadConfig({ NETWORK: 'fake', NODE_ENV: 'test' } as NodeJS.ProcessEnv);
  const db = await openDb('');
  const ctx: Ctx = { db, cfg, tron: new FakeTron(cfg.usdtContract), notifier: { notify: async () => undefined }, sendCode: async () => undefined };
  const i = n++;
  const seller = (await registerSeller(ctx, {
    contact: `2348066${String(i).padStart(5, '0')}`, method: 'phone', fullName: 'Test Seller', shopName: `Shop ${i}`, category: 'Cars', city: 'Lagos',
    linkName: `shop-${i}`, wallet: hex20ToAddress(i.toString(16).padStart(40, '0')),
  }))!;
  await ctx.db.query(`update sellers set plan = $2, plan_until = $3 where id = $1`, [seller.id, plan, until]);
  return { ctx, seller: { ...seller, plan, plan_until: until } };
}
const future = () => new Date(Date.now() + 86_400_000);
const PIC = 'data:image/png;base64,iVBORw0KGgo=';

describe('seller page: photo, badge and likes', () => {
  it('free sellers get no badge, no likes and cannot change their photo', async () => {
    const { ctx, seller } = await setup('free');
    const p = await publicProfile(ctx, seller.slug);
    assert.equal(p.verified, false);
    assert.equal(p.likesEnabled, false);
    await assert.rejects(setPhoto(ctx, seller, PIC), { code: 'subscription_required' });
    await assert.rejects(setLike(ctx, seller.slug, 'visitor-0001', true), { code: 'not_found' });
  });

  it('subscribed sellers get the tick, their photo, and likes counted once per visitor', async () => {
    const { ctx, seller } = await setup('seller', future());
    await setPhoto(ctx, seller, PIC);
    assert.deepEqual(await setLike(ctx, seller.slug, 'visitor-0001', true), { likes: 1, liked: true });
    assert.deepEqual(await setLike(ctx, seller.slug, 'visitor-0001', true), { likes: 1, liked: true });
    assert.deepEqual(await setLike(ctx, seller.slug, 'visitor-0002', true), { likes: 2, liked: true });
    const p = await publicProfile(ctx, seller.slug, 'visitor-0001');
    assert.deepEqual([p.verified, p.photo, p.likes, p.liked], [true, PIC, 2, true]);
    assert.deepEqual(await setLike(ctx, seller.slug, 'visitor-0001', false), { likes: 1, liked: false });
  });

  it('rejects files that are not small images', async () => {
    const { ctx, seller } = await setup('seller', future());
    await assert.rejects(setPhoto(ctx, seller, 'data:text/html;base64,PGI+'), { code: 'invalid_photo' });
    await assert.rejects(setPhoto(ctx, seller, 'data:image/png;base64,' + 'A'.repeat(300_000)), { code: 'invalid_photo' });
  });

  it('loses the tick and hides the photo and likes when the plan runs out, but keeps the count', async () => {
    const { ctx, seller } = await setup('seller', future());
    await setPhoto(ctx, seller, PIC);
    await setLike(ctx, seller.slug, 'visitor-0001', true);
    await ctx.db.query(`update sellers set plan_until = now() - interval '1 day' where id = $1`, [seller.id]);
    const p = await publicProfile(ctx, seller.slug);
    assert.deepEqual([p.verified, p.photo, p.likesEnabled, p.likes], [false, null, false, 0]);
    await ctx.db.query(`update sellers set plan_until = now() + interval '1 day' where id = $1`, [seller.id]);
    assert.equal((await publicProfile(ctx, seller.slug)).likes, 1);
  });
});
