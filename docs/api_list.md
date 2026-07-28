# API Endpoints

## Customers
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/customers | List all customers | Read |
| POST | /api/customers | Create customer | Create |
| GET | /api/customers/:id | Get customer by ID | Read |
| PUT | /api/customers/:id | Update customer | Update |
| PATCH | /api/customers/:id/favorite | Toggle favorite | Update |
| PATCH | /api/customers/:id/notes | Update notes | Update |

## Ad Accounts
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/ad-accounts | List all ad accounts | Read |
| POST | /api/ad-accounts | Create ad account | Create |
| PUT | /api/ad-accounts/:id | Update ad account | Update |
| PATCH | /api/ad-accounts/:id/status | Update account status | Update |
| PATCH | /api/ad-accounts/bulk-status | Bulk update status | Update |

## Invoices
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/invoices | List all invoices | Read |
| POST | /api/invoices | Create invoice (sale) | Create |
| GET | /api/invoices/:id | Get invoice by ID | Read |
| PUT | /api/invoices/:id | Update invoice | Update |

## Cards
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/cards | List all cards | Read |
| POST | /api/cards | Create card | Create |
| PUT | /api/cards/:id | Update card | Update |
| PATCH | /api/cards/:id/toggle | Toggle card active/inactive | Update |

## Vendors
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/vendors | List all vendors | Read |
| POST | /api/vendors | Create vendor | Create |
| PUT | /api/vendors/:id | Update vendor | Update |
| POST | /api/vendors/:id/pay | Record payment to vendor | Create |

## Series
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/series | List all series | Read |
| POST | /api/series | Create series | Create |
| PUT | /api/series/:id | Update series | Update |

## Sale Setups
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/sale-setups | List all sale setups | Read |
| POST | /api/sale-setups | Create sale setup | Create |
| PUT | /api/sale-setups/:id | Update sale setup | Update |

## Settings
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/settings | Get settings | Read |
| PUT | /api/settings | Update settings (full) | Update |
| PUT | /api/settings/base-rate | Update base dollar rate | Update |
| POST | /api/settings/payment-methods | Add payment method | Update |
| DELETE | /api/settings/payment-methods/:name | Delete payment method | Update |

## Topups (Financial Audit)
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/topups | List pending topups | Read |
| PATCH | /api/topups/:id/approve | Approve topup/invoice | Approve |
| PATCH | /api/topups/:id/reject | Reject topup/invoice | Approve |
| POST | /api/topups/:id/sync | Sync topup status with ad platform | Update |

## Insights & Reports
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/insights | Get aggregated dashboard data | Read |
| GET | /api/reports?month=YYYY-MM | Get monthly report | Read |
| GET | /api/reports/export?month=YYYY-MM | Export report as CSV | Read |

## Activities
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/activities | List recent activities | Read |

## Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/login | Login with email/password |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get current user profile |

## Upload
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/upload | Upload payment screenshot (returns URL) |

## Dashboard Data
The dashboard aggregates across all entities. Recommended approach: a dedicated `/api/dashboard` endpoint that returns summary stats (total accounts, pending topups, today's revenue, recent activities) rather than making 5+ separate API calls.
