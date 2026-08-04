# Backend Analysis — AdsBuzz (Old Project Reference + New UI Contract)

> Generated during **Phase 0**. This document is the definitive reference for re-implementing the backend.
> Old project (read-only): `D:\Code\Project\Office Work\AD accont\ad-buzz`
> New project: `D:\Code\Project\Office Work\AD accont\adsbuzz-ui-next`

---

## PART A — OLD PROJECT ANALYSIS (ad-buzz)

### A1. Tech Stack & Entry Points

- Next.js **16.2.7** (App Router), React 19.2.4, plain JS (`.js`), ESM.
- MongoDB **7** via native `mongodb` ^7.2.0 driver (`lib/mongodb.js` singleton).
- Firebase client (`firebase` ^12.13.0) + Firebase Admin (`firebase-admin` ^14.1.0).
- Meta Graph API **v22.0**, WhatsApp Cloud API **v22.0**.
- `scripts/resetCounter.js` — manual utility to repair `ADB5` user id counters.

### A2. Environment Variables (names only — values redacted)

Single `.env` file at old-project root. No `.env.example`/`.env.local`.

| Variable | Used by |
|---|---|
| `MONGODB_URI` | `lib/mongodb.js`, `scripts/resetCounter.js` |
| `MONGODB_DB_NAME` | All models/routes (fallback default `ad_buzz`; `lib/userModel.js` fallback `adBuzz`) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `lib/firebaseClient.js`, `admin/create-user` route |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `lib/firebaseClient.js` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `lib/firebaseClient.js`, `lib/firebaseAdmin.js` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `lib/firebaseClient.js` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `lib/firebaseClient.js` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `lib/firebaseClient.js` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | `lib/firebaseAdmin.js` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | `lib/firebaseAdmin.js` (multi-line PEM, normalized in code) |

Referenced but optional/absent from `.env`:
- `FIREBASE_SERVICE_ACCOUNT_KEY` (base64 JSON service account)
- `GOOGLE_APPLICATION_CREDENTIALS` (default ADC)
- `CRON_SECRET` (Bearer token for cron; empty ⇒ cron auth bypassed)

### A3. Database (MongoDB)

- **Database name:** `MONGODB_DB_NAME` (fallback `ad_buzz`; `userModel.js` fallback `adBuzz`).
- **Collections & fields:**

**`users`** (userModel.js)
```
uid, email (lowercase), displayName, phoneNumber,
role (admin|technical_manager|key_manager|accounts_manager|support_executive|customer),
availableBalance, totalEarned, accountStatus (active|frozen), isFrozen,
groupName, numericId, customId (ADB5xxxx), dollarRate,
accountType (main|demo), isDemoAccount, password (never stored; excluded via projection),
createdAt, updatedAt, lastLoginAt
```

**`counters`** — `{_id:"userId", seq}` and `{_id:"ticketId", seq}`; atomically incremented for `ADB5` user IDs and `ADT` ticket IDs.

**`adAccounts`** (adAccountModel.js)
```
uid, email, name, accountId (AD_<8 chars>, manually-unique),
metaAccountId (act_...), metaAccountName, currency (USD),
spendCap (dollars; source of truth for budget), budget (deprecated), status,
spent, assignedBy, assignedAt, unassignedAt (null = active), lastSyncedAt,
syncStatus (pending|synced|error), syncError, syncSource (local_topup|admin_topup|admin_manual),
lastInsights {impressions,clicks,cpc,ctr,cpm,dateStart,dateEnd}, createdAt, updatedAt
```

**`metaAdAccounts`** (cache from Meta, wholesale-replaced each fetch)
```
metaAccountId, name, accountStatus (numeric), currency, balance,
spendCap, amountSpent, disableReason, importedAt
```

**`metaSettings`** — single doc `_id:"global"`: `accessToken, businessManagerId, appId, autoSyncEnabled, updatedAt`.

**`whatsappSettings`** — single doc `_id:"global"`: `enabled, phoneNumberId, businessAccountId, accessToken, notifyOnDeposit, notifyOnWithdrawal, notifyOnBalanceFreeze, updatedAt`.

**`site_settings`** — single doc `_id:"global"`: `siteName, primaryColor, secondaryColor, logo, dollarRate`.

**`deposits`** — `uid, email, amount, amountBDT, account, transactionRef, creditedUSD, paymentMethod, screenshot(base64), status(pending|approved|rejected), createdAt, approvedAt, rejectedAt, rejectionReason, approverUid`.

