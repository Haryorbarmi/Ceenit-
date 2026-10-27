import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RateService } from './billing/rate';

const monierate = (body: unknown, status = 200) => {
  const calls: { url: string; key: string }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, key: (init.headers as Record<string, string>).api_key! });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, f };
};
const good = { status: 'success', message: 'retrieved', data: { timestamp: 1793097901561, base: 'USDT', market: 'parallel', rates: 1387.3 } };

describe('naira rate from Monierate', () => {
  it('reads the USDT to NGN rate, sends the key, and asks only once an hour', async () => {
    const { calls, f } = monierate(good);
    const svc = new RateService('KEY', f);
    const a = await svc.get();
    const b = await svc.get();
    assert.deepEqual([a.ngnPerUsdt, a.source, b.ngnPerUsdt], [1387.3, 'monierate', 1387.3]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.key, 'KEY');
    assert.match(calls[0]!.url, /base=USDT&quote=NGN/);
  });

  it('falls back to the fixed rate when Monierate fails, and does not retry straight away', async () => {
    const { calls, f } = monierate({ status: 'error' }, 500);
    const svc = new RateService('KEY', f);
    assert.deepEqual([(await svc.get()).ngnPerUsdt, (await svc.get()).source], [1600, 'default']);
    assert.equal(calls.length, 1);
  });

  it('ignores nonsense rates', async () => {
    const svc = new RateService('KEY', monierate({ status: 'success', data: { rates: 2 } }).f);
    assert.equal((await svc.get()).source, 'default');
  });
});
