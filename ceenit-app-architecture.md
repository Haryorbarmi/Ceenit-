# Ceenit App Architecture

How the app is organised: who uses it, the screens, the tabs, the flows, and what each part does. Built from `ceenit-product-description.md`. Items marked **(proposed)** are my suggestions and not yet decided. See "Open decisions" at the end.

---

## 1. The three surfaces

| Surface | Who | Platform | Account needed |
|---|---|---|---|
| **Seller app** | Sellers (one user per account) | Android first, then iPhone | Yes |
| **Buyer web pages** | Buyers | Mobile-first web | No |
| **Backend** | Ceenit (invisible) | Server, database, blockchain watcher | n/a |

```
 SELLER APP ──creates invoice──▶ BACKEND ◀──watches── TRON blockchain
     ▲                              │
     │ push notification            │ serves
     │ "Paid ✅"                    ▼
     └──────────────────────  BUYER WEB PAGES
                              (payment page → receipt page)
```

---

## 2. Seller app: structure

### Bottom tabs (proposed)

```
┌──────────────────────────────────────────┐
│                                          │
│              (screen content)            │
│                                          │
├────────┬────────┬─────────┬──────────────┤
│  Home  │ History│  ＋ New │   Account    │
└────────┴────────┴─────────┴──────────────┘
```

| Tab | Purpose |
|---|---|
| **Home** | Dashboard: what is paid, what is pending, total received |
| **History** | Full transaction history, search and filters |
| **＋ New** | Create a payment link (centre button, the main action) |
| **Account** | Personal link, wallet, plan, settings |

### Full screen map

```
App
├── Onboarding and login (before entering the app, see section 3.1)
│   ├── Welcome
│   ├── Sign up or log in (phone number or email)
│   ├── Verify code (OTP)
│   ├── Your details (name, shop name, category, location)
│   ├── Choose your link name  → ceenit.app/emeka-autos
│   ├── Add TRC20 wallet address (paste or scan QR, validated)
│   ├── Confirm wallet (read-back + warning that payments go here)
│   ├── Terms and "Ceenit never holds your money" acknowledgement
│   └── Set app PIN (+ optional biometrics)
│
├── Home tab
│   ├── Dashboard
│   │   ├── Summary cards: Total received · Paid · Pending
│   │   ├── Free plan banner: "3 of 5 free transactions used"
│   │   ├── Pending invoices (live, with countdowns)
│   │   ├── Recent paid
│   │   └── Share my personal link (shortcut)
│   └── Invoice detail  (opened from any list)
│
├── History tab
│   ├── Transaction list (search, filter button)
│   ├── Filter sheet: status · date range
│   ├── Export (CSV / PDF)  [Business]
│   ├── Transaction detail (Paid) → receipt link, Tronscan proof
│   ├── Invoice detail (Pending) → share again, "cannot be cancelled" notice
│   └── Needs attention detail → late · underpaid · overpaid
│
├── ＋ New tab
│   ├── Create payment link (item, amount, expiry)
│   ├── Preview (what the buyer will see)
│   ├── Confirmation disclaimer sheet ("Before you create this link")
│   ├── Link ready (share sheet: WhatsApp first, copy link)
│   ├── QR code
│   └── Free limit reached (replaces Create after the 5th transaction)
│
├── Account tab
│   ├── My link page (preview, share, QR)
│   │   └── Edit profile (shop name, category, city, photo)
│   ├── Wallet
│   │   ├── Change wallet (new address, PIN, 24-hour wait)
│   │   └── Change pending (countdown, cancel the change)
│   ├── Plan and billing
│   │   ├── Subscribe checkout (Paystack)
│   │   ├── Subscription active
│   │   └── Manage plan (cancel subscription)
│   ├── Receipt branding (logo)   [Business]
│   ├── Sales reports             [Business]
│   ├── Notification settings
│   ├── Security (PIN, fingerprint, backup contact, devices)
│   ├── Help and support
│   └── Log out (confirmation dialog)
│
└── Notifications (bell icon on Home)
    ├── Payment confirmed · invoice expired · late payment · plan limit
    └── New link request → Link request (approve · edit amount · decline)
```

---

## 3. Seller app: screen details

### 3.1 Sign up, login and account setup

**Sign-in methods.** The seller chooses one at the start:
- **Phone number**: a 6-digit code sent by **WhatsApp**, where sellers already spend their day. It is also cheaper than SMS. If WhatsApp delivery fails, the seller can choose email instead (proposed).
- **Email**: a 6-digit code sent to the inbox.

