# Todo List — AdsBuzz ERP Backend

> Living checklist. Completed tasks are never deleted — only marked complete.
> Last updated: 2026-08-04

---

## Phase 0 — Analysis ✅

- [x] Analyze old project folder structure
- [x] Analyze .env (variable names only)
- [x] Analyze MongoDB connection + db name + collections
- [x] Analyze Firebase client + admin config
- [x] Analyze authentication flow
- [x] Analyze roles & permissions matrix
- [x] Analyze user module
- [x] Analyze ad accounts module (user + admin)
- [x] Analyze deposits / wallet module
- [x] Analyze withdrawals module
- [x] Analyze balance logs module
- [x] Analyze support tickets module
- [x] Analyze reports module (reportService + export)
- [x] Analyze meta-api module
- [x] Analyze settings module
- [x] Analyze whatsapp module
- [x] Analyze payment-methods / bank-accounts
- [x] Analyze top-up-insights / invitations
- [x] Analyze cron / autoMetaFetch / SyncPoller
- [x] Analyze Meta API service (Graph v22, spend cap, caching, locks)
- [x] Analyze WhatsApp service (templates, notification logs)
- [x] Analyze new project UI (13 views, 9 hooks, AppContext, seedData)
- [x] Generate UI→backend API contract
- [x] Generate collection mapping (old → new)
- [x] Generate project_overview.md
- [x] Generate backend-analysis.md
- [x] Generate api-status.md
- [x] Generate progress.md
- [x] Generate todo.md

---

## Phase 1 — Foundation ✅

- [x] Set up `src/lib/db.js` (MongoDB connection singleton + getClient/getDb/getCollection/pingDatabase)
- [x] Set up `src/config/index.js` (env config)
- [x] Create folder structure (controllers, services, repositories, models, middlewares, validators, utils — dirs exist, empty)
- [x] Create shared response helpers (`ok`/`fail`/`ApiError`/`HttpStatus`/`asyncHandler`)
- [x] Create error handler middleware (`src/middlewares/errorHandler.js`)
- [x] Create logger utility (`src/utils/logger.js`)
- [x] Create validation helpers (`src/utils/validate.js`)
- [x] Set up `.env.local` with MONGODB_URI, MONGODB_DB_NAME, JWT_SECRET, UPLOAD_PATH, NEXT_PUBLIC_* (already present; verified)
- [x] Confirm DB name + connection works (ad_buzz reachable, ping OK, live collections enumerated)
- [x] Declare `mongodb@^7.5.0` in package.json
- [x] Verify build (`npm run build` — 21 pages, 0 errors)

---

## Phase 2 — Auth & RBAC ✅

- [x] Decide: **Firebase (reuse old)** — Firebase client + firebase-admin, uid-based `users` collection
- [x] Copy 8 Firebase env vars from old `.env` → new `.env.local` (values redacted)
- [x] Install `firebase@^12.13.0` + `firebase-admin@^14.1.0` in package.json
- [x] Create `src/lib/firebaseClient.js` (client SDK init + `auth`)
- [x] Create `src/lib/firebaseAdmin.js` (admin init, `normalizePrivateKey`, `verifyFirebaseToken`, `deleteFirebaseAuthUser`, `updateFirebaseUserPassword`)
- [x] Create `src/models/userModel.js` (ADB5 id gen via `counters`, `syncAuthenticatedUser`, balance helpers)
- [x] Create `src/lib/permissions.js` (6 roles, 29 perms, `hasPermission`/`getAllowedRoutes`/`canAccessRoute`/`isStaffRole`/`getNavItemsForRole`)
- [x] Create `src/middlewares/auth.js` (`requireAuth` — verifies Bearer ID token via Admin SDK, loads user, frozen check)
- [x] Create `src/middlewares/rbac.js` (`requireStaff`/`requireAdmin`/`requirePermission`)
- [x] Create `/api/auth/sync-user` (token-verified mirror of old route)
- [x] Create `/api/auth/me` (returns user + roleLabel + navItems)
- [x] Upgrade `/api/auth` stub → status endpoint (provider, configured)
- [x] Verify: `node --check` all files ✅, `npm run build` ✅ (23 routes, 0 errors), live Firebase Admin smoke test ✅ (listUsers OK)