**`withdrawals`** — `uid, email, walletAddress, amount, status(pending|approved|rejected), createdAt, approvedAt, rejectedAt, rejectionReason, approverUid`.

**`balanceLogs`** — `uid, email, type(deposit|withdrawal|admin|ad_account_topup), amount(signed), balanceBefore, balanceAfter, description, referenceId, referenceType(deposit|withdrawal|ad_account), metadata{}, createdAt`.

**`bankAccounts`** — `uid, bankName, accountName, accountNumber, branch, referenceId, shortCode, color, createdAt`.

**`paymentMethods`** — type `bank`|`mobile-banking`; shared: `type, shortCode, color, assignedUids[], createdAt, updatedAt`; bank: `bankName, accountName, accountNumber, branch, referenceId, logo`; mobile: `walletName, walletNo, accountType, paymentInstructions, referenceId, walletLogo`.

**`supportTickets`** — `ticketId(ADT...), uid, email, subject, message, adAccountId, adAccountMetaId, adAccountName, status(open|replied|in_progress|closed), replies[{text,by,role,createdAt}], createdAt, updatedAt, closedAt`.

**`syncLogs`** — `type(info|success|warning|error), message, details, duration, createdAt` (kept ≤ 15).

**`syncLocks`** — `name (unique), locked, lockedAt, expiresAt` (TTL: meta_sync 300s, auto_meta_sync 60s).

**`notificationLogs`** — `type(sent|error|skipped), channel(whatsapp), phone, message, reason, meta, uid, createdAt`.

**`invitationCodes`** — `code(8-char), isActive, createdByUid, createdByEmail, createdByName, usedByUid, usedByEmail, usedAt, createdAt, updatedAt`.

**Indexes:** only `syncLocks.name` unique (created at runtime). All other uniqueness is app-level `findOne` checks.

### A4. Authentication

**Client side**
- `lib/firebaseClient.js` — Firebase web app from `NEXT_PUBLIC_FIREBASE_*`; exports `auth` singleton.
- `app/Component/Auth/AuthProvider.jsx` — `onAuthStateChanged` context exposing `{user, loading, logout}`.
- `app/Component/Auth/LoginForm.jsx` — `signInWithEmailAndPassword`, then `completeAuthFlow`.
- `lib/authUtils.js`:
  - `syncUserProfile(user)` → POST `/api/auth/sync-user`
  - `getDashboardPath(uid)` → GET `/api/user/dashboard?uid=`; staff roles → `/admin`, else `/user-dashboard`
  - `completeAuthFlow(user, onSuccess)` → sync + redirect
  - `getAuthErrorMessage(err)` — maps Firebase error codes

**Server side (IMPORTANT — weak security in old project)**
- Most API routes accept `uid` from query/body and **trust it** — no Firebase ID-token verification.
- Real server-side authz only in:
  - `/api/admin/settings` — `requireAdmin` (x-user-id header or callerUid body, role must be `admin`)
  - `/api/admin/users` PATCH/DELETE — callerUid role checks
  - cron routes — Bearer `CRON_SECRET` (skipped if unset)
- `lib/firebaseAdmin.js` — lazy singleton; credential resolution order: `FIREBASE_SERVICE_ACCOUNT_KEY` (base64) → `FIREBASE_ADMIN_CLIENT_EMAIL`+`FIREBASE_ADMIN_PRIVATE_KEY` → `GOOGLE_APPLICATION_CREDENTIALS` ADC. Helpers: `deleteFirebaseAuthUser(uid)`, `updateFirebaseUserPassword(uid, newPassword)`.

### A5. Roles & Permissions (`lib/permissions.js`)

Roles: `admin`, `technical_manager`, `key_manager`, `accounts_manager`, `support_executive`, `customer`.
`ROLE_LABELS` for display names.

Permission strings (29 total): `view_ad_accounts, manage_ad_accounts, assign_ad_accounts, view_ad_insights, view_topup_insights, view_topup_records, view_users, create_users, manage_user_roles, manage_user_balance, view_deposits, approve_deposits, reject_deposits, view_withdrawals, approve_withdrawals, reject_withdrawals, view_tickets, manage_tickets, view_balance_logs, view_reports, view_payment_methods, manage_payment_methods, view_settings, manage_settings, view_meta_api, manage_meta_api, view_whatsapp, manage_whatsapp, unlimited_balance, view_ad_accounts_topup`.

