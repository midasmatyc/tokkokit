# Product Requirements Document
## TokkoKit — WhatsApp & Social Commerce Seller Toolkit

*Working title: **TokkoKit**.*

**Doc status:** v1.1 — ready for build
**Owner:** Ed
**Platform:** Web (PWA), client-side app data + minimal Supabase backend for license/tier validation only

---

## 1. Executive Summary

TokkoKit is a zero-installation, privacy-first web toolkit for solo and small-team sellers who run their business through WhatsApp, Instagram DMs, and Facebook Marketplace. It replaces the current workflow — hand-typing invoices inside chat threads, tracking orders in Notes apps or notebooks, and re-typing the same closing messages every day — with four focused tools: an invoice generator, a chat template vault, a lightweight CRM/order tracker, and a shipping cost estimator.

Every piece of *shop* data — invoices, customers, templates, order status — lives only in the seller's own `localStorage` and never touches a server. The one exception is Pro-tier license validation, which uses a minimal Supabase table (see §8) purely to check "is this key active" — no shop, customer, or invoice data is ever sent there. This keeps the core privacy pitch honest and specific: "your business data never leaves your phone; only your license key is checked online." It installs like an app via "Add to Home Screen," requires no app-store sign-up, and every module except the one-time license check works fully offline.

**Positioning statement:** *The fastest way for a WhatsApp seller to send a professional invoice and keep track of who's paid — with nothing to install and nothing sent to a server.*

---

## 2. Problem Statement & Target User

### The problem
Sellers running a shop entirely through chat apps currently:
- Type item lists and totals manually inside WhatsApp, with inconsistent formatting and frequent math errors.
- Re-type the same closing scripts, payment reminders, and shipping notices dozens of times a day.
- Track "who paid, who hasn't shipped yet" using scrollback through chat history, a paper notebook, or a Notes app list that gets messy fast.
- Have no easy way to estimate shipping cost without opening a separate courier app or website.

### Primary persona — "Ibu Sari"
- Solo reseller of women's fashion items, sells via WhatsApp Business + Instagram.
- Uses a mid-range Android phone; data plan is metered, so she cares about load speed and offline reliability.
- Comfortable with WhatsApp, Instagram, and basic typing; not comfortable with anything resembling "installing software" or creating yet another account/password.
- Processes 5–30 orders a day, mostly evenings after school pickup.
- Price-sensitive: needs to see clear value before paying for either tier, so onboarding must justify the cost fast — there is no free version to fall back on if she hesitates.

### Secondary persona — "Bang Rudi"
- Runs a small team (himself + 1 packer) selling household goods via Facebook Marketplace and WhatsApp groups.
- Higher order volume; cares more about order-status tracking and repeat-customer templates than Ibu Sari does.
- Prints physical receipts on a cheap 58mm thermal printer for the packer to attach to parcels.

---

## 3. Goals & Success Metrics

| Goal | Metric | Target |
|---|---|---|
| Fast first invoice | Time from first app open to first copied WhatsApp invoice | < 60 seconds, no tutorial required |
| Reliable, no data loss | Data survives page refresh / app close-reopen | 100% (autosave on every field change) |
| Installable, app-like | Lighthouse PWA score | ≥ 90 |
| Works with poor connectivity | Core modules (Invoice, Templates, CRM) usable fully offline after first load | Yes |
| Basic tier converts | Install-to-activation rate for a purchased Basic license | Directional target, tracked qualitatively (no analytics server — see §11) |
| Pro tier upsell | Basic → Pro upgrade rate among sellers who create 10+ invoices | Directional target, revisited post-launch |

---

## 4. Information Architecture & Navigation

Single app shell, four primary destinations plus Settings, sitting behind a first-launch **activation flow**: since both current tiers are paid (see §8), a seller must activate a valid Basic or Pro license before any module is usable — there is no anonymous/free-use path yet (a time-limited free tier is planned for later, see §12). The app itself is never downloaded or installed as a package — it's a live, server-hosted web page the whole time; "installing" it only creates a home-screen shortcut that reopens that same hosted page (see §9 for why this doesn't protect the source code from being viewed). Mobile uses a bottom tab bar (thumb-reachable) once activated; desktop mirrors the same four items in a left sidebar. No nested navigation deeper than two levels anywhere in the app.

