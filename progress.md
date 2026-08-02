# Progress Report — AdsBuzz ERP Backend

> Last updated: 2026-08-02
> Current phase: **Phase 3 (CRUD APIs) — MOSTLY COMPLETE. Phase 4/5 in progress. Next: finish Invoices write flow, remaining Phase 4 business APIs.**

---

## Summary

| Phase | Description | Status |
|---|---|---|
| Phase 0 | Analysis of old project + new UI + mapping + docs | ✅ Complete |
| Phase 1 | Foundation (DB connection, config, folder structure) | ✅ Complete |
| Phase 2 | Auth & RBAC | ✅ Complete |
| Phase 3 | CRUD APIs (Series, Cards, Customers, Ad Accounts, Vendors) | ✅ Mostly complete |
| Phase 4 | Business APIs (Topups, Insights, Reports, Export, Activities, Dashboard) | ⬜ Not started |
| Phase 5 | Frontend integration (swap seed data → API calls) | 🔶 In progress |
| Phase 6 | Polish & testing | ⬜ Not started |
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

---

## Known Issues / Decisions Pending

1. ~~**Auth approach** — Firebase (reuse old) vs JWT.~~ **RESOLVED: Firebase (reuse old).** Phase 2 complete.
2. **Database confirmed** — `MONGODB_DB_NAME=ad_buzz` (shared prod DB) verified reachable. Live data read is safe.
3. **Customers** — ✅ resolved: dedicated `customers` collection + `syncCustomersFromUsers` (from old `users`).
4. **Invoices/cards/vendors/series/setups/activities** — ✅ new collections created: `invoices`, `cards`, `vendors`, `series` (+ legacy invoice sync). `saleSetups`, `activities` still pending.
5. **Historical data** — ✅ resolved: live production data read (412 ad accounts, synced customers/invoices).
6. **Roles** — backend uses old roles (admin/staff/customer) since prod `users` store those; new UI roles (Admin/Sales Manager/Operations Manager/Finance Auditor) still open — see `backend-analysis.md`.
7. **Export format** — CSV only vs XLSX/PDF.
8. **Login UI** — new project has no login page yet; client-side Firebase Auth + Bearer token needed during Phase 5.

---

## Current Focus

**Next tasks:** Finish remaining Phase 3/4 work (Invoices write flow, Vendors pay, Settings, Sale Setups, Topups, Insights, Reports/export, Activities, Dashboard), then complete Phase 5 frontend wiring + Phase 6 polish.

### Completed this session
- Live MongoDB integration for **Series, Cards, Customers, Vendors, Ad Accounts** (list Invoices).
- Customers view rewrite with loading state.
- Pagination on **Reports** & **Invoices** pages.
- Bug fixes: infinite re-fetch loop; Modal typing/focus bug (all modals).
- Uncommitted changes summarized in `report.md`.