Matrix:
- **admin** — all permissions.
- **technical_manager** — view_ad_accounts, view_ad_insights, view_topup_records, view_tickets, manage_tickets.
- **key_manager** & **accounts_manager** (identical) — most operational perms incl. manage ad accounts, assign, users view/create, user balance, deposits/withdrawals approve/reject, payment methods, balance logs, tickets, `unlimited_balance`, view_ad_accounts_topup.
- **support_executive** — view_ad_accounts, view_ad_insights, view_tickets, manage_tickets.
- **customer** — none.

Helpers: `hasPermission(role, perm)`, `getAllowedRoutes(role)`, `canAccessRoute(role, route)`, `isStaffRole(role)`, `getNavItemsForRole(role)`.
Admin routes → allowed route keys: deposits, withdrawals, ad-accounts, user-management, support-tickets, payment-methods, balance-logs, reports, meta-api, whatsapp, settings, top-up-insights, ad-accounts-topup.

### A6. API Route Inventory (old project) — summary of each

**Auth/Sync**
- `POST /api/auth/sync-user` — body `{uid,email,displayName,phoneNumber}`; upserts user (`role:customer`, balance 0, counters for numericId/customId ADB5xxxx), sets lastLoginAt. → `{success, user}`

**Dashboard**
- `GET /api/user/dashboard?uid=` → `{success, dashboard:{uid,availableBalance,totalEarned,role,accountStatus,accountType,isDemoAccount,displayName,email,dollarRate}}`

**Profile**
- `GET /api/user/profile?uid=` → user; `PATCH` `{uid,displayName,phoneNumber}` → update.

**Deposits**
- `POST /api/user/deposit` `{uid,email,amount,...}` → pending deposit (screenshot base64). `GET ?uid=` → user's deposits.
- `GET /api/admin/deposits?status=` → all deposits (enriched with payment method ref). `PATCH` `{depositId,status,approverUid,approverRole,approverEmail,rejectionReason}` → approve: credit balance + totalEarned + balanceLog; reject: reason. WhatsApp notify fire-and-forget.

**Withdrawals**
- `POST /api/user/withdrawal` `{uid,email,walletAddress,amount}` — balance NOT deducted at request time; checks frozen + balance.
- `GET /api/admin/withdrawals?status=`; `PATCH` approve → debit + balanceLog + WhatsApp; reject → reason.

**Balance Logs**
- `GET /api/user/balance-logs?uid=&type=&startDate=&endDate=&page=&limit=` → paginated `{logs,total,page,limit,totalPages}`.
- `GET /api/admin/balance-logs?...` — same handler, uid defaults "all".
- `GET /api/user/balance-logs/export?...` → CSV download.

**Ad Accounts (user)**
- `GET /api/user/ad-accounts?uid=` → user's accounts enriched with metaAdAccounts cache + summary `{total,active,totalBudget,totalSpent,remainingBudget}`. `POST` create.
- `POST /api/user/ad-accounts/top-up` `{uid,accountId,amount}` → validate balance ≥ amount → Meta `updateSpendCap` (fail ⇒ cancel) → deduct wallet → update adAccounts spendCap + cache → balanceLog (type ad_account_topup, negative) → response `{walletBalance, accountBudget}`. Rollback wallet if ad account update fails.
- `GET /api/user/ad-accounts/history?accountId=` → topup history rows from balanceLogs metadata.

**Ad Accounts (admin)**
- `GET /api/admin/ad-accounts?includeUnassigned=true|unassigned=true` → enriched + `currentMonthTopUp` per account. `POST` create. `PATCH` `{_id,...updates}` → budget→spendCap; if spendCap + metaAccountId ⇒ Meta updateSpendCap + cache; syncSource admin_manual. `DELETE ?all=true|unassigned=true|id=` → delete.
- `POST /api/admin/ad-accounts/assign` `{accountIds,uid,assignedBy}` → assign loop. `DELETE ?accountId=` → unassign.
- `POST /api/admin/ad-accounts/top-up` `{accountId,amount,performedBy,performedByRole,performedByEmail}` → like user top-up but NO wallet deduction; positive balanceLog.

**Users (admin)**
- `GET /api/admin/users` → all users (limit 200), password excluded.
- `PATCH` `{uid,callerUid,role,availableBalance,accountStatus,displayName,dollarRate,groupName,password}` — authz by callerUid; role change admin-only; balance change → balanceLog type admin.
- `DELETE` `{uid,callerUid}` — admin-only; delete from users + Firebase user.
- `POST /api/admin/create-user` `{email,password,displayName,role,groupName}` → Firebase signUp via REST identitytoolkit (returns uid) + insert users doc with counters.

