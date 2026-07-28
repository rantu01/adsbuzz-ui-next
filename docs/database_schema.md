# Database Schema

## 1. Customers
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | e.g. "CUST-BIJOY" |
| name | String | Customer/business name |
| email | String | |
| phone | String | |
| companyName | String | |
| status | Enum | "Active" / "Inactive" |
| createdAt | Date | |
| balanceBDT | Number | Current BDT balance |
| balanceUSD | Number | Current USD balance (derived) |
| creditLimitUSD | Number | Max credit in USD |
| groupId | String | e.g. "GC-BIJOY" |
| notes | Text | Internal notes |
| avatar | String | 2-letter avatar code |
| favorite | Boolean | Starred customer |

## 2. Ad Accounts
| Field | Type | Notes |
|---|---|---|
| adAccountId | String (PK) | e.g. "206893199112660" |
| adAccountName | String | |
| platform | Enum | Facebook / TikTok / Google / Snapchat |
| accountType | String | "Agency Account", "TikTok Agency Acc", etc. |
| dollarRate | Number | Custom exchange rate for this account |
| monthlySpending | Number | Monthly ad spend in USD |
| accountOwner | String | "ADSBUZZ" or other owner |
| userGroupCode | String | e.g. "GC-350" |
| accountStatus | Enum | Active / Available / Terminated / Restricted / Disabled / Need Support |
| bmId | String | Business Manager ID |
| bmName | String | Business Manager name |
| billingCard | String | FK → Cards.cardName |
| assignedCustomer | String? | FK → Customers.id (nullable) |
| seriesId | String | FK → Series.seriesId |

## 3. Invoices
| Field | Type | Notes |
|---|---|---|
| invoiceNo | String (PK) | e.g. "ADB 202415001" |
| date | Date | |
| platform | Enum | Facebook / TikTok / Google / Snapchat |
| adAccountName | String | |
| serviceType | String? | "Ad Account Topup" / "Others" |
| dollarRate | Number | Rate used for this transaction |
| topupAmountUSD | Number | Amount in USD |
| totalAmountBDT | Number | Total in BDT |
| paidAmountBDT | Number | Amount paid |
| dueAmountBDT | Number | Remaining due |
| paymentStatus | Enum | Paid / Due / Partially Paid |
| paymentMethod | String | e.g. "ADSBUZZ EBL - 1342" |
| topupStatus | Enum | Successfull / Pending / Failed |
| approvalStatus | Enum | Approved / Pending / Rejected |
| customerId | String? | FK → Customers.id |
| groupId | String? | e.g. "GC-101" |
| note | Text? | Internal note |
| serviceDetails | String? | For "Others" service type |
| paymentScreenshot | String? | Base64 data URL of payment proof |

## 4. Cards
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | e.g. "CARD-EBL-1342" |
| cardName | String | |
| cardType | Enum | Visa / Mastercard / Union Pay |
| cardPlatform | String | Rizon / Payoneer / Wise / Bybit / Airwalex |
| cardInitial | String | 2-letter code |
| status | Enum | Active / Inactive |
| linkedAccountsCount | Number | |
| usageCount | Number | |
| totalLoadedUSD | Number | Lifetime loaded amount |

## 5. Vendors
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | e.g. "VEND-FB-AGENCY" |
| name | String | |
| platform | Enum | Facebook / TikTok / Google / Snapchat |
| outstandingBalanceUSD | Number | Amount owed to vendor |
| email | String | |
| phone | String | |
| status | Enum | Active / Inactive |
| paymentHistory | Array | See PaymentRecord below |

### PaymentRecord (embedded in Vendor)
| Field | Type | Notes |
|---|---|---|
| date | Date | |
| amountUSD | Number | |
| paymentMethod | String | |
| transactionId | String | |

## 6. Series
| Field | Type | Notes |
|---|---|---|
| seriesId | String (PK) | e.g. "S-90S" |
| seriesName | String | |
| platform | Enum | Facebook / TikTok / Google / Snapchat |
| status | Enum | Active / Inactive |

## 7. Sale Setups
| Field | Type | Notes |
|---|---|---|
| groupId | String (PK) | e.g. "GC-350" |
| userId | String | |
| adName | String | Campaign name |
| adAccountId | String | FK → AdAccounts.adAccountId |
| platform | Enum | |
| dollarRate | Number | |
| monthlySpending | Number | |
| status | Enum | Active / Inactive |

## 8. Settings (Singleton)
| Field | Type | Notes |
|---|---|---|
| companyName | String | "AdsBuzz Ltd" |
| defaultDollarRate | Number | Base exchange rate |
| paymentMethods | Array of String | e.g. ["ADSBUZZ EBL - 1342", ...] |
| roles | Array of String | ["Admin", "Sales Manager", ...] |
| permissions | Object | Role → permission array mapping |

## 9. Activities / Audit Log
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | |
| time | String | Display time (e.g. "09:05 AM") |
| user | String | Who performed the action |
| action | String | What was done |
| details | String | Additional context |
| type | Enum | sale / system / payment / account |
| createdAt | Date? | Machine-readable timestamp |

## 10. Users (for auth)
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | |
| username | String | |
| email | String | |
| passwordHash | String | bcrypt hashed |
| role | Enum | Admin / Sales Manager / Operations Manager / Finance Auditor |
| createdAt | Date | |
| lastLogin | Date? | |

## Entity Relationships
```
Customer 1──M AdAccount    (assignedCustomer)
Customer 1──M Invoice       (customerId)
AdAccount M──1 Card         (billingCard)
AdAccount M──1 Series       (seriesId)
AdAccount M──1 Customer     (assignedCustomer)
Vendor    1──M PaymentRecord (embedded)
Invoice   M──1 Customer     (customerId)
SaleSetup M──1 AdAccount    (adAccountId)