**Activation flow:** purchase happens outside the app (handled elsewhere, out of scope for this PRD). After purchase, the seller receives a unique link containing their license key, e.g. `https://tokkokit.app/aktivasi?key=XXXX-XXXX`. Opening that link on their phone triggers automatic validation against Supabase (§6/§8) — no manual typing required for the common case. A manual "Masukkan kode lisensi" (enter license key) field remains available as a fallback for re-activating on a second device or if the link is lost.

```
Seller opens purchase link (key embedded in URL)
        ↓
┌─────────────────────────────┐
│         TokkoKit               │
│   Memvalidasi lisensi...       │
└─────────────────────────────┘
        ↓ (key validated via Supabase)
┌─────────────────────────────┐
│   Lisensi aktif! 🎉             │
│   Tambahkan ke Layar Utama      │
│   biar bisa dibuka 1-tap.       │
│   [ + Tambah ke Layar Utama ]   │
│   [ Lewati untuk sekarang ]     │
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│   TokkoKit  [Shop Name]  ⚙   │  ← header: shop name + settings gear
├─────────────────────────────┤
│                               │
│      [ Active view ]         │
│                               │
├─────────────────────────────┤
│  🧾      💬      📦      🚚   │  ← bottom tab bar (mobile)
│ Nota   Template  Orders  Ongkir│
└─────────────────────────────┘
```

- **🧾 Nota (Invoice)** → Module 1
- **💬 Template** → Module 2
- **📦 Orders (CRM)** → Module 3
- **🚚 Ongkir (Shipping)** → Module 4
- **⚙ Settings** (header icon, not a tab) → shop profile, tax/shipping defaults, payment destination bank accounts, thank-you message, tier/license, export/import backup

---

## 5. Technical Architecture

### Stack (fixed, no substitutions)
- **Structure:** single `index.html` with JS-driven view switching (no page reloads, no router library)
- **Styling:** Tailwind CSS via CDN (`<script src="https://cdn.tailwindcss.com">`), no build step
- **Logic:** Vanilla JavaScript (ES6+ modules), no framework runtime
- **Persistence:** `localStorage` for all shop/app data, accessed exclusively through a storage abstraction layer
- **License validation:** a minimal Supabase table + REST call (anon key, read-only RLS policy) checks license-key status only; nothing else in the app talks to Supabase
- **Shipping data:** bundled static JSON rate table (see Module 4), not a live third-party API — no external shipping API key needed
- **Distribution:** static files only — deployable to GitHub Pages, Netlify, Vercel, or Cloudflare Pages; Supabase is the one external service the app calls, and only for license checks

### File structure
```
/index.html
/manifest.json
/sw.js                      (service worker)
/icons/                     (192x192, 512x512, maskable variants)
/js/
  app.js                    (view router, tab switching)
  storage.js                (localStorage abstraction — see below)
  /modules/
    invoice.js               (Module 1)
    templates.js              (Module 2)
    orders.js                 (Module 3)
    shipping.js                (Module 4 — reads bundled static rate data)
  license.js                 (Supabase license/tier check — the only networked module besides shipping updates)
  /vendor/
    html2canvas.min.js        (loaded only for Pro-tier image export)
/data/
  shippingRates.json          (bundled flat-rate courier/zone data — see Module 4)
/css/
  print.css                  (thermal + A4 print stylesheet, media="print")
```

### Storage abstraction (`storage.js`)
All modules read/write through this wrapper — **no module calls `localStorage` directly**. This keeps the storage engine swappable later (e.g., if IndexedDB is ever needed for larger histories) without touching UI code.

```js
Storage.get(key)              // returns parsed JSON or null
Storage.set(key, value)       // stringifies and writes, triggers autosave indicator
Storage.remove(key)
Storage.exportAll()           // returns one JSON blob of all app data, for backup download
Storage.importAll(jsonBlob)   // overwrites app data from a backup file, with confirmation prompt
```