**Support Tickets**
- `GET/POST /api/user/support-tickets`; `PATCH` customer reply (ownership check, not closed).
- `GET /api/admin/support-tickets?status=&ticketId=` (regex search); `PATCH` `{ticketId,action,reply,staffName,staffRole}` — action reply|open|in_progress|closed.

**Reports**
- `GET /api/admin/reports?type=overview|financial|users|ad-spend&period=daily|weekly|monthly&startDate=&endDate=`.
- `GET /api/admin/reports/export?type=&format=csv|pdf&period=...` → CSV or HTML (print-to-PDF).

**Meta API**
- `GET /api/admin/meta-api` → sanitized settings (hasAccessToken boolean, never raw token). `PUT` → update + `testConnection`.
- `POST /api/admin/meta-api/sync` `{action}` → fetch-accounts | sync-spend | test-connection. `GET ?type=meta-accounts|logs`.
- `GET/POST /api/cron/sync` (Bearer CRON_SECRET) → syncAllAdAccounts. `GET/POST /api/cron/meta-fetch` → auto meta fetch; also `startAutoMetaFetch()` at module load.

**Settings**
- `GET /api/settings` (public) → siteName, primaryColor, secondaryColor, logo, dollarRate.
- `GET/PUT /api/admin/settings` — requireAdmin; PUT upserts settings.

**WhatsApp**
- `GET/PUT /api/admin/whatsapp` → sanitized settings.
- `POST /api/admin/whatsapp/test` `{phone,message}`.
- `GET /api/admin/whatsapp/logs` → last 100 notificationLogs.

**Others**
- `GET/POST /api/admin/payment-methods`; `POST /api/admin/payment-methods/assign`.
- `GET/POST /api/user/bank-accounts`.
- `GET /api/admin/top-up-insights?uid=` → topup insights joined with adAccounts.
- `GET/POST /api/admin/invitations`.

### A7. Cron / Scheduled Jobs

- `app/api/cron/sync/route.js` — `POST` (Bearer CRON_SECRET) syncAllAdAccounts; `GET` status.
- `app/api/cron/meta-fetch/route.js` — calls `startAutoMetaFetch()` at module load; `POST` fetches accounts from BM.
- `lib/autoMetaFetch.js` — `startAutoMetaFetch()`: immediate run + `setTimeout` 30–50s loop; lock `auto_meta_sync` TTL 60s; fetch → save cache → `syncAdAccountChanges(accounts)` (syncs spendCap/spent >0.001 diff).
- Client poller `app/(admin)/admin/components/SyncPoller.jsx` — POSTs cron/sync + cron/meta-fetch immediately and every 25 min (works because CRON_SECRET empty).

### A8. Meta API Service (`lib/metaApiService.js`)

Base `https://graph.facebook.com/v22.0`.
- `acquireSyncLock(name,ttl)` / `releaseSyncLock(name)` / `releaseStaleLocks()`.
- `testConnection()` → GET `/{bmId}?fields=id,name`.
- `fetchPaginated(url)` → maps accounts (balance/spendCap/amountSpent = cents/100).
- `fetchAdAccountsFromBM()` → parallel owned + client accounts, dedupe by metaAccountId.
- `fetchAdAccountInsights(metaAccountIdRaw)` → GET `act_{id}/insights` date_preset=this_month.
- `updateSpendCap(metaAccountIdRaw, capDollars)` → POST `act_{id}` body `{spend_cap: parseFloat(dollars)}`. **Note: sends dollars while Meta expects cents — documented unit quirk.**
- `syncAllAdAccounts(accountIds?)` — lock-guarded; 5-min cooldown; maps accountStatus numeric→string; fetch insights; update adAccounts + lastInsights; writes syncLogs summary.

### A9. WhatsApp Service (`lib/whatsappService.js`)

- `formatPhone(phone)` — normalizes BD numbers.
- `sendWhatsAppMessage(phone, message)` → POST `graph.facebook.com/v22.0/{phoneNumberId}/messages`; logs notificationLogs sent/error/skipped.
- Templates: `sendDepositApproved`, `sendDepositRejected`, `sendWithdrawalApproved`, `sendWithdrawalRejected` (BDT ৳ / USD formatting).
- Triggered from admin deposit/withdrawal PATCH handlers (fire-and-forget) when enabled + notifyOn* + user has phoneNumber.

### A10. Report Service (`lib/reportService.js`)

