# Backend Architecture

## Directory Structure (Planned)
```
src/
├── app/
│   ├── api/              # Next.js App Router API routes
│   │   ├── customers/
│   │   │   ├── route.js          # GET (list), POST (create)
│   │   │   └── [id]/
│   │   │       └── route.js      # GET, PUT, DELETE
│   │   ├── ad-accounts/
│   │   │   ├── route.js
│   │   │   ├── [id]/
│   │   │   │   └── route.js
│   │   │   └── bulk-status/
│   │   │       └── route.js      # PATCH (bulk update)
│   │   ├── invoices/
│   │   │   ├── route.js
│   │   │   └── [id]/
│   │   │       └── route.js
│   │   ├── cards/
│   │   │   ├── route.js
│   │   │   └── [id]/
│   │   │       └── route.js
│   │   ├── vendors/
│   │   │   ├── route.js
│   │   │   └── [id]/
│   │   │       └── route.js
│   │   │   └── [id]/pay/
│   │   │       └── route.js
│   │   ├── series/
│   │   │   ├── route.js
│   │   │   └── [id]/
│   │   │       └── route.js
│   │   ├── sale-setups/
│   │   │   ├── route.js
│   │   │   └── [id]/
│   │   │       └── route.js
│   │   ├── settings/
│   │   │   ├── route.js          # GET, PUT
│   │   │   ├── payment-methods/
│   │   │   │   └── route.js      # POST, DELETE
│   │   │   └── base-rate/
│   │   │       └── route.js      # PUT
│   │   ├── topups/
│   │   │   ├── route.js          # GET (pending)
│   │   │   └── [id]/
│   │   │       ├── approve/route.js
│   │   │       ├── reject/route.js
│   │   │       └── sync/route.js
│   │   ├── insights/
│   │   │   └── route.js          # GET (aggregated data)
│   │   ├── reports/
│   │   │   └── route.js          # GET (report data)
│   │   │   └── export/
│   │   │       └── route.js      # GET (CSV/Excel export)
│   │   ├── activities/
│   │   │   └── route.js          # GET (recent activities)
│   │   ├── auth/
│   │   │   ├── login/route.js
│   │   │   ├── logout/route.js
│   │   │   └── me/route.js
│   │   └── upload/
│   │       └── route.js          # POST (payment screenshot)
├── controllers/       # Request handling, validation, response formatting
│   ├── customerController.js
│   ├── adAccountController.js
│   ├── invoiceController.js
│   ├── cardController.js
│   ├── vendorController.js
│   ├── seriesController.js
│   ├── saleSetupController.js
│   ├── settingsController.js
│   ├── topupController.js
│   ├── insightsController.js
│   ├── reportController.js
│   ├── activityController.js
│   └── authController.js
├── services/          # Business logic layer
│   ├── customerService.js
│   ├── adAccountService.js
│   ├── invoiceService.js
│   ├── cardService.js
│   ├── vendorService.js
│   ├── seriesService.js
│   ├── saleSetupService.js
│   ├── settingsService.js
│   ├── topupService.js
│   ├── insightsService.js
│   ├── reportService.js
│   ├── activityService.js
│   ├── authService.js
│   └── paymentScreenshotService.js
├── repositories/      # Data access layer (DB queries)
│   ├── customerRepository.js
│   ├── adAccountRepository.js
│   ├── invoiceRepository.js
│   ├── cardRepository.js
│   ├── vendorRepository.js
│   ├── seriesRepository.js
│   ├── saleSetupRepository.js
│   ├── settingsRepository.js
│   └── activityRepository.js
├── models/            # Database models / ORM schemas
│   ├── Customer.js
│   ├── AdAccount.js
│   ├── Invoice.js
│   ├── Card.js
│   ├── Vendor.js
│   ├── Series.js
│   ├── SaleSetup.js
│   ├── Settings.js
│   ├── Activity.js
│   └── User.js
├── middlewares/
│   ├── auth.js        # JWT authentication
│   ├── rbac.js        # Role-based access control
│   ├── validate.js    # Request validation
│   ├── errorHandler.js
│   └── upload.js      # File upload handling (multer)
├── validators/        # Request schemas (Zod)
│   ├── customerSchema.js
│   ├── adAccountSchema.js
│   ├── invoiceSchema.js
│   ├── cardSchema.js
│   ├── vendorSchema.js
│   ├── seriesSchema.js
│   ├── saleSetupSchema.js
│   ├── settingsSchema.js
│   └── authSchema.js
├── lib/
│   ├── db.js          # Database connection
│   ├── logger.js      # Logging utility
│   └── cache.js       # Optional caching layer
├── utils/
│   ├── bdt-usd.js     # Currency conversion helpers
│   ├── date.js        # Date formatting utilities
│   └── csv.js         # CSV/Excel export helpers
└── config/
    └── index.js       # Environment config
```

## Architecture Pattern
- **Route → Controller → Service → Repository → Model**
- Controllers handle HTTP req/res (no business logic)
- Services contain business rules (e.g., status derivation, balance calculation)
- Repositories handle DB queries (abstracts ORM)
- Validators (Zod) validate at middleware level before controller

## Data Flow Example (Create Sale)
1. `POST /api/invoices` → `validate(invoiceSchema)` middleware
2. `invoiceController.create(req, res)` → calls `invoiceService.create(data)`
3. `invoiceService` calculates totals, derives payment status, calls `invoiceRepository.create()`
4. `invoiceRepository` inserts into DB and returns created invoice
5. Controller sends JSON response

## Authentication & Authorization
- JWT-based auth (access + refresh tokens)
- Roles: Admin, Sales Manager, Operations Manager, Finance Auditor
- RBAC middleware checks permissions per route
- Permissions model from seedData: `sales.create`, `sales.read`, `customers.create`, `accounts.update`, `topups.approve`, `reports.read`, `payments.verify`

## Database
- To be chosen (options: PostgreSQL with Prisma, or MongoDB with Mongoose)
- Schema documented separately in `database_schema.md`