Every field in every module autosaves on change (debounced ~300ms) — there is no explicit "Save" button anywhere in the app.

---

## 6. Data Model

```json
// key: "shopProfile"
{
  "shopName": "Toko Sari Fashion",
  "waNumber": "+6281234567890",
  "logoBase64": null,          // Pro tier only
  "address": "Jl. Melati No. 5, Yogyakarta",
  "defaultTaxPercent": 0,
  "defaultShippingFee": 0,
  "defaultShippingType": "flat", // "flat" | "percent"
  "bankAccounts": [
    { "bank": "BCA", "holder": "Sari P.", "number": "4560-1244-95" }
  ],
  "thankYouMessage": "Terima kasih sudah belanja! 🙏"
}

// key: "invoices"  (array)
[{
  "id": "inv_1699999999",
  "invoiceNumber": "260815-A1B2",   // human-readable, shown to customer — see generation rule below
  "date": "2026-08-15T09:00:00Z",
  "orderType": "regular",           // "regular" | "dropship"
  "customerName": "Ani",
  "customerPhone": "+6281111111111",
  "customerAddress": "",            // optional
  "paymentMethod": "transfer",      // "transfer" | "cod" | "qris" | custom text
  "note": "",                       // free-text, per-invoice ("Catatan")
  "items": [
    { "name": "Kaos Polos M", "qty": 2, "price": 75000 }
  ],
  "subtotal": 150000,
  "tax": 0,
  "shipping": 15000,
  "total": 165000,
  "status": "pending",         // pending | paid | shipped | completed | cancelled
  "linkedOrderId": "ord_1699999999"
}]

// key: "templates"  (array)
[{
  "id": "tpl_001",
  "title": "Closing – Terima kasih",
  "category": "Closing Scripts",
  "body": "Halo {{nama}}, total belanjaan kamu {{total}}. Terima kasih ya! 🙏",
  "createdAt": "2026-08-01T00:00:00Z",
  "updatedAt": "2026-08-10T00:00:00Z"
}]

// key: "orders"  (array — CRM)
[{
  "id": "ord_1699999999",
  "customerName": "Ani",
  "linkedInvoiceId": "inv_1699999999",
  "status": "pending",
  "statusHistory": [
    { "status": "pending", "at": "2026-08-15T09:00:00Z" }
  ],
  "notes": ""
}]

// key: "settings"
{
  "tier": "unactivated",        // "unactivated" | "basic" | "pro" — set only after a Supabase-validated license key
  "licenseKey": null,
  "lastValidatedAt": null,     // ISO timestamp of last successful Supabase check
  "uiLanguage": "id"
}
```

**Supabase-side schema (not localStorage — lives in the Supabase project, license checks only):**
```sql
-- table: licenses
create table licenses (
  license_key text primary key,
  tier text not null,                      -- 'basic' | 'pro' — which paid tier this key unlocks
  status text not null default 'active',   -- 'active' | 'revoked'
  created_at timestamptz default now()
);
-- RLS: anon role may only SELECT tier + status by exact license_key match — no INSERT/UPDATE/DELETE from the client
```
The app calls this table with the anon key on: (a) first entry of a license key at the activation gate, and (b) periodically thereafter (e.g., every 30 days) to catch revocations — outside of that check, the cached `tier` flag in `localStorage` governs the UI so the app stays usable offline. Both Basic and Pro keys come from the same table and the same validation call; the returned `tier` value is what sets `settings.tier` and therefore which feature set unlocks.

---

## 7. Module Specifications

### Module 1 — Nota (WhatsApp-First Auto-Invoice Generator)

**Goal:** Let a seller build an invoice and get a copy-paste-ready WhatsApp message in under a minute.

**User stories**
- As a seller, I want to add and remove item rows freely, so I can invoice orders of any size.
  - Acceptance: "+ Tambah Item" adds a row (name, qty, price); each row has a delete (×) button; at least one row always present.