- `getOverviewReport()` — users/deposits/withdrawals/adAccounts aggregates → `{totalUsers,totalDeposits,approvedDepositsTotal,...,netRevenue}`.
- `getFinancialReport(period,start,end)` — daily/weekly/monthly grouped approved deposits+withdrawals → rows + summary.
- `getUserActivityReport(start,end)` — users joined with deposit/withdrawal counts/totals.
- `getAdSpendReport(start,end)` — adAccounts matched by lastSyncedAt/createdAt; summary with utilization %.
- `generateCSV(rows,columns)`, `generatePDFHtml(title,rows,columns,summary)` (HTML print-to-PDF, no PDF lib).

### A11. Key Files (old project)

| File | Purpose |
|---|---|
| `lib/mongodb.js` | Mongo singleton (global cache in dev) |
| `lib/firebaseClient.js` / `lib/firebaseAdmin.js` | Firebase web / admin SDKs |
| `lib/authUtils.js` | client auth flow helpers |
| `lib/permissions.js` | roles + permission matrix |
| `lib/userModel.js` | user CRUD + wallet + counters (`ADB5`) |
| `lib/adAccountModel.js` | ad account CRUD + assign/unassign/delete |
| `lib/depositModel.js`, `lib/withdrawalModel.js`, `lib/balanceLog.js` | wallet transaction models |
| `lib/bankAccountModel.js`, `lib/paymentMethodModel.js` | payment info models |
| `lib/metaSettingsModel.js` | meta config + cache + syncLogs |
| `lib/siteSettingsModel.js`, `lib/whatsappSettingsModel.js` | config singletons + notification logs |
| `lib/supportTicketModel.js` | tickets + counters (`ADT`) |
| `lib/metaApiService.js`, `lib/autoMetaFetch.js`, `lib/whatsappService.js` | integrations |
| `lib/reportService.js` | report aggregations + exports |
| `app/(admin)/admin/components/SyncPoller.jsx` | client-side cron trigger |
| `scripts/resetCounter.js` | counter repair tool |

---

## PART B — NEW UI CONTRACT (adsbuzz-ui-next)

The new UI is a fully client-side SPA. Every hook returns both data + CRUD handlers that the backend must eventually back with fetch calls. Below is the exact contract per entity (from `src/data/seedData.js`, `src/hooks/*`, `src/context/AppContext.jsx`).

### B1. State shape (AppContext `value`)

```
darkMode, searchQuery, setSearchQuery, toasts, removeToast, mobileSidebarOpen,
selectedInsightsAccountId, pendingOpenAddCustomer, pendingOpenAddAccount,
pendingInitialCheckoutStep, pendingInitialCustomerId, pendingInitialSalesCustomerId,
customers, adAccounts, invoices, cards, vendors, series, setups, settings, activities, stats,
toggleTheme, triggerToast,
handleAddCustomer, handleUpdateCustomer, handleUpdateCustomerNotes, handleToggleFavorite,
handleAddAdAccount, handleUpdateAdAccount, handleUpdateAccountStatus, handleBulkUpdateStatus,
handleExecuteSale, handleUpdateInvoice, handleApproveInvoice, handleRejectInvoice,
handleSyncTopupStatus, updateCard, handleToggleCardStatus, addCard,
handleUpdateVendor, addVendor, handleUpdateSeries, addSeries,
handleUpdateSaleSetup, addSetup, handleUpdateBaseRate, handleAddPaymentMethod,
handleDeletePaymentMethod, handleTriggerExport, handleSelectCustomerFromHeader,
handleSelectAdAccountFromHeader, applyCardLoad, markAccountSold, applySaleCredit,
handleNavigate, handleQuickAction, handleTriggerTopup, handleTriggerAssign,
handleNavigateToCustomers
```

### B2. Customers hook contract (`useCustomers`)

- `customers` — array (see B5 fields).
- `addCustomer(data)` → generates `id = CUST-<prev.length+101>`, `createdAt=today`, zero balances, prepends. Toast "Customer Onboarded".
- `updateCustomer(updatedCust)` → replace by `id`.
- `updateCustomerNotes(id, notes)` → set notes.
- `toggleFavorite(id)` → flip favorite.
- `applySaleCredit(customerId, paidBDT, topupUSD)` → increment balanceBDT + balanceUSD.

### B3. AdAccounts hook contract (`useAdAccounts`)

- `addAdAccount(accountData)` → prepends (id key = `adAccountId`).
- `updateAdAccount(updatedAcc)` → replace by `adAccountId`.
- `updateAccountStatus(accountId, status)` → set accountStatus.
- `bulkUpdateStatus(accountIds[], status)` → set status on many.
- `markAccountSold(adAccountId, customerId)` → set accountStatus='Sold' + assignedCustomer.