---

## Phase 3 — CRUD APIs (page by page) ✅

### Settings (no deps) ✅
- [x] GET /api/settings
- [x] PUT /api/settings
- [x] PUT /api/settings/base-rate
- [x] POST /api/settings/payment-methods
- [x] DELETE /api/settings/payment-methods/[name]
- [x] Wire useSettings → API
- [x] Testing + docs update

### Series (no deps) ✅
- [x] GET/POST /api/series
- [x] PUT /api/series/[id]
- [x] Wire useSeries → API
- [x] Testing + docs update

### Cards (no deps) ✅
- [x] GET/POST /api/cards
- [x] PUT /api/cards/[id]
- [x] PATCH /api/cards/[id]/toggle (via [id] PATCH statusOnly)
- [x] PATCH /api/cards/load (applyCardLoad)
- [x] Wire useCards → API
- [x] Testing + docs update

### Customers (no deps) — reference pattern ✅
- [x] GET /api/customers (list + search + status/favorite filters + pagination)
- [x] POST /api/customers (CUST-* id generation)
- [x] GET /api/customers/[id]
- [x] PUT /api/customers/[id]
- [x] PATCH /api/customers/[id]/favorite
- [x] PATCH /api/customers/[id]/notes
- [x] Customer ↔ AdAccount linkage (assignedCustomer / groupId)
- [x] Customer ↔ Invoice linkage (customerId / groupId)
- [x] Validation
- [x] Auth + authorization
- [x] Loading + error handling
- [x] Wire useCustomers → API
- [x] Testing + docs update

### Ad Accounts (deps: Cards, Series, Customers) ✅
- [x] GET /api/ad-accounts (search/platform/status/assignment/series filters + pagination)
- [x] POST /api/ad-accounts
- [x] PUT /api/ad-accounts/[id]
- [x] PATCH /api/ad-accounts/[id]/status
- [x] PATCH /api/ad-accounts/bulk-status
- [x] Derived Sold status logic (getEffectiveAccountStatus)
- [x] Wire useAdAccounts → API
- [x] Testing + docs update

### Vendors (no deps) ✅
- [x] GET/POST /api/vendors
- [x] PUT /api/vendors/[id]
- [x] POST /api/vendors/[id]/pay (paymentHistory)
- [x] Wire useVendors → API
- [x] Testing + docs update

### Sale Setups (deps: Ad Accounts) ✅
- [x] GET/POST /api/sale-setups
- [x] PUT /api/sale-setups/[id]
- [x] Wire useSaleSetups → API
- [x] Testing + docs update

### Invoices (deps: Customers, Ad Accounts) ✅
- [x] GET /api/invoices (list + search + paymentStatus filter + legacy sync)
- [x] POST /api/invoices (create sale — full transactional flow)
- [x] GET /api/invoices/[id]
- [x] PUT /api/invoices/[id]
- [x] PATCH /api/invoices/[id]/approve
- [x] PATCH /api/invoices/[id]/reject
- [x] PATCH /api/invoices/[id]/sync-topup
- [x] Wire useInvoices → API
- [x] Testing + docs update

---

## Phase 4 — Business Logic APIs ✅

### Topups (deps: Invoices) ✅
- [x] GET /api/topups (pending: approvalStatus Pending OR topupStatus Pending)
- [x] PATCH /api/topups/[id]/approve
- [x] PATCH /api/topups/[id]/reject
- [x] POST /api/topups/[id]/sync
- [x] Wire TopupsView → API
- [x] Testing + docs update

### Insights ✅
- [x] GET /api/insights (platform spend, account analyzer, gateway breakdown)
- [x] Wire InsightsView → API
- [x] Testing + docs update

### Reports ✅
- [x] GET /api/reports?month=YYYY-MM (6 metrics + ledger rows)
- [x] GET /api/reports/export?month=&format=csv|xlsx|pdf
- [x] Wire ReportsView → API
- [x] Testing + docs update

