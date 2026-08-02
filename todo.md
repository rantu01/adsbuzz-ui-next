# Todo List — AdsBuzz ERP Backend

> Living checklist. Completed tasks are never deleted — only marked complete.
> Last updated: 2026-08-01

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

## Phase 3 — CRUD APIs (page by page)

### Settings (no deps)
- [ ] GET /api/settings
- [ ] PUT /api/settings
- [ ] PUT /api/settings/base-rate
- [ ] POST /api/settings/payment-methods
- [ ] DELETE /api/settings/payment-methods/[name]
- [ ] Wire useSettings → API
- [ ] Testing + docs update

### Series (no deps)
- [ ] GET/POST /api/series
- [ ] PUT /api/series/[id]
- [ ] Wire useSeries → API
- [ ] Testing + docs update

### Cards (no deps)
- [ ] GET/POST /api/cards
- [ ] PUT /api/cards/[id]
- [ ] PATCH /api/cards/[id]/toggle
- [ ] PATCH /api/cards/[id]/load (applyCardLoad)
- [ ] Wire useCards → API
- [ ] Testing + docs update

### Customers (no deps) — recommended reference pattern
- [ ] GET /api/customers (list + search + status/favorite filters + pagination)
- [ ] POST /api/customers (CUST-* id generation)
- [ ] GET /api/customers/[id]
- [ ] PUT /api/customers/[id]
- [ ] PATCH /api/customers/[id]/favorite
- [ ] PATCH /api/customers/[id]/notes
- [ ] Customer ↔ AdAccount linkage (assignedCustomer / userGroupCode)
- [ ] Customer ↔ Invoice linkage (customerId / groupId)
- [ ] Validation
- [ ] Auth + authorization
- [ ] Loading + error handling
- [ ] Wire useCustomers → API
- [ ] Testing + docs update

### Ad Accounts (deps: Cards, Series, Customers)
- [ ] GET /api/ad-accounts (search/platform/status/assignment/series filters + pagination)
- [ ] POST /api/ad-accounts
- [ ] PUT /api/ad-accounts/[id]
- [ ] PATCH /api/ad-accounts/[id]/status
- [ ] PATCH /api/ad-accounts/bulk-status
- [ ] Derived Sold status logic (getEffectiveAccountStatus)
- [ ] Wire useAdAccounts → API
- [ ] Testing + docs update

### Vendors (no deps)
- [ ] GET/POST /api/vendors
- [ ] PUT /api/vendors/[id]
- [ ] POST /api/vendors/[id]/pay (paymentHistory)
- [ ] Wire useVendors → API
- [ ] Testing + docs update

### Sale Setups (deps: Ad Accounts)
- [ ] GET/POST /api/sale-setups
- [ ] PUT /api/sale-setups/[id]
- [ ] Wire useSaleSetups → API
- [ ] Testing + docs update

### Invoices (deps: Customers, Ad Accounts)
- [ ] GET /api/invoices (list + search + paymentStatus filter)
- [ ] POST /api/invoices (create sale — full transactional flow)
- [ ] GET /api/invoices/[id]
- [ ] PUT /api/invoices/[id]
- [ ] PATCH /api/invoices/[id]/approve
- [ ] PATCH /api/invoices/[id]/reject
- [ ] PATCH /api/invoices/[id]/sync-topup
- [ ] Wire useInvoices → API
- [ ] Testing + docs update

---

## Phase 4 — Business Logic APIs

### Topups (deps: Invoices)
- [ ] GET /api/topups (pending: approvalStatus Pending OR topupStatus Pending)
- [ ] PATCH /api/topups/[id]/approve
- [ ] PATCH /api/topups/[id]/reject
- [ ] POST /api/topups/[id]/sync
- [ ] Wire TopupsView → API
- [ ] Testing + docs update

### Insights
- [ ] GET /api/insights (platform spend, account analyzer, gateway breakdown)
- [ ] Wire InsightsView → API
- [ ] Testing + docs update

### Reports
- [ ] GET /api/reports?month=YYYY-MM (6 metrics + ledger rows)
- [ ] GET /api/reports/export?month=&format=csv|xlsx|pdf
- [ ] Wire ReportsView → API
- [ ] Testing + docs update

### Activities
- [ ] GET/POST /api/activities
- [ ] Wire useActivities → API (addActivity calls on every mutation)
- [ ] Testing + docs update

### Dashboard
- [ ] GET /api/dashboard (aggregate stats)
- [ ] Wire DashboardView → API
- [ ] Testing + docs update

---

## Phase 5 — Frontend Integration

- [ ] Replace all seed-data hooks with API calls (AppContext)
- [ ] Add loading states to all views
- [ ] Add error handling for API failures
- [ ] Add optimistic updates
- [ ] Implement payment screenshot upload flow
- [ ] Full build + lint verification
- [ ] End-to-end manual test of every page

---

## Phase 6 — Polish & Testing

- [ ] Form validation with error messages
- [ ] Confirmation dialogs for destructive actions
- [ ] Unit tests for services
- [ ] Integration tests for API routes
- [ ] E2E tests for critical flows (create sale, approve topup)
- [ ] Performance (pagination, memoization)

---

## Phase 7 — Deployment

- [ ] Production database config
- [ ] Monitoring & logging
- [ ] Deploy (Vercel / custom server)
- [ ] Final docs update