### B4. Invoices hook contract (`useInvoices`)

- `addInvoice(invoice)` → prepends.
- `updateInvoice(updatedInv)` → replace by `invoiceNo`.
- `approveInvoice(invoiceNo)` → set approvalStatus='Approved', paymentStatus='Paid'.
- `rejectInvoice(invoiceNo)` → set approvalStatus='Rejected', paymentStatus='Due'.
- `syncTopupStatus(invoiceNo, status)` → set topupStatus.

### B5. Exact field shapes (from seedData.js)

**Customer**
```js
{ id:"CUST-BIJOY", name, email, phone, companyName, status:"Active",
  createdAt:"2025-01-15", balanceBDT, balanceUSD, creditLimitUSD,
  groupId:"GC-BIJOY", notes, avatar:"BG", favorite:true }
```

**AdAccount**
```js
{ adAccountId:"206893199112660", adAccountName, platform:"Facebook|TikTok|Google|Snapchat",
  accountType:"Agency Account|TikTok Agency Acc|Google Premier Acc|Snapchat Ads Acc",
  dollarRate, monthlySpending, accountOwner:"ADSBUZZ", userGroupCode:"GC-350",
  accountStatus:"Active|Available|Terminated|Restricted|Disabled|Need Support|Sold",
  bmId, bmName, billingCard:"ADSBUZZ EBL - 1342",
  assignedCustomer:"CUST-EXPRESS"|null, seriesId:"S-90S" }
```
Derived (in view): `getEffectiveAccountStatus` → 'Sold' when assignedCustomer or status 'Active'; problem statuses pass through.

**Invoice**
```js
{ invoiceNo:"ADB 202415001", date:"2026-06-01", platform, adAccountName,
  serviceType:"Ad Account Topup"|"Others", dollarRate, topupAmountUSD,
  totalAmountBDT, paidAmountBDT, dueAmountBDT,
  paymentStatus:"Paid|Due|Partially Paid", paymentMethod, topupStatus:"Successfull|Pending|Failed",
  approvalStatus:"Approved|Pending|Rejected", customerId, groupId, note, serviceDetails,
  paymentScreenshot }
```
Invoice no generation (AppContext): `ADB 202416<serial.padStart(3,'0')>` where serial = invoices.length+1.

**Card**
```js
{ id:"CARD-EBL-1342", cardName:"ADSBUZZ EBL - 1342", cardType:"Visa|Mastercard|Union Pay",
  cardPlatform:"Rizon|Payoneer|Wise|Bybit|Airwalex", cardInitial:"EB",
  status:"Active|Disable", linkedAccountsCount, usageCount, totalLoadedUSD }
```

**Vendor**
```js
{ id:"VEND-FB-AGENCY", name, platform, outstandingBalanceUSD, email, phone,
  status:"Active|Inactive",
  paymentHistory:[{date, amountUSD, paymentMethod, transactionId}] }
```

**Series**
```js
{ seriesId:"S-90S", seriesName:"90'S SERIES", platform, status:"Active|Inactive" }
```

**SaleSetup**
```js
{ groupId:"GC-350", userId:"USER-EXPRESS-1", adName, adAccountId, platform,
  dollarRate, monthlySpending, status:"Active|Inactive" }
```

**Settings**
```js
{ companyName:"AdsBuzz Ltd", defaultDollarRate:132,
  paymentMethods:[ "ADSBUZZ EBL - 1342", "SN-EBL- 0929", "SN-NRBC - 4394", "MD EBL - 2802",
    "CELFIN-1672", "MD IBBL-6808", "BKASH-1672", "NAGAD-1672", "ADSBUZZ DBBL - 7473" ],
  roles:["Admin","Sales Manager","Operations Manager","Finance Auditor"],
  permissions:{ "Admin":["all"], "Sales Manager":["sales.create","sales.read","customers.create","customers.update"],
    "Operations Manager":["accounts.create","accounts.update","topups.approve"],
    "Finance Auditor":["reports.read","invoices.read","payments.verify"] } }
```

**Activity**
```js
{ id:"act-1", time:"09:05 AM", user, action, details, type:"sale|system|payment|account|customer" }
```

**Dashboard stats** (computed in AppContext `computeDashboardStats`, hardcoded "today"="2026-06-01")
```
{ todaySales, monthlySales, pendingTopups, pendingApprovals,
  activeCustomers, activeAccounts, assignedAccounts, vendorDue }
```

