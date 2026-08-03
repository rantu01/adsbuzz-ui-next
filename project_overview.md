# AdsBuzz ERP — Project Overview

# AdsBuzz ERP — Project Overview

> Status: **Phases 0–2 ✅ + Phase 3 (CRUD) 🟩 + Phase 4 (Business APIs) 🟩 complete. Phase 5 (Frontend Integration) in progress.**
> Last updated: 2026-08-03

---

## 1. Two Projects

### 1.1 Source / Reference Project (READ ONLY — never modify)

- **Path:** `D:\Code\Project\Office Work\AD accont\ad-buzz`
- **Role:** Original production app. Pure reference for business logic, DB schema, auth, Meta/WhatsApp integrations, and all existing data.
- **Rules:** Do NOT modify, rename, move, delete, format, install packages, or commit anything in this folder. Only read/analyze.

### 1.2 Target Project (where ALL development happens)

- **Path:** `D:\Code\Project\Office Work\AD accont\adsbuzz-ui-next`
- **Role:** New, redesigned Next.js frontend. UI is the **source of truth**. Backend must be implemented page-by-page to power the existing UI **without changing the UI**.
- All code changes happen here.

---

## 2. Business Domain

AdsBuzz Ltd is a Bangladeshi digital ad agency. It manages **Facebook, TikTok, Google, and Snapchat** ad accounts on behalf of clients (customers). Core workflow:

1. A customer pays **BDT** (bKash/Nagad/bank).
2. AdsBuzz loads **USD** onto a publisher ad account (top-up).
3. An **invoice** records the transaction (USD amount, BDT paid, exchange rate, payment method).
4. Billing **cards** (EBL/DBBL/etc.) fund the accounts; **vendors** supply ad credits; **series** group accounts.

---

## 3. Tech Stack Comparison

| Layer | Old (ad-buzz) | New (adsbuzz-ui-next) |
|---|---|---|
| Framework | Next.js 16.2.7 (App Router) | Next.js 15.3.1 (App Router, `next dev --port 3000`) |
| Frontend | React 19.2.4 + Tailwind v4 + Framer Motion + SweetAlert2 | React 19 + Tailwind v4 + motion v12 + Recharts 3.9.2 |
| Auth | Firebase Auth (Email/Password + Google OAuth) + Firebase Admin | None yet (planned) |
| Database | MongoDB 7 (native `mongodb` driver ^7.2.0) | None yet (planned: MongoDB — see backend-analysis) |
| Icons | lucide-react | lucide-react 0.546.0 |
| External APIs | Meta Graph API v22.0, WhatsApp Cloud API v22.0 | None yet |
| Language | JavaScript (`.js`, ESM) | JavaScript (`.jsx`/`.js`, ESM) |

---

## 4. New Project Structure (adsbuzz-ui-next)

```
src/
├── middleware.js                  # Placeholder (matcher: [])
├── app/
│   ├── layout.jsx                 # Root layout: AppProvider + AppShell
│   ├── page.jsx                   # Dashboard (route /)
│   ├── error.jsx / loading.jsx / not-found.jsx
│   ├── globals.css                # Tailwind v4 + brand CSS vars (orange #F68B2D / blue #154A7D)
│   ├── ad-accounts/page.jsx
│   ├── cards/page.jsx
│   ├── customers/page.jsx
│   ├── insights/page.jsx
│   ├── invoices/page.jsx
│   ├── reports/page.jsx
│   ├── sale-setup/page.jsx
│   ├── sales/page.jsx
│   ├── series/page.jsx
│   ├── settings/page.jsx
│   ├── topups/page.jsx
│   ├── vendors/page.jsx
│   └── api/                       # 5 STUB routes (placeholder JSON)
│       ├── admin/route.js
│       ├── auth/route.js
│       ├── tasks/route.js
│       ├── upload/route.js
│       └── users/route.js
├── components/
│   ├── common/  AppShell, Header, Sidebar, PlatformText, StatCard, Toast
│   ├── ui/      Badge, Button, Modal, SearchBar
│   └── views/   Dashboard, Customers, Sales, SaleSetup, Topups, AdAccounts,
│                Series, Cards, Vendors, Reports, Insights, Invoices, Settings
├── context/AppContext.jsx         # Global state + ALL CRUD handlers (central UI contract)
├── hooks/                         # 9 hooks: useCustomers, useAdAccounts, useInvoices,
│                                  # useCards, useVendors, useSeries, useSaleSetups,
│                                  # useSettings, useActivities
├── data/seedData.js               # All mock data (INITIAL_* constants)
docs/                              # Planning docs (api_list, database_schema, backend_architecture, etc.)
```