- As a seller, I want totals to update live as I type, so I never have to calculate by hand.
  - Acceptance: subtotal, tax, shipping, and grand total recalculate on every keystroke with no lag; non-numeric input in qty/price is rejected or defaults to 0.
- As a seller, I want to set tax and shipping per invoice, defaulting to my shop's usual rates, so I don't re-enter them every time.
  - Acceptance: tax % and shipping (flat or %) fields pre-fill from `shopProfile` defaults but are editable per invoice.
- As a seller, I want a ready-to-send WhatsApp-formatted receipt, so I can paste it straight into a chat.
  - Acceptance: live preview pane renders using WhatsApp markdown (`*bold*` for header/total, `` `monospace` `` for the item table); "Salin ke WhatsApp" button copies the exact text to clipboard with a confirmation toast.
- As a seller with a thermal printer, I want to print a receipt formatted for my printer, so I can attach it to the parcel.
  - Acceptance: "Cetak" button triggers `window.print()`; a dedicated print stylesheet renders correctly at 58mm and 80mm thermal widths as well as A4, toggled by a paper-size selector before printing.
- As a seller, I want every invoice to get a unique, human-readable invoice number automatically, so I can reference it in conversation with a customer.
  - Acceptance: `invoiceNumber` auto-generates in the format `YYMMDD-XXXX` (date + 4-char random alphanumeric suffix) on invoice creation; never editable by the seller; guaranteed unique by checking against existing `invoices` before assigning.
- As a seller, I want the payment status shown clearly on the invoice itself, so the customer sees it at a glance.
  - Acceptance: a colored status pill renders at the top of the invoice (e.g., "Belum Lunas" for pending — orange, "Lunas" for paid — green), driven by the same `status` field used in Module 3, kept in sync automatically.
- As a seller, I want to mark an order as regular or dropship, so the receipt reflects how it's being fulfilled.
  - Acceptance: a toggle/tag near the top of the invoice form sets `orderType`; "Dropship" renders as a small label under the invoice number when selected, omitted entirely for "regular."
- As a seller, I want to optionally add the customer's address and preferred payment method, so the receipt has everything the customer needs.
  - Acceptance: `customerAddress` and `paymentMethod` are optional fields under the customer name/phone; both simply omit from the rendered receipt when left blank rather than showing empty labels.
- As a seller, I want to add a free-text note to an invoice, so I can include a custom message like payment instructions.
  - Acceptance: a `note` textarea (labeled "Catatan") renders as its own section on the receipt when non-empty; supports the same `{{nama}}`/`{{total}}` variable tags as Module 2 templates for consistency.
- As a seller, I want my payment destination accounts listed automatically on every invoice, so I don't retype bank details each time.
  - Acceptance: `shopProfile.bankAccounts` (managed in Settings — bank name, account holder, account number; add/remove freely) renders as a list at the bottom of every receipt; empty list simply omits the section.
- As a seller, I want a closing thank-you message on every receipt, so it feels personal without extra typing.
  - Acceptance: `shopProfile.thankYouMessage` renders at the very bottom of the receipt, editable in Settings, with a sensible default pre-filled.

**Wireframe — input form (mobile, ~375px)**
```
┌─────────────────────────────┐
│ 🧾 Buat Nota                 │
├─────────────────────────────┤
│ Tipe: (•) Regular ( ) Dropship│
│ Status: [Belum Lunas ▾]       │
├─────────────────────────────┤
│ Nama Pembeli: [___________]  │
│ No. WA:       [___________]  │
│ Alamat (opsional): [_______] │
│ Bayar via:    [Transfer ▾]    │
├─────────────────────────────┤
│ Item                Qty  Rp  │
│ [Kaos Polos M]  [2] [75000] ×│
│ [Celana Jeans]  [1] [150000]×│
│ + Tambah Item                │
├─────────────────────────────┤
│ Pajak (%):   [0]              │
│ Ongkir (Rp): [15000]          │
│ Catatan: [________________]  │
├─────────────────────────────┤
│ Subtotal:        Rp 300.000  │
│ Ongkir:           Rp 15.000  │
│ TOTAL:           Rp 315.000  │
└─────────────────────────────┘
```

