# Progress Report — AdsBuzz ERP Backend

> Last updated: 2026-08-03
> Current phase: **Phase 6 (Polish & Testing) COMPLETE — form validation, confirmation dialogs, unit/integration/E2E tests, and list-API pagination are all live and verified. Next: Phase 7 deployment.**

---

## Summary

| Phase | Description | Status |
|---|---|---|
| Phase 0 | Analysis of old project + new UI + mapping + docs | ✅ Complete |
| Phase 1 | Foundation (DB connection, config, folder structure) | ✅ Complete |
| Phase 2 | Auth & RBAC | ✅ Complete |
| Phase 3 | CRUD APIs (Series, Cards, Customers, Ad Accounts, Vendors) | ✅ Complete |
| Phase 4 | Business APIs (Topups, Insights, Reports, Export, Activities, Dashboard) | ✅ Complete |
| Phase 5 | Frontend integration (swap seed data → API calls) | ✅ Complete |
| Phase 6 | Polish & testing | ✅ Complete |
| Phase 7 | Deployment | ⬜ Not started |

---

## Completed Work

### Phase 0 — Analysis (2026-08-01)

- [x] Analyzed old project `ad-buzz` (read-only):
  - Folder structure, package.json, all `lib/` files (20), all `app/api/` routes (~45), cron routes, scripts, vercel.json, next.config.mjs.
  - Environment variables (names only, values redacted).
  - MongoDB: db name, 16 collections, all fields, indexes.
  - Auth (Firebase client + admin), roles (6), permission matrix (29 perms), helpers.
  - Modules: dashboard, profile, deposits, withdrawals, balance logs, ad accounts (user/admin), users, support tickets, reports, meta-api, settings, whatsapp, payment-methods, bank-accounts, top-up-insights, invitations, cron.
  - Meta API service (Graph v22), WhatsApp service, report service, autoMetaFetch.
- [x] Analyzed new project `adsbuzz-ui-next`:
  - All 13 views, 9 hooks, AppContext (all handlers), seedData (all entities), ui/common components, 5 API stubs, middleware, layout, docs/.
  - Documented exact field shapes and CRUD handler contracts.
- [x] Produced UI→backend data contract and collection mapping.
- [x] Created deliverable docs: `project_overview.md`, `backend-analysis.md`, `api-status.md`, `progress.md`, `todo.md`.

### Phase 1 — Foundation (2026-08-02)

- [x] Created `src/config/index.js` — centralized env config (app, db, auth, upload, log level).
- [x] Created `src/lib/db.js` — MongoDB singleton (dev global cache) + `getClient` / `getDb` / `getCollection` / `pingDatabase` helpers.
- [x] Created `src/utils/logger.js` — level-aware logger (debug/info/warn/error, `LOG_LEVEL`).
- [x] Created `src/utils/http.js` — `ApiError`, `HttpStatus`, `ok`/`fail` response helpers (`{success,...}` convention), `asyncHandler`, `handleApiError` (incl. Mongo 11000 dup → 409).
- [x] Created `src/middlewares/errorHandler.js` — logs + delegates to `handleApiError`.
- [x] Created `src/utils/validate.js` — `requireFields`, `requirePositiveNumber`, `requireEnum`, `optionalString`, `normalizeEmail`, `readJsonBody`.
- [x] Declared `mongodb@^7.5.0` in package.json + lockfile.
- [x] **Verified live DB connection**: `ad_buzz` reachable, ping OK. Live collections found:
  `users(7)`, `adAccounts(412)`, `deposits(3)`, `balanceLogs(1175)`, `metaAdAccounts`, `metaSettings`, `site_settings`, `paymentMethods`, `supportTickets`, `syncLogs`, `syncLocks`, `counters`.
  (Note: `withdrawals`, `whatsappSettings`, `notificationLogs`, `invitationCodes`, `bankAccounts` not present yet — created lazily on first insert in old app.)
- [x] `npm run build` ✅ (21 pages, 0 errors). Node syntax check ✅ on all new files.

### Phase 2 — Auth & RBAC (2026-08-02)