### B6. Key UI behaviors the backend must replicate

- **Sales flow** (`handleExecuteSale`): build invoice (invoiceNo = `ADB 202416XXX`, date=today) → addInvoice → markAccountSold(adAccountId, customerId) → applySaleCredit(customerId, paidBDT, topupUSD) → applyCardLoad(billingCard, topupUSD) → addActivity → toast → navigate `/`.
- **Quick actions**: new-sale → `/sales`; new-customer → `/customers?autoOpenAdd=true`; new-topup → `/sales?step=2`; assign-account → `/ad-accounts?autoOpenAdd=true`.
- **Header search**: navigates to `/customers?customerId=<id>` or `/ad-accounts`.
- **Export** (`handleTriggerExport`): currently a mock toast; should trigger real CSV/XLS/PDF download.
- **Topups page**: pending = `approvalStatus==='Pending' || topupStatus==='Pending'`; buttons Approve/Reject/Sync.
- **Customer-account linkage** (CustomersView): `acc.assignedCustomer === cust.id || (acc.userGroupCode === cust.groupId)`.
- **Customer-invoice linkage**: `inv.customerId === cust.id || (inv.groupId === cust.groupId)`.
- **Reports**: 6 metrics computed from month-filtered invoices + approval/payment statuses + company summary.
- **Insights**: platform spend pie (Paid invoices), ad account analyzer (topup ledger per account), early-stage growth chart (hardcoded EARLY_INSIGHTS_DATA).

### B7. Existing API stubs (new project) — to be replaced

| File | Current behavior |
|---|---|
| `src/app/api/admin/route.js` | placeholder |
| `src/app/api/auth/route.js` | placeholder |
| `src/app/api/tasks/route.js` | placeholder `{message, tasks:[]}` |
| `src/app/api/upload/route.js` | placeholder (screenshot upload target) |
| `src/app/api/users/route.js` | `GET {message, users:[]}` / `POST {message}` |

---

## PART C — DATA SOURCE MAPPING (old collections → new UI entities)

Per master rules: reuse existing Mongo collections where data exists; do not duplicate/migrate unless instructed. New-UI-only entities will need **new collections** (to be confirmed when each page is implemented).

| New UI entity | Old collection(s) | Reuse? | Notes |
|---|---|---|---|
| **Customers** | `users` (role=customer) | ✅ primary | New `CUST-*` IDs + balances/groupId are richer than old `users` (uid/availableBalance/groupName). Decide per-page: read old `users`, map fields; new fields (balanceBDT/USD, creditLimitUSD, avatar, favorite) may need extra columns on `users` doc or a new `customers` collection. |
| **Ad Accounts** | `adAccounts` + `metaAdAccounts` | ✅ primary | Old `adAccounts` maps closely (uid→assignedCustomer mapping via users? old uses `uid`; new uses `assignedCustomer` id). New fields: platform, accountType, dollarRate, monthlySpending, accountOwner, userGroupCode, bmId/bmName, billingCard, seriesId. `accountId` old ↔ `adAccountId` new. |
| **Invoices / Sales** | `deposits` / `balanceLogs` (ad_account_topup) | ⚠️ partial | Old has no invoice entity. Deposits record BDT/status/screenshot; balanceLogs record topups. New invoice fields (paymentStatus, topupStatus, approvalStatus, totals) go to a **new `invoices` collection**. Map historical data from deposits+balanceLogs if required. |
| **Cards** | `paymentMethods` (bank type) | ⚠️ partial | Old paymentMethods are payment channels, not funding cards. New card fields (cardType, cardPlatform, usageCount, totalLoadedUSD) → **new `cards` collection** or extended `paymentMethods`. |
| **Vendors** | none | ❌ new | **New `vendors` collection.** |
| **Series** | none | ❌ new | **New `series` collection.** |
| **Sale Setups** | none | ❌ new | **New `saleSetups` collection.** |
| **Settings** | `site_settings` | ✅ partial | Old: siteName, colors, logo, dollarRate. New: companyName, defaultDollarRate, paymentMethods[], roles[], permissions{}. Extend `site_settings` or new `settings` doc. |
| **Activities** | `balanceLogs` / `syncLogs` / `notificationLogs` | ⚠️ partial | No unified activity feed in old. **New `activities` collection** (audit log) is simplest. |
| **Dashboard stats** | computed from above | n/a | Aggregation endpoint. |

---

## PART D — RECOMMENDED NEW-PROJECT BACKEND DESIGN

