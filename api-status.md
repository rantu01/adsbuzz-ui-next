# API Status — AdsBuzz ERP Backend

> Generated during **Phase 0**. Live status matrix for all backend endpoints.
> Legend: 🟦 Planned (to build) · 🟨 Partial (needs review/port) · 🟩 Complete · ⬜ Not required
> Last updated: 2026-08-02

---

## 1. Build Status Summary

| Area | Old project has | New UI needs | New backend status |
|---|---|---|---|
| **Foundation (Phase 1)** | — | — | 🟩 config, db, logger, http, errorHandler, validate |
| **Auth (Phase 2)** | ✅ Firebase | ⬜ no login UI yet | 🟩 Firebase client+admin, sync-user, me, RBAC |
| Dashboard | ✅ `/api/user/dashboard` | ✅ `/` aggregates | 🟦 |
| Customers | ⚠️ `users` only | ✅ full CRM | 🟦 (Phase 1 candidate) |
| Ad Accounts | ✅ full | ✅ full | 🟦 |
| Invoices/Sales | ⚠️ deposits+balanceLogs | ✅ full | 🟦 |
| Topups | ⚠️ deposits approval | ✅ approve/reject/sync | 🟦 |
| Cards | ⚠️ paymentMethods | ✅ full | 🟦 |
| Vendors | ❌ none | ✅ full | 🟦 (new collection) |
| Series | ❌ none | ✅ full | 🟦 (new collection) |
| Sale Setups | ❌ none | ✅ full | 🟦 (new collection) |
| Reports | ✅ reportService | ✅ 6-metric report + export | 🟦 |
| Insights | ⚠️ top-up-insights | ✅ charts/analyzer | 🟦 |
| Settings | ✅ site_settings | ✅ company/payment/roles | 🟦 |
| Activities | ⚠️ logs | ✅ feed | 🟦 (new collection) |
| Upload | ❌ none | ✅ screenshot | 🟦 |

**Overall: Phase 1 (Foundation) + Phase 2 (Auth & RBAC) COMPLETE. No business endpoints built yet.**

### Phase 1 foundation files (🟩 Complete)

| File | Purpose |
|---|---|
| `src/config/index.js` | Env config (app, db, auth, upload, logLevel) |
| `src/lib/db.js` | Mongo singleton + `getClient`/`getDb`/`getCollection`/`pingDatabase` |
| `src/utils/logger.js` | Level-aware logger |
| `src/utils/http.js` | `ApiError`, `HttpStatus`, `ok`/`fail`, `asyncHandler`, `handleApiError` |
| `src/middlewares/errorHandler.js` | Error middleware |
| `src/utils/validate.js` | `requireFields`, `requirePositiveNumber`, `requireEnum`, `optionalString`, `normalizeEmail`, `readJsonBody` |

### Phase 2 auth & RBAC files (🟩 Complete)

| File | Purpose |
|---|---|
| `src/lib/firebaseClient.js` | Client Firebase SDK init + `auth` (browser) |
| `src/lib/firebaseAdmin.js` | Admin SDK init, `normalizePrivateKey`, `verifyFirebaseToken`, `deleteFirebaseAuthUser`, `updateFirebaseUserPassword` |
| `src/models/userModel.js` | ADB5 id gen (`counters.userId`), `syncAuthenticatedUser`, `getUserByUid/ByEmail`, balance helpers |
| `src/lib/permissions.js` | 6 roles × 29 perms matrix + `hasPermission`/`getAllowedRoutes`/`canAccessRoute`/`isStaffRole`/`getNavItemsForRole` |
| `src/middlewares/auth.js` | `requireAuth` (Bearer ID-token verify → user → frozen check) |
| `src/middlewares/rbac.js` | `requireStaff` / `requireAdmin` / `requirePermission` |
| `src/app/api/auth/sync-user/route.js` | POST sync (token-verified) |
| `src/app/api/auth/me/route.js` | GET current user + roleLabel + navItems |
| `src/app/api/auth/route.js` | GET status endpoint (`{ provider: "firebase", configured }`) |

---

