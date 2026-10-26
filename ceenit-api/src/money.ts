// USDT has 6 decimal places. All amounts are kept as whole "micro" units in a bigint,
// so there is never a rounding error. 8,000.37 USDT is 8000370000n.

export const MICRO = 1_000_000n;

/** "8,000.5" or "8000" to micro units. Throws on anything that is not a plain positive amount with at most 6 decimals. */
export function parseUsdt(input: string): bigint {
  const s = input.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,6})?$/.test(s)) throw new Error('invalid_amount');
  const [whole, frac = ''] = s.split('.');
  const micro = BigInt(whole!) * MICRO + BigInt(frac.padEnd(6, '0'));
  if (micro <= 0n) throw new Error('invalid_amount');
  return micro;
}

/** Micro units to a plain decimal string with at least 2 decimals, e.g. 8000370000n to "8000.37". */
export function formatUsdt(micro: bigint): string {
  const whole = micro / MICRO;
  const frac = (micro % MICRO).toString().padStart(6, '0').replace(/0+$/, '').padEnd(2, '0');
  return `${whole}.${frac}`;
}

/** The unique "cents" tag (1 to 99) as micro units: 37 becomes 370000n. */
export const centsToMicro = (cents: number): bigint => BigInt(cents) * 10_000n;

/** Whole-USDT part, used to find invoices with the same base price. */
export const baseOf = (micro: bigint): bigint => micro / MICRO;
