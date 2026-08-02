<div align="center">

# 🚀 AdsBuzz ERP

**The all-in-one ERP for AdsBuzz Ltd — a Bangladeshi digital ad agency**

Manage customers, ad accounts, invoices, and finances for **Facebook, TikTok, Instagram, and Snapchat** — all in one beautifully crafted dashboard.

</div>

<br>

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15.3-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind (v4)](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=for-the-badge&logo=tailwindcss)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)

</div>

---

## 🧭 What is AdsBuzz ERP?

AdsBuzz is a **digital marketing agency** from Bangladesh that runs ad campaigns on **Facebook, TikTok, Instagram, and Snapchat** for its clients. This ERP provides a single dashboard to run the entire agency workflow:

> 1. A customer pays in **BDT** (bKash / Nagad / bank).
> 2. AdsBuzz loads **USD** onto a publisher ad account (**top-up**).
> 3. An **invoice** records the transaction (USD amount, BDT paid, exchange rate, payment method).
> 4. Billing **cards** fund accounts, **vendors** supply ad credits, and **series** group accounts.

---

## ✨ Features

- 📊 **Dashboard** — live stats, sales, customers, ad accounts & activity feed
- 🧑‍🤝‍🧑 **Customer CRM** — favourites, notes, contact details, account links
- 🛒 **Sale Entry** — quick, checkout-style sales with campaign-focused workflows
- 💰 **Top-ups** — financial audits & BDT → USD top-up syncs
- 📣 **Ad Accounts** — manage **410+ accounts** across Facebook, TikTok & more
- 🏛️ **Series · Cards · Vendors** — full CRUD for the ad-infrastructure
- 🧾 **Invoices** — create, search, paginate, track payment & top-up status
- 📈 **Reports & Insights** — Recharts-powered charts & an exportable reporting desk
- ⚙️ **Settings** — company, payment methods, default dollar rate, roles & permissions

---

## 🧱 Pages & Navigation

| # | Route | Page | Primary Data |
|---|---|---|---|
| 1 | `/` | Dashboard | stats, invoices, customers, ad accounts, activity |
| 2 | `/customers` | Customer CRM Hub | customers, ad accounts, invoices |
| 3 | `/sales` | Sale Entry | customers, ad accounts, settings, invoices |
| 4 | `/sale-setup` | Sale Setup | setups, ad accounts |
| 5 | `/topups` | Financial Audits & Syncs | invoices, customers |
| 6 | `/ad-accounts` | Ad Accounts | ad accounts, customers, cards, series |
| 7 | `/series` | Series | series, ad accounts |
| 8 | `/cards` | Cards | cards, ad accounts |
| 9 | `/vendors` | Vendors | vendors |
| 10 | `/reports` | Reporting Desk | invoices |
| 11 | `/insights` | Insights | invoices, ad accounts, vendors, cards, series |
| 12 | `/invoices` | Invoices | invoices, customers |
| 13 | `/settings` | Settings | settings |

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js](https://nextjs.org) 15.3 (App Router) |
| **Frontend** | React 19, Tailwind CSS v4 |
| **Motion / Icons** | Framer Motion (motion v12), lucide-react |
| **Charts** | Recharts 3.9 |
| **Backend** | Next.js API Routes |
| **Database** | MongoDB 7 (native `mongodb` driver) |
| **Auth** | Firebase Auth + Firebase Admin |
| **Language** | JavaScript (ESM) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.18+ (LTS recommended)
- **MongoDB** instance (local or Atlas)
- *(Optional)* a **Firebase** project for auth

### Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd adsbuzz-erp

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_APP_NAME=
NEXT_PUBLIC_SITE_URL=
JWT_SECRET=your-secret-here
MONGODB_URI=mongodb://localhost:27017/ad_buzz
UPLOAD_PATH=./uploads
```

> ⚠️ `.env.local` is listed in `.gitignore` — never commit real secrets.

### Run it

```bash
npm run dev        # → http://localhost:3000 (dev server)
npm run build      # production build
npm run start      # production server
npm run lint       # ESLint check
```

---

## 🗄️ Data Model

| Entity | Identifier | Highlights |
|---|---|---|
| **Customer** | `CUST-*` | balance BDT / USD, credit limit, group, status, notes, favourite |
| **Ad Account** | — | platform, account type, dollar rate, monthly spend, BM, billing card |
| **Invoice** | `ADB-*` | USD top-up, BDT paid, exchange rate, status, method, screenshot |
| **Card** | `CARD-*` | type, platform, linked accounts, total loaded USD |
| **Vendor** | `VEND-*` | platform, outstanding USD balance, payment history |
| **Series** | `S-*` | platform, status |
| **Sale Setup** | `GC-*` | ad config per account |
| **Settings** | — | default rate, payment methods, roles & permissions |
| **Activity** | — | audit log (sale / system / payment / account / customer) |

---

## 🚧 Roadmap

- ✅ **Phase 0–2** — Scaffolding, UI, design system, seed data
- 🟩 **Phase 3** — CRUD for core modules *(mostly complete)*
- 🔄 **Phase 4–5** — Backend services + full page wiring & polish
- ⏳ **Phase 6** — Login / auth flow & production hardening

---

## 🤝 Contributing

1. **Fork** the repo
2. Create a feature branch: `git checkout -b feature/your-idea`
3. Commit: `git commit -m 'Add your feature'`
4. Push: `git push origin feature/your-idea`
5. Open a **Pull Request**

---

## 📄 License

Distributed under the **MIT License**.

---

<div align="center">

Made with ❤️ by the **AdsBuzz** team developer Rantu

</div>