### D1. Database choice
Use **MongoDB with native `mongodb` driver** (mirror old project). Rationale: master plan mandates shared collections with the old production DB; MongoDB matches old models. (New-project docs mention PostgreSQL/Prisma — overridden by master plan.)

### D2. Environment config (new project)
`.env.local` (create from `.env.local.example`) — new variables needed:
```
MONGODB_URI=
MONGODB_DB_NAME=
JWT_SECRET=
UPLOAD_PATH=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_APP_NAME=AdsBuzz ERP
NEXT_PUBLIC_SITE_URL=
```
(+ Firebase vars if auth reuses old Firebase project.)

### D3. Auth design (open decision — confirm before Phase 2)
Options:
1. **Reuse Firebase Auth** exactly like old project (uid-based, `/api/auth/sync-user`), map `users.role` for staff vs customer.
2. **JWT + local users table** (as new docs planned) with roles Admin/Sales Manager/Operations Manager/Finance Auditor.
3. Hybrid.

> **RESOLVED (2026-08-02):** Option 1 — reuse Firebase Auth for consistency with existing production users. Client uses `signInWithEmailAndPassword`; server verifies the ID token with firebase-admin.
>
> **Frontend auth layer (2026-08-04):** Chrome/Next.js can't read the sign-in state across a full page refresh, so the new project establishes a persistent server session. Flow:
> 1. `/login` page → `signInWithEmailAndPassword(auth, email, password)` (Firebase client SDK).
> 2. `user.getIdToken()` → `POST /api/auth/login` with `{ idToken }`.
> 3. Server verifies the ID token (firebase-admin), loads the `users` doc by `uid`, and sets an **HttpOnly session cookie** (`adsbuzz_session`, SameSite=Lax, 14-day Max-Age).
> 4. On every app load, `AuthContext` calls `GET /api/auth/session` to validate the cookie and hydrate the user — a valid logged-in user stays logged in across refresh.
> 5. `src/middleware.js` checks the session cookie on all dashboard routes and redirects to `/login?next=` if missing (covers refresh / direct URL / bookmarks).
> 6. Logout clears the cookie (`POST /api/auth/logout`) + Firebase `signOut` and redirects to `/login`.
>
> Roles mapping stays on old roles (`users.role`) as stored in prod. New-UI named roles (Admin / Sales Manager / Operations Manager / Finance Auditor) remain pending (see Part E).

### D4. Module build order (dependency-aware, from docs/todo.md)
1. Settings (no deps) → 2. Series ✅ → 3. Cards ✅ → 4. Customers ✅ → 5. Ad Accounts ✅ (deps: Cards, Series, Customers) → 6. Vendors ✅ (list/create/update; pay pending) → 7. Invoices ⏳ (list done; write flow pending) → 8. Sale Setups (deps: Ad Accounts) → 9. Topups (approve/reject/sync; deps: Invoices) → 10. Insights/Reports/Reports-export (deps: Invoices) → 11. Activities → 12. Dashboard aggregation → 13. Auth/RBAC (✅ earlier).

> **2026-08-02 status:** Series, Cards, Customers, Ad Accounts, Vendors CRUD + Invoices-list implemented. Front-end wired for these. Remaining: Settings, Sale Setups, Invoices write flow, Topups, Insights, Reports/export, Activities, Dashboard.

### D5. Recommended API surface (mirrors docs/api_list.md)
See `api-status.md` for the full endpoint matrix.

---

## PART E — OPEN QUESTIONS (to confirm with owner before/while coding)

1. **DB name** — `MONGODB_DB_NAME=ad_buzz` — ✅ resolved & verified (2026-08-02). Live read is safe.
2. **Auth** — ✅ RESOLVED: Firebase (reuse old). Phase 2 complete.
3. **Customers** — ✅ resolved: dedicated `customers` collection, synced from old `users` (`syncCustomersFromUsers`).
4. **Invoices** — new `invoices` collection ✅ created; legacy data synced via `syncLegacyInvoices`.
5. **Historical data** — ✅ resolved: live production data is read (412 ad accounts, synced customers/invoices).
6. **Roles/permissions** — backend uses old roles (admin/staff/customer) as prod `users` store them; new-UI roles open.
7. **Login UI** — ✅ **RESOLVED (2026-08-04):** full frontend auth shipped — `/login` page, middleware route guard, `AuthContext` session persistence, Header logout. Old-UI vs new-UI roles still open.

> All decisions are recorded here and must be re-confirmed only if implementation is blocked.
