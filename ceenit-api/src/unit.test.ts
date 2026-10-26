import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classify, InvoiceLite } from './domain/match';
import { formatUsdt, parseUsdt } from './money';
import { addressToHex20, hex20ToAddress, isValidTronAddress } from './tron/address';

const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

describe('money', () => {
  it('parses and formats without rounding', () => {
    assert.equal(parseUsdt('8000.37'), 8_000_370_000n);
    assert.equal(parseUsdt('8,000'), 8_000_000_000n);
    assert.equal(parseUsdt('0.000001'), 1n);
    assert.equal(formatUsdt(8_000_370_000n), '8000.37');
    assert.equal(formatUsdt(8_000_000_000n), '8000.00');
    assert.equal(formatUsdt(1_250_180_000n), '1250.18');
  });
  it('rejects bad amounts', () => {
    for (const bad of ['', '0', '-5', '1.1234567', 'abc', '1e6', '1..2', '0.0']) assert.throws(() => parseUsdt(bad), /invalid_amount/, bad);
  });
});

describe('TRON addresses', () => {
  it('accepts the real USDT contract address', () => assert.equal(isValidTronAddress(USDT_CONTRACT), true));
  it('rejects a mistyped address (checksum)', () => {
    const typo = USDT_CONTRACT.slice(0, 10) + (USDT_CONTRACT[10] === 'a' ? 'b' : 'a') + USDT_CONTRACT.slice(11);
    assert.equal(isValidTronAddress(typo), false);
  });
  it('rejects wrong shapes', () => {
    for (const bad of ['', 'TR7NHq', '0x' + 'a'.repeat(40), 'B' + USDT_CONTRACT.slice(1), USDT_CONTRACT + 'x']) assert.equal(isValidTronAddress(bad), false, bad);
  });
  it('round-trips between text and hex', () => {
    assert.equal(addressToHex20(USDT_CONTRACT), 'a614f803b6fd780986a42c78ec9c7f77e6ded13c');
    assert.equal(hex20ToAddress('a614f803b6fd780986a42c78ec9c7f77e6ded13c'), USDT_CONTRACT);
  });
});

describe('matching a payment to an invoice', () => {
  const now = Date.now();
  const inv = (id: string, amountMicro: bigint, o: Partial<InvoiceLite> = {}): InvoiceLite => ({ id, status: 'pending', amountMicro, createdAtMs: now - 60_000, expiresAtMs: now + 600_000, ...o });
  const day = 86_400_000;

  it('exact amount on an open link is a clean payment', () => {
    assert.deepEqual(classify({ receivedMicro: 8_000_370_000n, atMs: now, invoices: [inv('a', 8_000_370_000n)], lateWindowMs: day }), { kind: 'paid', invoiceId: 'a' });
  });
  it('picks the right link when several are open', () => {
    const invoices = [inv('a', 8_000_370_000n), inv('b', 8_000_520_000n)];
    assert.deepEqual(classify({ receivedMicro: 8_000_520_000n, atMs: now, invoices, lateWindowMs: day }), { kind: 'paid', invoiceId: 'b' });
  });
  it('exact amount after expiry is late, not paid', () => {
    const i = inv('a', 8_000_370_000n, { status: 'expired', expiresAtMs: now - 180_000 });
    assert.deepEqual(classify({ receivedMicro: 8_000_370_000n, atMs: now, invoices: [i], lateWindowMs: day }), { kind: 'late', invoiceId: 'a' });
  });
  it('exact amount long after expiry is unmatched', () => {
    const i = inv('a', 8_000_370_000n, { status: 'expired', expiresAtMs: now - 3 * day });
    assert.deepEqual(classify({ receivedMicro: 8_000_370_000n, atMs: now, invoices: [i], lateWindowMs: day }), { kind: 'unmatched' });
  });
  it('wrong amount with one open link is flagged under or over', () => {
    const invoices = [inv('a', 1_250_180_000n)];
    assert.deepEqual(classify({ receivedMicro: 1_200_000_000n, atMs: now, invoices, lateWindowMs: day }), { kind: 'underpaid', invoiceId: 'a' });
    assert.deepEqual(classify({ receivedMicro: 1_300_000_000n, atMs: now, invoices, lateWindowMs: day }), { kind: 'overpaid', invoiceId: 'a' });
  });
  it('wrong amount with several open links uses the whole-USDT price, else is unmatched', () => {
    const invoices = [inv('a', 1_250_180_000n), inv('b', 640_510_000n)];
    assert.deepEqual(classify({ receivedMicro: 1_250_000_000n, atMs: now, invoices, lateWindowMs: day }), { kind: 'underpaid', invoiceId: 'a' });
    assert.deepEqual(classify({ receivedMicro: 99_000_000n, atMs: now, invoices, lateWindowMs: day }), { kind: 'unmatched' });
  });
  it('a payment made before the link existed does not match it', () => {
    const i = inv('a', 8_000_370_000n, { createdAtMs: now + 1000 });
    assert.deepEqual(classify({ receivedMicro: 8_000_370_000n, atMs: now, invoices: [i], lateWindowMs: day }), { kind: 'unmatched' });
  });
  it('a link already being confirmed is not matched twice', () => {
    const i = inv('a', 8_000_370_000n, { status: 'confirming' });
    assert.deepEqual(classify({ receivedMicro: 8_000_370_000n, atMs: now, invoices: [i], lateWindowMs: day }), { kind: 'unmatched' });
  });
});
