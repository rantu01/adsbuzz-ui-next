# Progress Report — AdsBuzz ERP Backend

> Last updated: 2026-08-02
> Current phase: **Phase 2 (Auth & RBAC) — COMPLETE. Next: Phase 3 (CRUD APIs) — awaiting instruction.**

---

## Summary

| Phase | Description | Status |
|---|---|---|
| Phase 0 | Analysis of old project + new UI + mapping + docs | ✅ Complete |
| Phase 1 | Foundation (DB connection, config, folder structure) | ✅ Complete |
| Phase 2 | Auth & RBAC | ✅ Complete |
| Phase 3 | CRUD APIs (Settings→Series→Cards→Customers→Ad Accounts→Vendors→Sale Setups→Invoices) | ⬜ Not started |
| Phase 4 | Business APIs (Topups, Insights, Reports, Export, Activities, Dashboard) | ⬜ Not started |
| Phase 5 | Frontend integration (swap seed data → API calls) | ⬜ Not started |
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

---

## Known Issues / Decisions Pending

1. ~~**Auth approach** — Firebase (reuse old) vs JWT.~~ **RESOLVED: Firebase (reuse old).** Phase 2 complete.
2. **Database confirmed** — `MONGODB_DB_NAME=ad_buzz` (shared prod DB) verified reachable. Live data read is safe.
3. **Customers** — new `customers` collection vs extending old `users`.
4. **Invoices/cards/vendors/series/setups/activities** — need new collections (old has no equivalents).
5. **Historical data** — show old production records on first launch vs start fresh.
6. **Roles** — backend uses old roles (admin/staff/customer) since prod `users` store those; new UI roles (Admin/Sales Manager/Operations Manager/Finance Auditor) still open — see `backend-analysis.md`.
7. **Export format** — CSV only vs XLSX/PDF.
8. **Login UI** — new project has no login page yet; client-side Firebase Auth + Bearer token needed during Phase 5.

---

## Current Focus

**Next task (awaits explicit instruction):** Phase 3 — CRUD APIs. Suggested entry point (from docs/todo.md note): implement **Customers** page end-to-end first as the reference pattern, since it has no dependencies.