No passwords at launch (proposed). Codes are easier for sellers, avoid forgotten passwords, and cannot be reused. The second method (email or phone) is added later in Account and is needed before the seller can change their wallet, so there is always a way to reach them.

**Sign-up flow**

```
Welcome
  │
  ├─ Continue with phone ─┐
  └─ Continue with email ─┤
                          ▼
                 Enter number / email
                          ▼
                 Enter 6-digit code  ──(wrong 5 times)──▶ locked 15 min
                          ▼
                 Your details
                          ▼
                 Choose link name (live availability check)
                          ▼
                 Add wallet ─▶ Confirm wallet
                          ▼
                 Terms + acknowledgement
                          ▼
                 Set 6-digit app PIN (+ biometrics)
                          ▼
                 Home (Free plan, 5 transactions)
```

**Information collected at sign-up**

| Info | Required | Why |
|---|---|---|
| Phone number or email (verified) | Yes | Login, alerts, account recovery |
| Full name | Yes | Account owner identity |
| Shop or business name | Yes | Shown to buyers on the payment page and receipts |
| Seller category (cars, gadgets, solar, appliances, furniture, freelancer, other) | Yes | Helps tailor the app and understand the market |
| Country and city | Yes (default Nigeria) | Naira estimate, support, future compliance |
| Link name | Yes | Becomes `ceenit.app/<name>` |
| TRC20 wallet address | Yes | Where buyers pay |
| App PIN (6 digits) | Yes | Opens the app, approves sensitive actions |
| Biometrics (fingerprint or face) | Optional | Faster than PIN |
| Agree to Terms and Privacy | Yes | Legal |
| Acknowledge "Ceenit never holds or recovers your money" | Yes | Sets expectations, protects Ceenit |
| Profile photo or shop logo | Optional | Shown on the personal link page |
| Referral code | Optional | Growth, later |
| ID verification (BVN, NIN or similar) | No, not at launch | Only for the verified seller badge later |

**Link name rules.** Lowercase letters, numbers and hyphens, 3 to 30 characters. Reserved words are blocked (`admin`, `pay`, `support`, `ceenit`). Names that imitate known brands are blocked or reviewed, to stop impersonation.

**Wallet rules.** TRON addresses only (starts with `T`, 34 characters, checksum validated). Paste or scan a QR. The confirm screen shows the address back in full with a warning: *Buyers pay straight to this address. Ceenit cannot reverse or recover payments.* A small "send a test payment" option is worth considering (proposed).

**Returning seller login**

```
Open app
  ├─ Same device, session active ──▶ PIN or biometrics ──▶ Home
  └─ New device or logged out ─────▶ phone/email ─▶ code ─▶ PIN ─▶ Home
```

- Sessions stay active on a trusted device for 30 days (proposed). The PIN or biometrics is asked every time the app opens.
- Wrong PIN 5 times: the app locks and the seller must log in again with a code.
- Code requests are rate limited (for example 5 per hour) to stop abuse and messaging cost.
- New device login sends an alert to the owner by push and the other contact method.
- **Log out all devices** is available in Account, Security.

**Forgot PIN or lost phone**
- Forgot PIN: verify with a code, then set a new PIN.
- Lost phone or changed number: verify through the other contact method (this is why the second method matters). If neither works, manual support recovery with proof of ownership (proposed).

**One user per account.** Ceenit has no staff accounts. A seller who has someone helping them sends that person the payment link (WhatsApp or QR). When the helper opens the link, they see it change to Paid the moment the payment is confirmed, so goods are handed over only when it shows.

The wallet address is the heart of the product, so changing it later is treated as a protected action (see section 7).

### 3.2 Home (Dashboard)
- Total received (USDT), plus count of paid and pending.
- Pending list with live countdown and a "waiting for payment" state.
- Recent paid, newest first.
- Free plan meter: "2 of 5 free transactions left", with an upgrade prompt.
- Shortcut to share the personal link.

### 3.3 Create payment link
| Field | Notes |
|---|---|
| Item | Free text, e.g. "Toyota Camry 2015" |
| Amount | In USDT. Ceenit adds unique cents (e.g. 8,000.37) so the payment can be matched to this invoice |
| Buyer reference | Optional (name or phone) for the seller's own records |
| Expiry | 15 min · **30 min (default)** · 2 hours · 24 hours |

Flow: create, preview, **confirmation disclaimer**, then the share sheet with WhatsApp first, copy link and show QR.

