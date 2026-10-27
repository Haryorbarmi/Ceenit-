// Creates the Seller and Business monthly plans in your Paystack account (once), and saves their codes in .env.
// Run: npm run paystack:setup
import { readFileSync, writeFileSync } from 'node:fs';
import { Paystack } from '../src/billing/paystack';
import { loadConfig } from '../src/config';
import { PLAN_NAMES, PLAN_PRICES, PlanKey } from '../src/domain/billing';

const cfg = loadConfig();
if (!cfg.paystackSecret) throw new Error('Put your Paystack secret key in .env as PAYSTACK_SECRET_KEY first.');
if (!cfg.paystackSecret.startsWith('sk_test_')) throw new Error('This key is not a TEST key (it should start with sk_test_). Refusing to create plans with it.');

const paystack = new Paystack(cfg.paystackSecret);
let env = readFileSync('.env', 'utf8');

for (const plan of ['seller', 'business'] as PlanKey[]) {
  const key = `PAYSTACK_PLAN_${plan.toUpperCase()}`;
  if (cfg.planCodes[plan]) {
    console.log(`${PLAN_NAMES[plan]}: already set (${cfg.planCodes[plan]})`);
    continue;
  }
  const created = await paystack.createPlan(`Ceeneet ${PLAN_NAMES[plan]} (monthly)`, PLAN_PRICES[plan]);
  const line = `${key}=${created.plan_code}`;
  env = new RegExp(`^${key}=.*$`, 'm').test(env) ? env.replace(new RegExp(`^${key}=.*$`, 'm'), line) : `${env.trimEnd()}\n${line}\n`;
  console.log(`${PLAN_NAMES[plan]}: created ${created.plan_code} at ₦${PLAN_PRICES[plan] / 100}/month`);
}
writeFileSync('.env', env);
console.log('Saved to .env. Restart the API to use them.');