## 2. Planned API Matrix (target — from `docs/api_list.md`)

### Customers
| Method | Endpoint | Description | Status |
|---|---|---|---|
| GET | `/api/customers` | List all customers (search/filter/pagination) | 🟦 |
| POST | `/api/customers` | Create customer (generate CUST-* id) | 🟦 |
| GET | `/api/customers/[id]` | Get customer by id | 🟦 |
| PUT | `/api/customers/[id]` | Update customer | 🟦 |
| PATCH | `/api/customers/[id]/favorite` | Toggle favorite | 🟦 |
| PATCH | `/api/customers/[id]/notes` | Update notes | 🟦 |

### Ad Accounts
| Method | Endpoint | Description | Status |
|---|---|---|---|
| GET | `/api/ad-accounts` | List (search/platform/status/assignment/series filters) | 🟦 |
| POST | `/api/ad-accounts` | Create ad account | 🟦 |
| PUT | `/api/ad-accounts/[id]` | Update | 🟦 |
| PATCH | `/api/ad-accounts/[id]/status` | Update status (sold/available/etc.) | 🟦 |
| PATCH | `/api/ad-accounts/bulk-status` | Bulk update status | 🟦 |

### Invoices
| Method | Endpoint | Description | Status |
|---|---|---|---|
| GET | `/api/invoices` | List all invoices | 🟦 |
| POST | `/api/invoices` | Create invoice (sale) — full sales flow | 🟦 |
| GET | `/api/invoices/[id]` | Get invoice | 🟦 |
| PUT | `/api/invoices/[id]` | Update invoice (edit modal) | 🟦 |
| PATCH | `/api/invoices/[id]/approve` | Approve → Approved + Paid | 🟦 |
| PATCH | `/api/invoices/[id]/reject` | Reject → Rejected + Due | 🟦 |
| PATCH | `/api/invoices/[id]/sync-topup` | Sync topup status | 🟦 |

### Cards
| Method | Endpoint | Description | Status |
|---|---|---|---|
| GET | `/api/cards` | List all cards | 🟦 |
| POST | `/api/cards` | Create card | 🟦 |
| PUT | `/api/cards/[id]` | Update card | 🟦 |
| PATCH | `/api/cards/[id]/toggle` | Toggle Active/Disable | 🟦 |
| PATCH | `/api/cards/[id]/load` | Apply card load (usageCount+1, totalLoadedUSD+amt) | 🟦 |

### Vendors
| Method | Endpoint | Description | Status |
|---|---|---|---|
| GET | `/api/vendors` | List vendors | 🟦 |
| POST | `/api/vendors` | Create vendor (VEND-* id) | 🟦 |
| PUT | `/api/vendors/[id]` | Update vendor | 🟦 |
| POST | `/api/vendors/[id]/pay` | Record payment (paymentHistory push) | 🟦 |

### Series
| Method | Endpoint | Description | Status |
|---|---|---|---|
| GET | `/api/series` | List series | 🟦 |
| POST | `/api/series` | Create series | 🟦 |
| PUT | `/api/series/[id]` | Update series (status etc.) | 🟦 |

### Sale Setups
| Method | Endpoint | Description | Status |
|---|---|---|---|
| GET | `/api/sale-setups` | List setups | 🟦 |
| POST | `/api/sale-setups` | Create setup | 🟦 |
| PUT | `/api/sale-setups/[id]` | Update setup (key: groupId+adAccountId) | 🟦 |

### Settings
| Method | Endpoint | Description | Status |
|---|---|---|---|
| GET | `/api/settings` | Get settings (public) | 🟦 |
| PUT | `/api/settings` | Update full settings | 🟦 |
| PUT | `/api/settings/base-rate` | Update defaultDollarRate | 🟦 |
| POST | `/api/settings/payment-methods` | Add payment method | 🟦 |
| DELETE | `/api/settings/payment-methods/[name]` | Delete payment method | 🟦 |

