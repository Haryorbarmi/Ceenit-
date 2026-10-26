# Ceenit: Accounts and Services Checklist

Everything Ceenit needs outside the code to run for real. Tick each box as you go.

**Rule for all keys:** never paste a password or secret key into a chat. Put it in the host's "environment variables" screen, or give it to me through a local `.env` file that stays out of the project files. For Expo, use an access token instead of your password.

---

## Start now (free, fast)

### [ ] 1. TronGrid API key
- **Why:** The watcher reads the TRON blockchain through TronGrid. Without a key it hits rate limits (it did in my test) and payments could be detected late.
- **Where:** trongrid.io (free tier)
- **Cost:** Free to start
- **You give me:** The API key (`TRONGRID_API_KEY`)

### [ ] 2. Postgres database
- **Why:** Stores sellers, links, payments and history. The test version keeps data in memory on your Mac, so it can't be used for real sellers.
- **Where:** Neon, Supabase, or Railway Postgres (pick managed, with backups)
- **Cost:** Free tier for testing, then a few dollars a month
- **You give me:** The connection string (`DATABASE_URL`)
- **I do:** Switch `ceenit-api/src/db/index.ts` from the test database to `pg`

### [ ] 3. API + watcher host
- **Why:** The API and the blockchain watcher must run all the time, as exactly one instance. Serverless hosting won't work, because the watcher can't sleep.
- **Where:** Railway, Render, Fly.io, or a small VPS
- **Cost:** Roughly $5–10 a month
- **You give me:** An account on one of them
- **I do:** Write the deploy config

### [ ] 4. Domain name
- **Why:** Buyers need a real link (`ceenit.app/pay/...`), and the app needs an API address (for example `api.ceenit.app`).
- **Where:** Any registrar
- **Cost:** About $10–20 a year
- **You decide:** Which domain. Check that `ceenit.app` is available.

### [ ] 5. Buyer web hosting
- **Why:** Serves the payment pages to buyers.
- **Where:** Vercel (easiest for Next.js), or the same host as the API
- **Cost:** Free tier is enough to start
- **You give me:** An account, and the domain from step 4

---

## Start early (slow approvals)

### [ ] 6. WhatsApp login codes
- **Why:** You chose WhatsApp codes for sign-in. Meta must approve the business and the message template, which can take days.
- **Where:** Meta WhatsApp Business Cloud API, or a middleman such as Termii or Twilio
- **Cost:** Per-message fees
- **You need:**
  - A Meta Business account
  - A dedicated phone number that is not already on WhatsApp
  - An approved "authentication" message template
- **You give me:** The access token, phone number ID and template name

### [ ] 7. Email (fallback for login codes)
- **Why:** Backup for sellers who don't get the WhatsApp code.
- **Where:** Resend or Postmark
- **Cost:** Free tier is enough to start
- **You give me:** The API key, plus a sending address on your domain (for example `no-reply@ceenit.app`)

---

## Needed before launch

### [ ] 8. Paystack
- **Why:** Takes the monthly subscription for the paid plan.
- **Where:** paystack.com
- **Cost:** Paystack's transaction fee
- **You need:** A live-mode account (usually needs your business details), and the subscription plans created once prices are set
- **You give me:** The secret key and the plan codes
- **I do:** Build the subscription flow and the webhook

### [ ] 9. Apple Developer account
- **Why:** Required to put the app on iPhones beyond Expo Go (TestFlight and the App Store).
- **Cost:** About $99 a year
- **You give me:** Access to the account when we are ready to build

### [ ] 10. Google Play Developer account
- **Why:** Required to publish on Android.
- **Cost:** About $25 once
- **You give me:** Access when we are ready to build

### [ ] 11. Push notifications
- **Why:** "Payment received" and "link request" alerts on the seller's phone.
- **Where:** Expo Push
- **Cost:** Free
- **You give me:** Nothing extra. Your Expo account covers it.

---

## Recommended

### [ ] 12. Error monitoring
- **Why:** Tells you when the API or watcher breaks, before sellers do.
- **Where:** Sentry (free tier)

### [ ] 13. Database backups
- **Why:** Payment history is the product's record. Losing it would be serious.
- **Where:** Usually included with managed Postgres. Confirm it is switched on.

### [ ] 14. Test wallet for the Nile test network
- **Why:** Lets me test with real blockchain transactions without real money.
- **You need:** Create a new test wallet and send me its **public address only**. Get free test TRX and test USDT from the Nile faucet.
- **Never share:** A private key or seed phrase, especially from a wallet that holds real money.

---

## Suggested order

1. **Today:** Open TronGrid, Neon and Railway/Render accounts (items 1–3). Start the Meta WhatsApp Business application (item 6). Choose a domain (item 4).
2. **Then I can:** Deploy the API and web page so everything runs without your Mac, and run the Nile test.
3. **After the app is connected:** Paystack, Apple, Google, email and monitoring (items 7–13).

## What I build in parallel
Connect the mobile app to the API, switch to Postgres, add code delivery and push, then the Paystack subscriptions and wallet-change flow (PIN, code, 24-hour wait).