**Wireframe — rendered receipt / WhatsApp preview**
```
┌─────────────────────────────┐
│         (◉ logo ◉)            │
│      Toko Sari Fashion       │
│        0812-3456-7890         │
├─────────────────────────────┤
│ #260815-A1B2      [Belum Lunas]│
│ Dropship                       │
│ Kepada: Ani                    │
│ 15/08/26, 09:00 · Transfer     │
├─────────────────────────────┤
│ `Kaos Polos M  2x  75.000`    │
│ `Celana Jeans  1x 150.000`    │
├─────────────────────────────┤
│ Subtotal:        Rp 300.000   │
│ Ongkir:            Rp 15.000  │
│ *TOTAL: Rp 315.000*           │
├─────────────────────────────┤
│ Catatan: (jika diisi)          │
├─────────────────────────────┤
│ Transfer ke:                   │
│ BCA Sari P. 4560-1244-95       │
├─────────────────────────────┤
│ Terima kasih sudah belanja! 🙏 │
└─────────────────────────────┘
│ [📋 Salin ke WhatsApp]  [🖨]   │
```

**Edge cases:** empty item list blocks copy/print with a friendly message; very long item names truncate gracefully in print view but wrap fully in the WhatsApp text; price of 0 is allowed (e.g., free gift item) but flagged with a subtle warning; `customerAddress`, `paymentMethod`, `note`, and `bankAccounts` sections each independently omit from the rendered receipt when empty, so a minimal invoice looks clean rather than showing blank labels.

---

### Module 2 — Template (Chat Template Manager)

**Goal:** Save and instantly reuse the messages a seller types every day, with live variable substitution.

**User stories**
- As a seller, I want to save a message as a reusable template with variables, so I don't retype it every time.
  - Acceptance: create/edit form with title, category, and body text; body supports `{{nama}}`, `{{total}}`, `{{tanggal}}` placeholders, documented via a helper hint below the textarea.
- As a seller, I want to organize templates into categories, so I can find the right one fast.
  - Acceptance: category is a free-text or dropdown-selectable field; template list is grouped/filterable by category.
- As a seller, I want to insert a template pre-filled with the current invoice's data, so I don't manually replace variables.
  - Acceptance: when opened from within an active invoice context, `{{nama}}` and `{{total}}` auto-resolve to that invoice's values before copy; when opened standalone, placeholders remain visible as literal text for manual editing.
- As a seller, I want to search my templates, so I can find one among many quickly.
  - Acceptance: a search box filters by title and body text in real time.

**Wireframe**
```
┌─────────────────────────────┐
│ 💬 Template Chat        [+]  │
│ 🔍 [cari template...]        │
├─────────────────────────────┤
│ Closing Scripts               │
│  • Terima kasih         [📋][✎]│
│  • Follow-up pembayaran [📋][✎]│
├─────────────────────────────┤
│ Shipping Notices               │
│  • Sudah dikirim        [📋][✎]│
└─────────────────────────────┘
```

**Edge cases:** deleting a template asks for confirmation; unresolved variables (no active invoice context) copy as literal `{{nama}}` text rather than erroring.

---

### Module 3 — Orders (Local CRM & Order Status Tracker)

**Goal:** Give a seller a single list of "who owes what and where it's at," without needing a spreadsheet.

**User stories**
- As a seller, I want every invoice I create to automatically appear as an order, so I don't double-enter data.
  - Acceptance: saving/copying an invoice in Module 1 creates a linked `orders` record with status `pending`.
- As a seller, I want to move an order through statuses with one tap, so tracking takes seconds.
  - Acceptance: each order row has a status control (segmented buttons or dropdown: Pending → Paid → Shipped → Completed, plus Cancelled); each change appends a timestamped entry to `statusHistory`.
- As a seller, I want to filter and search orders, so I can find a specific customer or see everyone still unpaid.
  - Acceptance: filter chips for each status; search box matches customer name.