### Activities ✅
- [x] GET/POST /api/activities
- [x] Wire useActivities → API (addActivity calls on every mutation)
- [x] Testing + docs update

### Dashboard ✅
- [x] GET /api/dashboard (aggregate stats)
- [x] Wire DashboardView → API
- [x] Testing + docs update

---

## Phase 5 — Frontend Integration ✅

- [x] Wire seed-data hooks → API (Customers, AdAccounts, Invoices-list, Cards, Vendors, Series)
- [x] Add loading states to Customers view (+ Topups view)
- [x] Add pagination to Reports + Invoices tables
- [x] Fix infinite re-fetch loop in AppContext (stabilize triggerToast)
- [x] Fix Modal typing/focus bug (apply to all modals)
- [x] Add error handling for API failures (shared `apiFetch` in `src/utils/api.js`, `error`/`refetch` on every hook, `ErrorBanner` wired into all data pages)
- [x] Add optimistic updates (favorite toggle, ad-account status/bulk-status, card toggle/update, series update, vendor update — with rollback)
- [x] Implement payment screenshot upload flow (`POST /api/upload`, Screenshot persisted to `/uploads`, wired into sale checkout)
- [x] Full build + lint verification
- [x] End-to-end manual test of every page

---

## Phase 6 — Polish & Testing ✅

- [x] Form validation with error messages (`src/utils/formValidation.js` — pure validators, wired into Customers, AdAccounts, Cards, Invoices, Settings modals with inline `FieldError`)
- [x] Confirmation dialogs for destructive actions (`src/components/ui/ConfirmDialog.jsx` — topup reject, delete payment method)
- [x] Unit tests for services/helpers (node:test — `tests/invoiceMath.test.mjs`, `tests/formValidation.test.mjs`, `tests/pagination.test.mjs`)
- [x] Integration tests for API routes (node:test against `adsbuzz_test` DB — `tests/integration.test.mjs`, 9 scenarios)
- [x] E2E tests for critical flows (create sale + approve topup via API routes in `tests/integration.test.mjs`)
- [x] Performance (pagination query params `page`/`limit` on list APIs via `src/utils/pagination.js`; memoization verified — views already use `useMemo`/`memo`/`useCallback`)
- [x] Extracted pure invoice math to `src/utils/invoiceMath.js` (round2, dateOnly, detectPlatform, computePaymentStatus, invoiceNoFromLegacyId) — `invoiceModel.js` now imports it
- [x] Test runner infra: `tests/load-env.mjs` (forces `MONGODB_DB_NAME=adsbuzz_test`), `tests/alias-loader.mjs` (`@/` alias + `next/server` stub), `tests/stubs/next-server.mjs`, `closeDb()` in `src/lib/db.js`, `npm run test` script
- [x] Full build + lint verification (`npm run build` ✅, `npm run lint` ✅, 30/30 tests pass)

---

## Frontend Authentication System (2026-08-04) ✅

- [x] Server-side route guard in `src/middleware.js` (session cookie check → redirect `/login?next=` for all 13 dashboard routes; refresh/direct URL/bookmark all covered)
- [x] Create `/login` page (Firebase email/password → `/api/auth/login` → session cookie → redirect)
- [x] `AuthContext` — session validation on mount (`/api/auth/session`), user state, logout (server cookie + Firebase signOut), login-page bounce for signed-in users
- [x] Wire `AuthProvider` into root layout + `AppShell` loading gate (no protected chrome before session resolves; `/login` renders bare)
- [x] Header shows real user identity + working Logout button
- [x] Fix `firebase-admin` default-import interop bug (switch to namespace import) so Admin SDK works under Next.js bundler
- [x] Verify end-to-end live: 307 redirect unauthenticated, login 200 + HttpOnly cookie, protected pages 200, session 200, logout 200 → 401/307
- [x] `npm run build` ✅ (0 errors), `npm run lint` ✅, `npm test` ✅ (30/30)

---

## Phase 7 — Deployment

- [ ] Production database config
- [ ] Monitoring & logging
- [ ] Deploy (Vercel / custom server)
- [ ] Final docs update