---

## 5. Current State of the New Project

- **Backend + DB live for core modules.** MongoDB connected; real data loaded:
  - **Ad Accounts** — 412 accounts read from the production DB, mapped legacy→UI shape.
  - **Series, Cards, Vendors** — CRUD + seeding against new collections.
  - **Customers** — CRUD + notes + favourite + sync from old `users`.
  - **Invoices** — live list + legacy-invoice sync.
  - **Activities** — feed + logging wired into every AppContext mutation.
  - **Topups** — pending list + approve/reject/sync (Topups page wired).
  - **Insights** — platform spend, account analyzer, gateway breakdown.
  - **Reports** — monthly metrics + CSV/XLSX/PDF export (download buttons live).
  - **Dashboard** — aggregate stats + recent invoices/activities (page wired).
- **Frontend wired to APIs** via hooks (Customers, AdAccounts, Invoices-list, Cards, Vendors, Series, Activities, Topups, Dashboard).
- **Fixed bugs:** infinite re-fetch loop (AppContext) and Modal focus/typing bug (all modals).
- **Pagination** added to Reports & Invoices tables.
- **Remaining:** Phase 5 polish (API error handling, optimistic updates, upload flow), then Phase 6 polish.
- **Next step:** complete Phase 5 wiring polish + Phase 6 (validation, confirmations, tests).

---

## 6. Navigation / Pages (Sidebar order)

| # | Route | Page | View component | Primary data |
|---|---|---|---|---|
| 1 | `/` | Dashboard | `DashboardView` | stats, invoices, customers, adAccounts, series, activities |
| 2 | `/customers` | Customer CRM Hub | `CustomersView` | customers, adAccounts, invoices |
| 3 | `/sales` | Sale Entry (Shopify checkout) | `SalesView` | customers, adAccounts, settings, invoices |
| 4 | `/sale-setup` | Sale Setup | `SaleSetupView` | setups, adAccounts |
| 5 | `/topups` | Financial Audits & Syncs | `TopupsView` | invoices, customers |
| 6 | `/ad-accounts` | Ad Accounts | `AdAccountsView` | adAccounts, customers, cards, series |
| 7 | `/series` | Series | `SeriesView` | series, adAccounts |
| 8 | `/cards` | Cards | `CardsView` | cards, adAccounts |
| 9 | `/vendors` | Vendors | `VendorsView` | vendors |
| 10 | `/reports` | Reporting Desk | `ReportsView` | invoices |
| 11 | `/insights` | Insights | `InsightsView` | invoices, adAccounts, vendors, cards, series |
| 12 | `/invoices` | Invoices | `InvoicesView` | invoices, customers |
| 13 | `/settings` | Settings | `SettingsView` | settings |

---

## 7. Architecture Pattern (target)

Route → Controller → Service → Repository → Model (per `docs/backend_architecture.md`), using Next.js App Router API routes under `src/app/api/`.

### Planned directory layout (in `src/`)

```
src/
├── app/api/<entity>/route.js          # HTTP handlers (GET/POST/PUT/PATCH/DELETE)
├── controllers/                       # request handling + validation + response shaping
├── services/                          # business logic
├── repositories/                      # DB access
├── models/                            # Mongo schemas / collection helpers
├── middlewares/                       # auth, rbac, validate, errorHandler, upload
├── validators/                        # Zod (planned) request schemas
├── lib/                               # db connection, logger, cache
├── utils/                             # currency, date, csv
└── config/                            # env config
```

### Planned data flow example (create sale)
1. `POST /api/invoices` → validator middleware
2. `invoiceController.create(req)` → `invoiceService.create(data)`
3. Service calculates totals + derives payment status → `invoiceRepository.create()`
4. Repository inserts into MongoDB → controller returns JSON

