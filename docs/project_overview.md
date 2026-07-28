# AdsBuzz ERP - Project Overview

## Business Domain
AdsBuzz Ltd is a Bangladeshi digital ad agency that manages Facebook, TikTok, Google, and Snapchat ad accounts for clients. Core operations: top-up services (clients pay BDT, agency loads USD to ad accounts), reseller/agency model with bulk ad account inventory, billing card management, vendor payments, and financial auditing.

## Tech Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI Library | React 19 |
| Language | JavaScript (JSX) |
| Styling | Tailwind CSS v4 |
| Animation | motion (framer-motion v12) |
| Charts | Recharts |
| Icons | Lucide React |

## Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.jsx          # Root layout with AppShell
│   ├── page.jsx            # Dashboard (redirects to /dashboard)
│   ├── dashboard/page.jsx
│   ├── ad-accounts/page.jsx
│   ├── sales/page.jsx
│   ├── customers/page.jsx
│   ├── invoices/page.jsx
│   ├── insights/page.jsx
│   ├── reports/page.jsx
│   ├── topups/page.jsx
│   ├── cards/page.jsx
│   ├── series/page.jsx
│   ├── sale-setup/page.jsx
│   ├── vendors/page.jsx
│   └── settings/page.jsx
├── components/
│   ├── app/                # AppShell, Sidebar, Header, AppContent
│   ├── common/             # PlatformText, StatCard, ErrorBoundary
│   ├── ui/                 # Modal, Button, Badge, Toast, SearchBar
│   └── views/              # 13 view components (business logic per page)
├── context/
│   └── AppContext.jsx       # Global state + all CRUD handlers
├── hooks/
│   ├── useCustomers.js
│   ├── useAdAccounts.js
│   ├── useInvoices.js
│   ├── useCards.js
│   ├── useVendors.js
│   ├── useSeries.js
│   ├── useSaleSetups.js
│   ├── useSettings.js
│   └── useActivities.js
├── data/
│   └── seedData.js          # All mock data
└── types.ts                 # Original TypeScript type defs
```

## Current State
- Fully client-side with mock data from `seedData.js`
- All state managed via React Context (`AppContext.jsx`)
- 21 static pages, 0 build errors, 0 lint warnings
- No backend/API layer yet