- As a seller, I want to see order history for a customer, so I know if they're a repeat buyer.
  - Acceptance: tapping an order reveals its status history timeline and linked invoice detail.

**Wireframe**
```
┌─────────────────────────────┐
│ 📦 Pesanan                    │
│ [Semua][Pending][Paid][Shipped]│
│ 🔍 [cari pelanggan...]        │
├─────────────────────────────┤
│ Ani · Rp 315.000              │
│ [Pending ▾]           15 Aug  │
├─────────────────────────────┤
│ Budi · Rp 120.000              │
│ [Shipped ▾]            14 Aug │
└─────────────────────────────┘
```

**Edge cases:** an order with no linked invoice (manually created) is still supported; status cannot skip backward without an explicit confirm (e.g., Shipped → Pending) to avoid accidental taps.

---

### Module 4 — Ongkir (Shipping Estimator, Static Rate Data)

**Goal:** Give a seller a fast shipping cost estimate without a live courier API, no internet dependency, and no third-party API key to manage.

**Data source:** a bundled `data/shippingRates.json` file shipped with the app — a flat-rate table keyed by origin zone → destination zone → weight bracket → courier, sourced and maintained manually by the app owner (not queried live). This trades rate precision for zero external dependency: the module works fully offline and has nothing that can "break" from an expired key or rate-limited API.

**User stories**
- As a seller, I want to enter origin, destination, and weight, so I can quote shipping to a customer.
  - Acceptance: origin defaults from `shopProfile` address; destination is a dropdown/searchable list drawn from the zones present in `shippingRates.json` (not free-text, since only bundled zones have data); weight in grams, rounded up to the nearest bracket in the table.
- As a seller, I want to see estimated cost per courier for that route, so I can quote or offer a choice.
  - Acceptance: results list every courier present in the data for that origin→destination→weight combination, showing courier name, service level, and price; no live delivery-time-of-day precision is implied since the data is static.
- As a seller, I want to know the estimate is a static reference, not a live quote, so I don't over-promise to a customer.
  - Acceptance: results panel always shows a small "Estimasi, bisa berbeda dari ongkir aktual" (estimate only, may differ from actual) disclaimer.
- As a seller, I want a sensible fallback when my route isn't in the data, so the module doesn't just fail silently.
  - Acceptance: if origin/destination/weight combination isn't found, show a manual flat-fee input the seller can type in themselves, seeded from `shopProfile.defaultShippingFee`.

**Wireframe**
```
┌─────────────────────────────┐
│ 🚚 Cek Ongkir                 │
│ Asal:    [Yogyakarta ▾]       │
│ Tujuan:  [Jakarta ▾]          │
│ Berat:   [___] gram           │
│ [Cek Ongkir]                  │
├─────────────────────────────┤
│ JNE Reguler    Rp 12.000      │
│ SiCepat Best   Rp 10.000      │
│ TIKI Reg       Rp 13.000      │
│ *Estimasi, bisa berbeda        │
│  dari ongkir aktual            │
└─────────────────────────────┘
```

**Architecture note:** `shipping.js` reads and looks up `data/shippingRates.json` directly — no network call, no adapter pattern needed. If a future version adds a live-rate option, the lookup function's signature (`getRates(origin, destination, weight)`) should stay the same so a live source could be swapped in without a UI rewrite — but that's explicitly out of scope for this build (see §12).

**Maintenance trade-off — explicit:** because rates are static and bundled, they go stale as real courier pricing changes. Mitigation: keep `shippingRates.json` as a single, easy-to-edit file and redeploy periodically (e.g., quarterly) to refresh it; no code changes needed, just data.

**Edge cases:** route/weight not found in the table falls back to the manual flat-fee input, never a blank/broken screen; weight of 0 or blank blocks the "Cek Ongkir" button.

---

## 8. Monetization & Tiering

Both tiers are paid — there is no free version. A seller must purchase and activate either a Basic or Pro license key before the app is usable at all (see the activation gate in §4). The two tiers differ only in which features unlock, not in whether payment is required.

