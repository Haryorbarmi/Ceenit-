# Ceeneet

**USDT payments, confirmed.**

Ceeneet is a USDT payment-link and verification tool for sellers. A seller creates a payment link, the buyer pays USDT directly to the seller's own wallet, and Ceeneet confirms on the blockchain that the payment is real. Ceeneet never holds, receives or moves anyone's money.

---

## The problem

Sellers who accept USDT for big-ticket items (cars, gadgets, solar and appliances) deal with:

- Fake or edited payment screenshots
- Buyers sending on the wrong network and losing funds
- No way to tell which payment belongs to which customer
- Arguments over exchange rates
- Staff who can release goods without the owner knowing the money is real
- No proper receipts or records

## The solution

1. The seller signs up, adds their TRON (TRC20) wallet address, and gets a permanent personal link, e.g. `ceeneet.app/emeka-autos`.
2. For each sale, the seller creates a one-time payment link (item, amount, expiry) and shares it on WhatsApp.
3. The buyer opens the link, sees exactly what to pay (amount, network, QR code, wallet address) and pays from their own wallet. No account or download needed.
4. Ceeneet watches the blockchain, runs verification checks, and marks the invoice **Paid ✅**.
5. The same link becomes a permanent receipt with a link to the proof on Tronscan.

## Who it is for

- **Sellers (the app users):** car dealers, phone and gadget shops, solar installers, appliance and furniture sellers, freelancers, individuals selling high-value items. They sign up, pay, and use the app.
- **Buyers (web page only):** anyone, anywhere, with USDT. They click the link and pay. No signup.

## How payments are verified

Ceeneet never trusts screenshots. Every payment is checked directly against the TRON blockchain:

1. Real USDT from the official contract (blocks fake tokens)
2. Landed in this seller's wallet
3. Exact amount (each invoice carries unique cents, e.g. 8,000.37, so payments can be matched)
4. Transaction marked successful
5. Confirmed on the blockchain
6. Transaction used only once

## What we are not

Ceeneet is a payment verification and record-keeping tool. It is not a bank, exchange, wallet, escrow service, payment processor or virtual asset service provider. It never holds private keys, never receives buyer funds, and never converts USDT to naira.

## Platforms

- **Sellers:** mobile app (Android first, then iPhone), with push notifications for confirmed payments
- **Buyers:** mobile-first web payment page and receipt page
- **Backend:** shared database and blockchain watcher

## Revenue

Monthly subscriptions paid by sellers (no cut taken from sales):

| Plan | Price | Includes |
|---|---|---|
| Free | ₦0 | 5 confirmed transactions in total (lifetime), history of those 5 transactions kept permanently |
| Seller | ₦5,000/month | Unlimited links, alerts, receipts, dashboard, full transaction history |
| Business | ₦15,000/month | Own logo on receipts, sales reports, history export (CSV/PDF) |

The Free plan limit counts confirmed (paid) transactions, not links created, so expired or abandoned links do not use up the allowance. The 5 is a lifetime allowance and does not reset; once used, the seller must subscribe to keep confirming payments. After a subscription is cancelled, the seller keeps read-only access to their transaction history.

Later: verified seller badge, prepaid credits, per-payment fees.

## Transaction history

Every verified payment becomes a permanent record. Each entry holds:

- Invoice details (item, amount, optional buyer reference)
- Status (paid, expired, pending)
- Timestamp and Tronscan transaction hash

Sellers can filter by date or status, and search by item or amount. Business sellers can export history to CSV or PDF. Free sellers always see all of their 5 lifetime transactions. Records are never deleted when a seller cancels; they become read-only.

## Supported currency and network

Launch supports **USDT on TRON (TRC20) only**. This keeps verification simple and avoids wrong-network mistakes. The data model stores a token and network on every invoice so more can be added later without rebuilding history. Possible order of expansion: USDT on BSC or Polygon, then USDC, then other tokens only on seller demand. The UI shows TRC20 only for now.

## Buyer payment page

Shows: seller name and verified badge, item, exact amount with copy button, naira estimate (labelled as estimate), network (TRON TRC20 only), QR code, wallet address with copy button, warnings, expiry countdown and live "waiting for payment" status. Link default expiry is 30 minutes, with options of 15 minutes, 2 hours and 24 hours, plus a grace period for late payments.

## Core app screens (sellers)

1. Signup and wallet address
2. Dashboard (paid, pending, total received)
3. Create payment link
4. Transaction history
5. Personal link page
6. Payment page (buyer view, web)
7. Paid receipt page (web)

## Brand

- **Name:** Ceeneet (from "seen it")
- **Tagline:** USDT payments, confirmed.
- **Colour:** black and white lead, with purple as the secondary colour for active parts. Green means confirmed, red means error or expired, amber means needs attention
- **Headings:** Helvena
- **Body:** Inter

## Status

Planning and design. Next step: brand identity and design system in Figma, then seller app screens, then buyer web pages.

## Product rules (decided)

- **One user per account.** There are no staff accounts. A seller who has helpers sends them the payment link; when the buyer pays, the link changes to Paid, so helpers hand over goods only once it shows.
- **Seller approves new links.** When a payment link expires, the buyer can request a new one and the seller approves it.
- **Live links cannot be cancelled.** A disclaimer before a link is created explains this, and what happens next. A link ends only by being paid or by expiring.
- **Late, underpaid and overpaid payments** are flagged for the seller, not marked Paid.
- **English only** at launch.