- [x] **Decision: Firebase (reuse old)** — same Firebase Auth project + firebase-admin as old app; uid-based `users` collection. (User confirmed 2026-08-02.)
- [x] Copied 8 Firebase env vars (`NEXT_PUBLIC_FIREBASE_*` + `FIREBASE_ADMIN_CLIENT_EMAIL` + `FIREBASE_ADMIN_PRIVATE_KEY`) from old `ad-buzz/.env` → new `.env.local` (values never logged).
- [x] Installed `firebase@^12.13.0` + `firebase-admin@^14.1.0`.
- [x] Created `src/lib/firebaseClient.js` — client SDK init (browser), exports `auth`.
- [x] Created `src/lib/firebaseAdmin.js` — lazy admin init; `normalizePrivateKey`; credential resolution order: `FIREBASE_SERVICE_ACCOUNT_KEY` base64 → `FIREBASE_ADMIN_CLIENT_EMAIL`+`FIREBASE_ADMIN_PRIVATE_KEY` → `GOOGLE_APPLICATION_CREDENTIALS`; plus `verifyFirebaseToken`, `deleteFirebaseAuthUser`, `updateFirebaseUserPassword`.
- [x] Created `src/models/userModel.js` — `ADB5` + `counters.userId` id gen, `getUserByUid/ByEmail`, `syncAuthenticatedUser` (upsert, role `customer` default), `credit/debitUserBalance`, `canUserWithdraw`.
- [x] Created `src/lib/permissions.js` — 6 old roles, 29 perms, full matrix + helpers (`hasPermission`, `getAllowedRoutes`, `canAccessRoute`, `isStaffRole`, `getNavItemsForRole`).
- [x] Created `src/middlewares/auth.js` — `requireAuth`: Bearer `Authorization` header → `verifyFirebaseToken` → load `users` by uid → frozen-account check (403).
- [x] Created `src/middlewares/rbac.js` — `requireStaff`, `requireAdmin`, `requirePermission(perm)`.
- [x] Created `/api/auth/sync-user` — verifies Bearer token when present (falls back to body uid like old), then `syncAuthenticatedUser`.
- [x] Created `/api/auth/me` — returns user + `roleLabel` + `navItems` (from permission matrix).
- [x] Upgraded `/api/auth` stub → status endpoint (`{ provider: "firebase", configured }`).
- [x] **Verified**: `node --check` ✅ all files; `npm run build` ✅ (23 routes, 0 errors); live smoke test ✅ (`firebase-admin` initialized, `listUsers` returned real uids from prod Firebase project).