| Feature | Basic (Paid) | Pro (Paid) |
|---|---|---|
| Invoice generator (Module 1) | ✅ | ✅ |
| WhatsApp Markdown output + copy | ✅ | ✅ |
| Printer formatting (`window.print()`) | ✅ | ✅ |
| Chat template manager (Module 2) | ✅ | ✅ |
| Order/CRM tracker (Module 3) | ✅ (last 20 orders retained) | ✅ Unlimited history |
| Shipping estimator (Module 4) | ✅ (static rate data) | ✅ |
| White-label shop logo on invoices | ❌ | ✅ |
| One-tap image export (`html2canvas`) | ❌ | ✅ |
| Advanced template bundles (pre-written scripts) | ❌ | ✅ |

**Paywall enforcement — Supabase-backed:** a seller enters a license key (issued at time of purchase, however that's handled outside this app) at the activation gate. The app makes a single read-only REST call to a Supabase table (`licenses`, schema in §6) checking that the key exists, `status = 'active'`, and reading which `tier` ('basic' or 'pro') it unlocks. On success, `settings.tier` is set locally to the returned value and `lastValidatedAt` is stamped; the app re-checks periodically (e.g., every 30 days) rather than on every launch, so it stays fully usable offline day-to-day. This is a real improvement over a pure local checksum — a revoked or refunded key can actually be cut off — but it is still not high-security DRM: the RLS policy only allows read access, so a key can't be forged through the API, though a sufficiently motivated user could still hardcode `tier: "pro"` into their own `localStorage` to skip validation entirely. That residual gap is accepted as reasonable for a low-price small-business tool.

**Basic-tier history cap rationale:** the 20-order cap on Basic is a monetization lever, not a technical limit — `localStorage` can hold far more. Implement it as a soft UI cap (oldest orders greyed out / hidden with an "Upgrade to see more" prompt) rather than actually deleting data, so a later upgrade doesn't lose the seller's history.

---

## 9. PWA & Deployment Requirements

**`manifest.json`** must include: `name`, `short_name`, icons at 192×192 and 512×512 (plus a maskable variant), `theme_color`, `background_color`, `display: "standalone"`, `start_url: "/"`.

**Service worker (`sw.js`):**
- Cache-first strategy for the app shell (HTML/CSS/JS/icons) **and** `data/shippingRates.json` — all bundled, so Modules 1–4 work fully offline after first load.
- The Supabase license-check call (`license.js`) is the one request that needs network; it fails gracefully to the cached `tier` value in `localStorage` when offline, so a Pro user isn't locked out just because they're offline.
- Version the cache name on each deploy so updates propagate (skip-waiting + prompt-to-refresh pattern) — this is also how `shippingRates.json` gets refreshed (§7, Module 4 maintenance trade-off).

**Installability checklist:** valid manifest + registered service worker + served over HTTPS + icons meeting minimum size requirements — verified via Lighthouse before launch.

**Hosting:** fully static — no server runtime required. Deployable to GitHub Pages, Netlify, Vercel, or Cloudflare Pages directly from the file structure in §5.

**Important clarification — "hosted online" does not mean "source-protected":** the app is always served live from a URL rather than distributed as an installed package, and "Add to Home Screen" only creates a shortcut back to that same URL — it does not download or obscure the app in any special way. Because the stack is plain HTML/CSS/vanilla JS with no build step (§5), every byte of client-side code is visible to any user via their browser's "View Source" or DevTools, exactly like any other website — being "not installed" provides no additional protection against someone copying the front-end code. This doesn't block anything in this PRD (the same residual paywall-bypass gap is already accepted in §11), but it's worth stating plainly so the source-protection expectation is set correctly: if protecting the actual code from being copied ever becomes a hard requirement, that would need real server-side logic, not just online hosting.

---

## 10. Non-Functional Requirements

- **Performance:** first meaningful paint under 2 seconds on a mid-range Android device over 4G; all core-module interactions (adding a row, toggling status) feel instant (<100ms) since there's no network round-trip involved.
- **Browser support:** latest two versions of Chrome, Safari, and Edge, on both mobile and desktop. No IE11 support.
- **Accessibility:** minimum 44×44px tap targets on all interactive controls; Tailwind color choices meet WCAG AA contrast for body text.
- **Localization:** Bahasa Indonesia as the default and primary UI language; all currency formatted as Rupiah (`Rp 000.000` with period thousands-separator, no decimals).
- **Data resilience:** autosave on every field change (debounced); no data loss on accidental tab close or refresh; export/import backup (§5) as the mitigation for browser storage being cleared.

---

## 11. Risks, Assumptions & Open Questions

- **`localStorage` capacity (~5–10MB per origin):** a high-volume seller could theoretically approach this after months of invoices. Mitigation: the export/import JSON backup doubles as an "archive and clear" workflow; monitor and consider IndexedDB migration if this becomes a real constraint post-launch.
- **Paywall still has a residual bypass** (a user can hand-edit `localStorage`) even with Supabase validation — real improvement over pure-local checksum (revocation now works), but not high-security DRM. Accepted trade-off given the low price point.
- **Supabase becomes a dependency, however minimal:** the app is no longer 100% backend-free — license validation requires Supabase to be up and the anon-key RLS policy to be correctly scoped (read-only, license table only). Free-tier Supabase limits should be checked against expected license-check volume before launch.
- **Shipping data goes stale over time** since it's static and bundled, not live (see Module 4). Mitigation is a periodic manual refresh of `shippingRates.json`, not a code change — needs to be an actual recurring task, not a one-time build step forgotten after launch.
- **No cross-device sync for shop data:** each browser/device has fully independent invoices/orders/templates; a seller switching phones must manually export/import. This should be surfaced clearly in onboarding, not discovered painfully later.
- **No usage analytics for shop data:** invoice/order/template activity still isn't tracked anywhere (that data never leaves the browser). Only license-check events touch Supabase, so retention/conversion metrics in §3 remain qualitative unless a separate, deliberate analytics decision is made later.
- **Open question:** should the Basic tier's 20-order cap apply retroactively if a Pro user downgrades, or grandfather existing history? Recommend grandfathering to avoid feeling punitive.
- **Open question — resolved for now, revisit at v2:** how a prospective buyer evaluates the app before purchasing is answered by the planned free-tier trial (§12) — but that's explicitly deferred, so for this build, launch still needs *some* pre-purchase evaluation path (screenshots/demo video on a sales page, etc.) since the activation flow (§4) has no trial option yet.

---

## 12. Out of Scope / Future Roadmap (v1 exclusions)

Explicitly **not** in v1:
- Multi-user/team accounts or shared shop access
- Cloud sync across devices
- Payment gateway integration (invoice generation only — no actual payment collection)
- Native mobile app builds (iOS/Android app store distribution)

Candidate v2 ideas (not specified further here): live courier-rate API to replace/supplement the static `shippingRates.json`; opt-in cloud backup as a Pro add-on (Supabase already exists for licensing, so this is a smaller lift than it would've been); multi-shop profiles within one install; integration with WhatsApp Business API for semi-automated sending.

**Free tier (deferred — not in v1, candidate for v2):** the planned free tier is a **time-limited trial, not a feature-limited tier**. A seller activates without a purchased key and gets **7 days of full feature access** (same as Basic, or possibly Pro-level — TBD when this is actually specced) starting from first activation. After the 7-day window, the app locks — modules become unreachable until the seller purchases a Basic or Pro license key through the same activation flow described in §4. Because access is time-gated rather than feature-gated, **no watermarking, export limits, or degraded output are needed** to differentiate the trial from a paid tier — the trial *is* the full product, just for a limited window. Implementation note for whoever specs this later: the 7-day expiry should be enforced the same way license status is — a lightweight Supabase check (`trialStartedAt` + 7-day window) rather than a pure client-side clock, since a client-only timestamp in `localStorage` could trivially be reset by the seller.