### Topups (Financial Audit)
| Method | Endpoint | Description | Status |
|---|---|---|---|
| GET | `/api/topups` | List pending (approvalStatus Pending OR topupStatus Pending) | 🟦 |
| PATCH | `/api/topups/[id]/approve` | Approve invoice | 🟦 |
| PATCH | `/api/topups/[id]/reject` | Reject invoice | 🟦 |
| POST | `/api/topups/[id]/sync` | Sync topup status with ad platform | 🟦 |

### Insights & Reports
| Method | Endpoint | Description | Status |
|---|---|---|---|
| GET | `/api/insights` | Aggregated dashboard data (platform spend, top accounts) | 🟦 |
| GET | `/api/reports?month=YYYY-MM` | Monthly report metrics | 🟦 |
| GET | `/api/reports/export?month=YYYY-MM&format=csv\|xlsx\|pdf` | Export report | 🟦 |

### Activities
| Method | Endpoint | Description | Status |
|---|---|---|---|
| GET | `/api/activities` | Recent activities feed | 🟦 |
| POST | `/api/activities` | Log an activity | 🟦 |

### Dashboard
| Method | Endpoint | Description | Status |
|---|---|---|---|
| GET | `/api/dashboard` | Aggregate stats (todaySales, monthlySales, pendingTopups, pendingApprovals, activeCustomers, activeAccounts, assignedAccounts, vendorDue) + recent activities | 🟦 |

### Auth
| Method | Endpoint | Description | Status |
|---|---|---|---|
| GET | `/api/auth` | Status (provider, configured) | 🟩 |
| POST | `/api/auth/sync-user` | Sync Firebase user to `users` collection (Bearer-verified) | 🟩 |
| GET | `/api/auth/me` | Current user + roleLabel + navItems | 🟩 |
| POST | `/api/auth/login` | Login — client-side via Firebase SDK (no server route needed) | 🟦 n/a |
| POST | `/api/auth/logout` | Logout — client-side via Firebase SDK | 🟦 n/a |

> **Auth design**: Firebase Auth (Email/Password + Google OAuth) as in old app. Client calls `signInWithEmailAndPassword`/Google, then `/api/auth/sync-user` (sends ID token as `Authorization: Bearer`). Server verifies with firebase-admin `verifyIdToken` and reads the user from `users` (by `uid`). Route protection uses `requireAuth` / `requireStaff` / `requireAdmin` / `requirePermission`.

### Upload
| Method | Endpoint | Description | Status |
|---|---|---|---|
| POST | `/api/upload` | Payment screenshot upload (returns URL/data URL) | 🟦 |

---

## 3. Existing Stubs (new project) — replacement map

| Stub | Will be replaced by |
|---|---|
| `src/app/api/users/route.js` | `/api/customers` (Phase 1) |
| `src/app/api/admin/route.js` | admin-only aggregate endpoints |
| `src/app/api/auth/route.js` | `/api/auth/*` when auth decided |
| `src/app/api/tasks/route.js` | `/api/topups/*` or `/api/activities` |
| `src/app/api/upload/route.js` | `/api/upload` |

---

## 4. Old-project Endpoints (reference — available for porting)

These exist in `ad-buzz` and are the reference implementation for equivalent new endpoints.

### Public / User
- `POST /api/auth/sync-user`
- `GET /api/user/dashboard?uid=`
- `GET|PATCH /api/user/profile`
- `POST /api/user/deposit`, `GET /api/user/deposit?uid=`
- `POST /api/user/withdrawal`, `GET /api/user/withdrawal?uid=`
- `GET /api/user/balance-logs`, `GET /api/user/balance-logs/export`
- `GET|POST /api/user/ad-accounts`, `POST /api/user/ad-accounts/top-up`, `GET /api/user/ad-accounts/history`
- `GET|POST /api/user/support-tickets`, `PATCH /api/user/support-tickets`
- `GET|POST /api/user/bank-accounts`
- `GET /api/settings` (public)