---

## 8. UI → Backend Integration Strategy (per master plan)

- Work **page by page**, one page fully complete (DB + API + validation + auth + authz + loading + errors + pagination + search + filters + CRUD) before starting the next.
- **UI is the source of truth.** Never alter UI to fit an API; adapt the backend to the UI.
- **Data source rule:** where a page shows existing production data, read from the **same MongoDB collections the old project uses** (see `backend-analysis.md`). Do not duplicate or migrate data unless instructed.
- Suggested first page: **Customers** (end-to-end reference pattern).

---

## 9. Database Decision

- Old project uses MongoDB (db name from `MONGODB_DB_NAME`, default `ad_buzz`; note `userModel.js` defaults to `adBuzz`).
- New project's `docs/todo.md` recommends PostgreSQL + Prisma, but the master plan mandates **reusing the old MongoDB collections** for existing data. → **Decision: use MongoDB with the native driver (same as old project) to share collections.** Full rationale + schema mapping in `backend-analysis.md`.
- `.env.local.example` already lists `MONGODB_URI`, `JWT_SECRET`, `UPLOAD_PATH`, etc.

---

## 10. Key Data Entities (UI contract — from seedData.js)

- **Customer**: `id (CUST-*)`, name, email, phone, companyName, status, createdAt, balanceBDT, balanceUSD, creditLimitUSD, groupId (GC-*), notes, avatar, favorite
- **AdAccount**: `adAccountId`, adAccountName, platform, accountType, dollarRate, monthlySpending, accountOwner, userGroupCode, accountStatus, bmId, bmName, billingCard, assignedCustomer, seriesId
- **Invoice**: `invoiceNo (ADB ...)`, date, platform, adAccountName, serviceType, dollarRate, topupAmountUSD, totalAmountBDT, paidAmountBDT, dueAmountBDT, paymentStatus, paymentMethod, topupStatus, approvalStatus, customerId, groupId, note, serviceDetails, paymentScreenshot
- **Card**: `id (CARD-*)`, cardName, cardType, cardPlatform, cardInitial, status, linkedAccountsCount, usageCount, totalLoadedUSD
- **Vendor**: `id (VEND-*)`, name, platform, outstandingBalanceUSD, email, phone, status, paymentHistory[]
- **Series**: `seriesId (S-*)`, seriesName, platform, status
- **SaleSetup**: `groupId (GC-*)`, userId, adName, adAccountId, platform, dollarRate, monthlySpending, status
- **Settings**: companyName, defaultDollarRate (132), paymentMethods[], roles[], permissions{}
- **Activity**: id, time, user, action, details, type (sale/system/payment/account/customer)

---

## 11. Known Issues / Notes

1. **Old project has NO server-side token verification** on most routes (accepts client `uid`). New backend should decide whether to keep or harden this.
2. **DB name inconsistency** in old project: `userModel.js` defaults `adBuzz`, everything else `ad_buzz` (both overridden by `MONGODB_DB_NAME`).
3. Old project `updateSpendCap` posts **dollars** to Meta while Meta returns cents/100 — potential unit bug (documented, do not fix unless instructed).
4. Old "auto 95%/20% spend-cap increase" feature is **NOT implemented in code** (only described in docs).
5. `CRON_SECRET` optional; when empty, cron endpoints are open. `SyncPoller` relies on this.
6. New UI has **no login page / no auth flow** yet; auth design is still an open decision (see `backend-analysis.md` §Auth).

---

## 12. Phase Gate

**Phases 0–2 complete; Phase 3 (CRUD) complete; Phase 4 (Business APIs) complete; Phase 5 (Frontend Integration) in progress.** Analysis is in:
- `backend-analysis.md` — full old-project analysis + new-UI contract + schema mapping
- `api-status.md` — API endpoint inventory + build status matrix (live)
- `progress.md` — running progress log
- `todo.md` — living checklist
- `report.md` — client-facing summary of uncommitted work

**Phase 3+4 shows Strong progress.** Remaining: Phase 5 polish (API error handling, optimistic updates, upload flow) + Phase 6 (validation, confirmations, tests).