**Disclaimer before a link goes live.** When the seller taps "Create and share link", a bottom sheet titled "Before you create this link" appears with four points:
1. The link goes live right away.
2. The buyer pays straight to your wallet. Ceenit never touches the money.
3. Once live, a link cannot be cancelled. It expires on its own after the chosen time (30 minutes by default).
4. Late or wrong-amount payments are flagged for you to review.

The seller must tap "I understand, create link" to continue, or "Go back" to edit. After this, no cancel option exists anywhere in the app: the invoice detail shows the same notice instead. This protects the seller and the buyer, because a buyer may already be paying when a link is cancelled.

If the seller is on Free and has used all 5 transactions, this screen is replaced by the upgrade screen.

### 3.4 Invoice detail
Status (pending, paid, expired), amount, item, countdown if pending, buyer reference, share link again, a notice that a live link cannot be cancelled, and for paid ones the receipt link and Tronscan proof.

### 3.5 History
- Every invoice and its outcome: paid, expired, needs attention.
- Search by item or amount. Filter by date and status.
- Free plan keeps all 5 lifetime transactions visible. Paid plans keep full history.
- After cancelling a subscription, history becomes read-only and is never deleted.
- Export to CSV or PDF is a Business feature.
- **Filter sheet.** The filter button opens a bottom sheet: Status (All, Paid, Pending, Expired, Needs attention) and Date (Today, Last 7 days, Last 30 days, Custom), with Reset and "Show N results".
- **Needs attention details.** Each flagged payment shows the amounts side by side and what Ceenit did not do:
  - *Late:* Confirm payment, Match to a new link, View proof on Tronscan.
  - *Underpaid:* Accept as paid, Request the balance, View proof on Tronscan.
  - *Overpaid:* Accept as paid, Copy sender address (so any refund can be sent from the seller's own wallet, outside Ceenit), View proof on Tronscan.

**New-link request screen.** Opened from the push notification. Shows the buyer, item, the expired amount and time, how many requests were made (for example 1 of 3), and a choice of expiry for the new link. The seller can Approve and send, Edit amount, or Decline. **Edit amount** shows the old amount, takes a new amount (fresh cents are added), and reminds the seller that the new link is live and cannot be cancelled.

### 3.6 Personal link page
The permanent page at `ceenit.app/<name>`. It shows **seller details only**: shop name, logo or photo, category, city, and the verified badge (later). It has no payment function. The seller sees share and QR options for the page. Buyers get a new payment link from the seller, or through "Request a new link" on an expired payment page (see 4.3).

**Edit profile.** The seller can change shop name, category, city and photo. The **link name cannot be changed** after sign-up, so buyers can always find the seller and old links never break. This is shown on the screen.

### 3.7 Plan and billing
Shows the current plan, usage on Free, upgrade and downgrade, and billing history for the subscription itself.

Subscription screens:
1. **Subscribe (checkout):** a summary of the plan and price, then a choice of Card, Bank transfer or USSD. A note says payment happens on Paystack's secure page and Ceenit never sees card details. "Continue to Paystack" opens it.
2. **Subscription active:** confirmation with plan, amount, next payment date and the payment method, and a receipt sent by email.
3. **Manage plan:** current plan, payment method and renewal date. **Cancel subscription** keeps the plan active until the end of the paid period. After that the account is **read-only**: history stays available, but new payments are not confirmed until the seller subscribes again. "Keep my plan" is the primary button.

Details: Subscriptions are paid through **Paystack** into Ceenit's own Paystack-connected account (card, bank transfer or USSD, whichever Paystack offers). This is separate from buyer payments: buyer USDT goes to the seller's wallet, and only the seller's subscription fee goes through Paystack. If a renewal fails, the seller gets a push and email and a few days to fix it before dropping to the Free limits (proposed).

### 3.8 Wallet

Shows the wallet address in grouped blocks (to make checking easy), the network (TRON, TRC20, USDT), an Active label, and a reminder that Ceenit never holds funds or keys.

**Changing the wallet** is a protected action:
1. The seller enters the new TRC20 address.
2. They confirm with their PIN and a code sent by WhatsApp.
3. A timeline explains the next 24 hours. The new wallet starts only after 24 hours, and the seller is alerted by push and email.
4. While the change is pending, the Wallet screen shows the new address, a countdown (for example 23h 40m) and **Cancel wallet change**.
5. Links created before the new wallet starts keep the old wallet.

### 3.9 Settings screens

**Receipt branding [Business].** Upload a square PNG or JPG logo (at least 256 px). A live preview shows the receipt with the logo at the top. Every receipt still shows "Powered by ceenit" at the bottom.

**Notification settings.** Toggles, grouped by Payments, Links and Account:

| Setting | Can be turned off? |
|---|---|
| Payment confirmed | No (always on) |
| Late or wrong-amount payments | No (always on) |
| New link requests | No (always on) |
| Security alerts by email | No (always on) |
| Payment found, confirming | Yes |
| Links that expire unpaid | Yes (off by default) |
| Plan and billing reminders | Yes |

**Security and devices.**
- Change PIN, and unlock with fingerprint (on or off).
- Backup contact (the second way to reach the seller if they lose their phone). It is shown masked, with a Change action.
- Devices list: this device (active now) and other devices with last active time and a Log out action.
- **Log out of all devices.**
- A note says the seller is alerted by push and email whenever a new device logs in.

**Help and support.** A short list of common questions (how payments are confirmed, wrong amounts, why live links cannot be cancelled, changing the wallet, what happens after the 5 free transactions) and a "Chat with us on WhatsApp" button. Support hours are shown (proposed: 8am to 8pm). Terms and Privacy are linked below.

**Log out.** A confirmation dialog: open payment links keep working, but the seller gets no payment alerts until they log in again, and they will need a WhatsApp or email code.

---

## 4. Buyer web pages (no login)

### 4.1 Payment page: `ceenit.app/pay/<invoice>`
Shows, top to bottom:
1. Seller name and verified badge
2. Item
3. Exact amount in USDT with copy button
4. Naira estimate, labelled as an estimate
5. Network: **TRON (TRC20) only**
6. QR code
7. Wallet address with copy button
8. Warnings: exact amount, correct network, do not send from an exchange that adds fees (proposed)
9. Expiry countdown
10. Live status

### 4.2 Payment page states

```
 WAITING ──buyer sends──▶ DETECTED ──confirmations──▶ PAID ✅ ──▶ Receipt
    │                        │
    │ timer ends             └─ wrong amount / wrong token ─▶ NEEDS ATTENTION
    ▼
 EXPIRED ──▶ "Request a new link" ──▶ seller approves ──▶ fresh link (WAITING)
```

| State | What the buyer sees |
|---|---|
| Waiting | Payment details, countdown, "waiting for payment" |
| Detected | "Payment found, confirming…" with progress |
| Paid | Green-free confirmation (icon, weight, text), then receipt |
| Expired | "This link has expired." with a **Request a new link** button (see 4.4) |
| Needs attention | Plain explanation and the seller's contact (proposed) |

Colour note: black and white lead. Purple is the secondary colour (selected chips, focus, steps, active tab, avatars). Green means confirmed, red means error or expired, amber means needs attention. Status always keeps its icon and label as well, so it still reads without colour.

### 4.3 Expired link: request a new one

Expired links are never revived, because the unique cents and the exchange rate belong to the old invoice. Instead the buyer gets a fresh one:

```
Buyer sees "Expired" ──▶ taps "Request a new link" (optional name or phone)
        ▼
Seller gets a push: "Chidi wants a new link for Toyota Camry 2015, 8,000.37 USDT"
        ▼
Seller taps Approve (or Edit amount, or Decline)
        ▼
New invoice created: same item, new unique cents, new expiry
        ▼
Buyer's page updates automatically to the new payment details
```

- The new link has a new expiry (default 30 minutes) and a new amount with fresh unique cents.
- It counts as a new invoice in History. The expired one stays recorded as Expired and links to its replacement.
- It only counts toward the Free limit if it is paid.
- Requests are limited (for example 3 per invoice) to stop spam.
- Approval keeps the seller in control of the price.

### 4.4 Request flow on the payment page
The Request button appears only on expired links. The buyer never has to log in. If the seller does not respond, the page shows "Waiting for the seller" and the buyer can contact the seller directly.

### 4.5 Flagged payments: late, underpaid or overpaid

Ceenit marks an invoice Paid only when all six checks pass. Any payment that arrives but does not fit its invoice is **flagged for the seller** instead of being marked Paid:

| Case | What happened | Buyer's page says |
|---|---|---|
| Late | Paid after the invoice expired | "This link expired. Your payment was received and the seller has been told." |
| Underpaid | Less than the exact amount | "We received less than the amount due. The seller has been told." |
| Overpaid | More than the exact amount | "We received more than the amount due. The seller has been told." |

The late payment rules below apply to all three. For underpaid and overpaid payments the seller sees the amount due next to the amount received.

If a buyer pays an invoice after it has expired (for example the page was left open), Ceenit does not mark it Paid. It flags the payment for the seller:

- The payment is recorded as **Late payment, needs attention** in History and on the Home dashboard.
- The seller gets a push with the amount received, the buyer reference and the Tronscan proof.
- The seller decides what to do: confirm and release the goods, match it to a refreshed invoice, or sort it out with the buyer directly. Ceenit never moves the money, so any refund happens outside Ceenit.
- The buyer's old page shows: "This link expired. Your payment was received and the seller has been told."
- A flagged late payment does not count toward the Free limit until the seller confirms it (proposed).

### 4.6 Receipt page
The same link becomes a permanent receipt: seller, item, amount, date and time, status Paid, transaction ID, and a link to the proof on Tronscan. Includes "View proof on Tronscan" and "Save as PDF" buttons, and a line saying it was verified on the TRON blockchain by Ceenit and that Ceenit never holds funds.

**Business receipt.** On the Business plan the seller's logo sits at the top of the receipt in place of the small seller name, and the Ceenit wordmark moves to a small "Powered by ceenit" line.

### 4.7 Link not found
If a buyer opens a link that does not exist (mistyped or removed), the page says "We cannot find this link" and suggests checking with the seller. A note warns buyers to only pay addresses that came from the seller, and that real Ceenit links start with ceenit.app.

### 4.8 Buyer page inventory
Waiting · Payment found (confirming) · Paid · Receipt · Business receipt · Expired · Request sent · Paid after expiry · Link not found · Seller page.

---

## 5. Backend

```
┌──────────────────────────────────────────────────────────┐
│  API            accounts · invoices · plans · history    │
│  Database       sellers · wallets · invoices · txns      │
│  Chain watcher  watches each seller wallet on TRON       │
│  Verifier       runs the six checks                      │
│  Notifier       push notifications to the seller app     │
│  Billing        subscriptions, plan limits               │
└──────────────────────────────────────────────────────────┘
```

### 5.1 Invoice lifecycle

```
CREATED ─▶ PENDING ─▶ DETECTED ─▶ PAID
              │            │
              └─▶ EXPIRED  └─▶ REJECTED (failed a check)
                     └─▶ refresh requested ─▶ new invoice (CREATED)
```

Once an invoice is live (PENDING) it cannot be cancelled. It ends only by being paid or by expiring.

### 5.2 The six verification checks
A payment becomes PAID only when all six pass:
1. Official USDT contract (blocks fake tokens)
2. Landed in this seller's wallet
3. Exact amount (unique cents match this invoice)
4. Transaction marked successful
5. Confirmed on the blockchain
6. Transaction hash not used before

### 5.2a Unique cents rule

The blockchain shows only the amount, so Ceenit uses the cents as a tag to match each payment to its invoice (check 3 above).

- The cents (.01 to .99) are **added** to the price: 8,000 USDT becomes 8,000.37. The buyer pays slightly more, never less.
- Each open invoice gets a different cents value among that wallet's invoices with the same base amount. Invoices for different base amounts can reuse the same cents.
- A cents value is freed once its invoice has expired and the late-payment window has passed, or once the invoice is paid.
- This allows up to 99 open invoices of the same amount per wallet at once. If a seller reaches that, the app tells them to wait for one to clear or change the amount.

### 5.3 Main data (simplified)

| Entity | Key fields |
|---|---|
| Seller | id, name, link name, phone/email, plan, created |
| Wallet | seller, address, network, token |
| Invoice | id, seller, item, amount, unique cents, token, network, expiry, status |
| Transaction | invoice, tx hash, amount, block, confirmed at |
| Subscription | seller, plan, status, renews |

`token` and `network` are stored on every invoice now so more chains or tokens can be added later without rebuilding history.

---

## 6. Plans and feature access

| Feature | Free | Seller | Business |
|---|---|---|---|
| Confirmed transactions | 5 lifetime | Unlimited | Unlimited |
| Create payment links | Yes (until the 5 are used) | Yes | Yes |
| Personal link page | Yes | Yes | Yes |
| Push alerts | Yes (proposed) | Yes | Yes |
| Receipts | Yes | Yes | Yes, with own logo |
| Dashboard | Basic | Full | Full |
| History | Those 5 transactions | Full | Full + export |
| Sales reports | No | No | Yes |

The Free limit counts confirmed payments only, so expired or abandoned links do not use it up. After the 5th, the seller must subscribe to keep confirming payments.

---

## 7. Roles and security

Ceenit has **one user per account**: the seller. There are no staff accounts or roles.

The "someone releases goods without knowing the money is real" problem is solved without staff accounts:
- The seller gets a push notification for every confirmed payment.
- The seller sends the payment link to whoever is helping them. When the buyer pays, that same link changes to Paid, so a helper can hand over goods only once it shows.
- Only the seller can change the wallet or plan.

Protecting the wallet address (proposed):
- Changing the wallet requires PIN or biometrics plus a code sent to the seller's phone or email.
- A delay of 24 hours before the new wallet takes effect, with an alert to the owner.
- Invoices already created keep the wallet they were made with.

---

## 8. Notifications

| Event | To | Channel |
|---|---|---|
| Payment confirmed | Seller | Push |
| Payment detected, confirming | Seller | Push (proposed) |
| Invoice expired unpaid | Seller | In-app |
| Buyer requested a new link | Seller | Push |
| Late payment flagged (paid after expiry) | Seller | Push |
| Wrong amount received | Seller | Push |
| Free limit nearly used (4 of 5) | Seller | In-app |
| Subscription due or failed | Seller | Push and email |
| Wallet change requested | Seller | Push and email |
| New device login | Seller | Push and email |
| Subscription cancelled or about to end | Seller | Push and email |

Alerts for confirmed payments, late or wrong-amount payments, new link requests and security events cannot be turned off (see 3.9).

---

## 9. Open decisions

**Decided**
- Expired links are replaced by a refreshed link, requested by the buyer and approved by the seller (4.3).
- The personal link page shows seller details only (3.6).
- Sign-in is by phone number (code sent by WhatsApp) or email, then an app PIN (3.1).
- Late, underpaid and overpaid payments are flagged for the seller, not marked Paid (4.5).
- Subscriptions are paid through Paystack into Ceenit's account (3.7).
- Unique cents follow the rule in 5.2a.
- The seller approves every new-link request (4.3).
- One user per account. No staff accounts. Helpers are sent the payment link instead (section 7).
- A live payment link cannot be cancelled. A disclaimer tells the seller this before the link is created (3.3).
- English only at launch.
- The link name cannot be changed after sign-up (3.6).
- After cancelling a subscription, the account becomes read-only once the paid period ends: history stays, new payments are not confirmed (3.7).
- Security alerts, payment confirmations, late or wrong-amount alerts and link request alerts cannot be turned off (3.9).
- Wallet changes need a PIN, a WhatsApp code and a 24-hour wait, and can be cancelled while pending (3.8).

**Still open**
1. **Verified badge.** What is the verification process? It is listed under "later".

---

## 10. Suggested build order

1. Backend: invoice creation and the chain watcher with the six checks
2. Buyer payment page and receipt page (the part that proves the idea)
3. Seller app: onboarding, create link, dashboard
4. History and notifications
5. Plans, billing and the Free limit
6. Business features: logo on receipts, reports, export
7. Design in Figma alongside steps 2 to 4

---

## 11. Where each part lives in Figma

File: Ceenit, page "Design UI". Screens are 390 × 844. Components are at the top of the page.

| Figma section | What it covers | Screens |
|---|---|---|
| Components | Status bar, buttons, inputs, status chips, option chips, tab bar, top bar, transaction row, browser bar, QR code | n/a |
| 1 · Sign up and login | Welcome to "all set" (section 3.1) | 9 |
| 2 · Returning login | Log in, unlock with PIN, reset PIN | 3 |
| 3 · Home and notifications | Dashboard, new-seller home, notifications, link request | 4 |
| 4 · Create a payment link | Create, preview, disclaimer sheet, link ready, QR, free limit | 6 |
| 5 · History and invoices | History, paid, pending, late, underpaid | 5 |
| 6 · Account, wallet and plan | Account, my link page, plan and billing, wallet, change wallet, sales reports | 6 |
| 7 · Buyer web | Section 4 of this document | 10 |
| 8 · Filters, overpaid, wallet change | Filter sheet, overpaid, change pending, edit amount | 4 |
| 9 · Profile, notifications, security | Edit profile, receipt branding, notification settings, security, help, log out | 6 |
| 10 · Subscription with Paystack | Checkout, active, manage plan | 3 |

Total: 56 screens.