### Admin
- `GET|PATCH /api/admin/users`, `POST /api/admin/create-user`, `DELETE /api/admin/users`
- `GET|PATCH /api/admin/deposits`
- `GET|PATCH /api/admin/withdrawals`
- `GET /api/admin/balance-logs`
- `GET|POST|PATCH|DELETE /api/admin/ad-accounts`, `POST /api/admin/ad-accounts/assign`, `POST /api/admin/ad-accounts/top-up`
- `GET|PATCH /api/admin/support-tickets`
- `GET /api/admin/reports`, `GET /api/admin/reports/export`
- `GET|PUT /api/admin/meta-api`, `POST /api/admin/meta-api/sync`
- `GET|PUT /api/admin/settings`
- `GET|PUT /api/admin/whatsapp`, `POST /api/admin/whatsapp/test`, `GET /api/admin/whatsapp/logs`
- `GET|POST /api/admin/payment-methods`, `POST /api/admin/payment-methods/assign`
- `GET /api/admin/top-up-insights`
- `GET|POST /api/admin/invitations`

### Cron
- `GET|POST /api/cron/sync`
- `GET|POST /api/cron/meta-fetch`

---

## 5. Response Convention (adopt in new project)

- Success: `{ success: true, <data> }`
- Error: `{ success: false, message: "..." }` with HTTP 400/401/403/404/409/429/500
- File downloads: raw file with `Content-Disposition: attachment`
- List pagination (where used): `{ items|rows, total, page, limit, totalPages }`
- Authz denial: 403; missing required input: 400; not found: 404

---

## 6. Per-Page API Requirements (UI-driven)

### Dashboard `/`
- GET `/api/dashboard` → stats + recent invoices (5) + activities (5) + platform counts (derived client-side).
- Charts in UI are mostly client-derived from lists; a single aggregate endpoint suffices.

### Customers `/customers`
- GET list (search by name/company/email/groupId, status filter, favorites filter, pagination).
- POST create (id `CUST-*`, zero balances).
- PUT update; PATCH favorite; PATCH notes.
- Derived: assigned accounts (assignedCustomer|userGroupCode match), invoices (customerId|groupId match), totals.

### Sales `/sales`
- POST sale → create invoice (invoiceNo `ADB 202416XXX`) + mark account sold + apply customer credit + apply card load + log activity + navigate home. Should be **one transactional endpoint** to avoid partial writes.
- GET customers/accounts/settings for dropdowns.

### Sale Setup `/sale-setup`
- GET/POST/PUT `/api/sale-setups`.

### Topups `/topups`
- GET pending list; PATCH approve/reject; POST sync.

### Ad Accounts `/ad-accounts`
- GET list with filters (search name/id/group, platform, status, assignment, series).
- POST create; PUT update; PATCH status; PATCH bulk-status; derived `Sold` status.

### Series / Cards / Vendors `/series`, `/cards`, `/vendors`
- Straight CRUD endpoints per matrix.

### Reports `/reports`
- GET `/api/reports?month=` → monthly metrics (total/avg sell, ad topup, avg per USD, approval & payment statuses, company summary, ledger rows).

### Insights `/insights`
- GET `/api/insights` → platform spend, account analyzer ledger, gateway breakdown, early-stage data (hardcoded in UI for now).

### Invoices `/invoices`
- GET list (search invoiceNo/groupId/accountName, paymentStatus filter, month detection).
- PUT update; approve/reject/sync-topup.

### Settings `/settings`
- GET/PUT `/api/settings`; PUT base-rate; POST/DELETE payment-methods.

---

## 7. Notes for Implementers

1. Build **page by page**; do not scaffold the whole backend at once.
2. Each page = DB + API + validation + auth + authz + loading + error handling + pagination + search + filters + CRUD, fully complete before next page.
3. Keep UI identical — only swap hook internals from local state to fetch calls.
4. Reuse old collections for shared data; create new collections only where the old project has no equivalent (vendors, series, saleSetups, activities, invoices, cards).
5. Reuse old business logic where possible (balance integrity, spend-cap updates, notifications) adapted to new shapes.
6. Update this file after every completed endpoint.
7. Foundation utilities to use in every route: `@/lib/db` (`getDb`/`getCollection`), `@/utils/http` (`ok`/`fail`/`ApiError`/`asyncHandler`), `@/utils/validate`, `@/middlewares/errorHandler`, `@/utils/logger`, `@/config`.