> **Note**: New UI has no login page yet — client must implement Firebase Auth (signInWithEmailAndPassword / Google) and send the ID token as `Authorization: Bearer`. `login/logout` are handled client-side by the Firebase SDK; `/api/auth/sync-user` + `/api/auth/me` are the server entry points. The old-vs-new roles question (old 6 roles vs new UI's 4 roles) remains documented in `backend-analysis.md` — backend uses old roles today since prod `users` store those values.

### Phase 3 — CRUD APIs (2026-08-02)

- [x] **Series** — `src/models/seriesModel.js`, `/api/series`, `/api/series/[id]`; seed-on-list; CRUD. `useSeries` wired.
- [x] **Cards** — `src/models/cardModel.js`, `/api/cards`, `/api/cards/[id]`, `/api/cards/load`; seed; CRUD + toggle + load (usageCount++ / totalLoadedUSD). `useCards` wired.
- [x] **Customers** — `src/models/customerModel.js`, `/api/customers`, `/api/customers/[id]`, `/favorite`, `/notes`; sync from old `users` + legacy invoices; CUST-* ids; linkage to adAccounts & invoices. `useCustomers` wired.
- [x] **Ad Accounts** — `src/models/adAccountModel.js`, `/api/ad-accounts`, `/api/ad-accounts/[id]`, `/bulk-status`; maps legacy `act_`/status schema → UI shape; Sold logic; live list (412 records). `useAdAccounts` wired.
- [x] **Vendors** — `src/models/vendorModel.js`, `/api/vendors`, `/api/vendors/[id]`; seed; CRUD (payment `/pay` endpoint still pending).
- [x] **Invoices (list)** — `src/models/invoiceModel.js`, `/api/invoices` GET; legacy-invoice sync from old deposits. `useInvoices` list wired. (Write/approve/reject/sync-topup still pending.)
- [x] Live smoke tests on `/api/cards`, `/api/vendors`, `/api/series`, `/api/ad-accounts`, `/api/customers`, `/api/invoices`.

### Phase 5 — Frontend Integration (2026-08-02, in progress)

- [x] Connected Customers / AdAccounts / Invoices-list / Cards / Vendors / Series hooks to backend APIs.
- [x] Added loading state to Customers page/view.
- [x] Added pagination (10/page, Prev/Next + page window) to **Reports** (`/reports`) and **Invoices** (`/invoices`).
- [x] Fixed **infinite re-fetch loop** — stabilized `triggerToast`/`removeToast` via `useCallback` in `AppContext.jsx` (was causing Cards/Vendors/Series to refetch every render).
- [x] Fixed **Modal focus/typing bug** — `Modal.jsx` effect now depends only on `isOpen` (was refocusing the first input on every keystroke, breaking typing in all Add/Edit modals). Auto-focus now runs only on open.

### Phase 4 — Business APIs (2026-08-03)

- [x] **Activities** — `src/models/activityModel.js` (seed + list + create), `/api/activities` GET/POST; `useActivities` rewired to `/api/activities`; `AppContext` now logs every mutation (customer, ad-account, invoice approve/reject/sync/update, card, vendor, series, setup, base-rate, payment-method) into the activity feed via wrapped handlers.
- [x] **Topups** — `listPendingTopups` in `invoiceModel.js`; `/api/topups` (GET pending list with search), `/api/topups/[id]/approve`, `/api/topups/[id]/reject`, `/api/topups/[id]/sync`; new `useTopups` hook; `src/app/topups/page.jsx` rewired.
- [x] **Insights** — `src/models/insightsModel.js` (overall/platformSpend/channelBreakdown/dailyBreakdown/approval/payment/accountLedger/avgRate), `/api/insights`.
- [x] **Reports** — `src/models/reportModel.js` (`getMonthlyReport`, `getExportRows`, `renderCSV`/`renderXLSXHtml`/`renderPDFHtml`), `/api/reports?month=`, `/api/reports/export?format=csv|xlsx|pdf`; `handleTriggerExport` in `AppContext` downloads real files (blob + content-disposition filename).
- [x] **Dashboard** — `src/models/dashboardModel.js` (`getDashboardStats` → todaySales/monthlySales/pendingTopups/pendingApprovals/activeCustomers/activeAccounts/assignedAccounts/vendorDue + recent invoices/activities), `/api/dashboard`; `useDashboard` hook; `src/app/page.jsx` rewired (falls back to `app.stats`).
- [x] `npm run build` ✅ (41 pages, 0 errors).

### Phase 5 — Frontend Integration (2026-08-03, COMPLETE)

- [x] **Shared API layer** — `src/utils/api.js` with `apiFetch` (JSON/error extraction) + `getErrorMessage` + `uploadScreenshot`. All hooks now use it (removed per-hook `apiFetch` duplication).
- [x] **Error handling for API failures** — every hook exposes `error` + `refetch` (Cards, Vendors, Series, Topups, Dashboard were missing; now consistent with Customers/AdAccounts/Invoices/Setups/Settings/Activities). New `ErrorBanner` UI component (message + Retry) wired into all 13 pages via pages → views (`error`/`onRetry` props).
- [x] **Loading states** — Customers view already had one; added a loading spinner to the Topups audit queue.
- [x] **Optimistic updates (with rollback on failure)** — customer favorite toggle, ad-account single status change, ad-account bulk status, card status toggle, card update, series update, vendor update all apply the change immediately then reconcile with the server response; on error the previous snapshot is restored and an error toast is shown.
- [x] **Payment screenshot upload flow** — implemented `POST /api/upload` (base64 data-URL → validated image (PNG/JPG/JPEG/WebP/GIF, ≤5 MB) → saved to `public/uploads/` → returns public `/uploads/...` URL). Sale checkout (`AppContext.handleExecuteSale`) now uploads the screenshot first and stores the URL on the invoice instead of embedding a data URL (falls back to embedding on upload failure so the sale is never lost).
- [x] **Verified** — `node --check` on all changed files ✅, `npm run build` ✅ (0 errors), `next lint` ✅ (no warnings), live dev-server smoke test: `/api/upload` 201 + served file 200, `/api/reports/export?format=csv` 200 (attachment), `/api/dashboard` 200, `/api/auth` 200, all 13 pages return 200.

### Phase 6 — Polish & Testing (2026-08-03, COMPLETE)

- [x] **Pure testable modules** — `src/utils/invoiceMath.js` (round2, dateOnly, detectPlatform, computePaymentStatus, invoiceNoFromLegacyId) extracted from `invoiceModel.js` (which now imports them); `src/utils/formValidation.js` (pure function validators + `validate`/`hasErrors`); `src/utils/pagination.js` (`getPagination`/`paginate`).
- [x] **Form validation with error messages** — validation on submit + inline `FieldError` under fields in Customers (add + edit), Ad Accounts (add + edit), Cards (add + edit), Invoices (edit amounts), Settings (base rate). Errors clear on change/close; submission blocked until valid.
- [x] **Confirmation dialogs** — new `src/components/ui/ConfirmDialog.jsx` (danger/warning variants, busy loading state) wired into Topups "Reject" and Settings "Delete payment method".
- [x] **Test runner infra** — `tests/load-env.mjs` (loads `.env.local`, forces `MONGODB_DB_NAME=adsbuzz_test`, registers alias loader), `tests/alias-loader.mjs` (`@/`→`src` + extension resolution + `next/server`/`next/headers` → stub), `tests/stubs/next-server.mjs` (NextResponse/NextRequest stand-in), `closeDb()` in `src/lib/db.js`, `npm test` script.
- [x] **Unit tests** (node:test) — `tests/invoiceMath.test.mjs`, `tests/formValidation.test.mjs`, `tests/pagination.test.mjs` (pure, no DB).
- [x] **Integration + E2E tests** — `tests/integration.test.mjs` (9 scenarios against temporarily-dropped `adsbuzz_test` DB): settings GET, customers create/list/invalid-email, cards register/duplicate, create-sale → approve-topup E2E, reject-topup, sync-topup, approve-404, pagination params. **30/30 tests pass.**
- [x] **Performance** — added `page`/`limit`/`total`/`totalPages` query params to GET list APIs (customers, cards, ad-accounts, invoices) via `src/utils/pagination.js`. Memoization verified present (`useMemo`/`memo`/`useCallback` in views/AppContext).
- [x] **Verified** — `npm test` ✅ (30/30), `next lint` ✅ (no errors), `npm run build` ✅ (0 errors).

---

## Known Issues / Decisions Pending

1. ~~**Auth approach** — Firebase (reuse old) vs JWT.~~ **RESOLVED: Firebase (reuse old).** Phase 2 complete.
2. **Database confirmed** — `MONGODB_DB_NAME=ad_buzz` (shared prod DB) verified reachable. Live data read is safe.
3. **Customers** — ✅ resolved: dedicated `customers` collection + `syncCustomersFromUsers` (from old `users`).
4. **Invoices/cards/vendors/series/setups/activities** — ✅ new collections created: `invoices`, `cards`, `vendors`, `series` (+ legacy invoice sync). `saleSetups`, `activities` still pending.
5. **Historical data** — ✅ resolved: live production data read (412 ad accounts, synced customers/invoices).
6. **Roles** — backend uses old roles (admin/staff/customer) since prod `users` store those; new UI roles (Admin/Sales Manager/Operations Manager/Finance Auditor) still open — see `backend-analysis.md`.
7. **Export format** — ✅ RESOLVED: CSV / XLSX (HTML table) / PDF (HTML) via `/api/reports/export?format=csv|xlsx|pdf`, wired to Reports page download buttons.
8. **Login UI** — new project has no login page yet; client-side Firebase Auth + Bearer token still open (client work, backend `/api/auth/*` ready).

---

## Current Focus

**Next tasks:** Phase 7 deployment — production database config, monitoring/logging, deploy (Vercel / custom server), final docs update.

### Completed this session (Phase 6)
- Form validation (`src/utils/formValidation.js` + inline `FieldError`) wired into Customers, Ad Accounts, Cards, Invoices, and Settings modals.
- `ConfirmDialog` component wired into destructive actions (Topups reject, Settings delete payment method).
- Test infrastructure: node:test runner with `@/` alias loader, `next/server` stub, and an isolated `adsbuzz_test` database.
- 16 unit tests (invoiceMath, formValidation, pagination) + 9 integration/E2E API tests (create-sale → approve-topup flow, reject, sync, validation, pagination) — **30/30 passing via `npm test`.**
- Server-side pagination (`page`/`limit`) on customers/cards/ad-accounts/invoices list APIs via `src/utils/pagination.js`.
- `npm run build` ✅ (0 errors), `npm run lint` ✅ (no errors).
