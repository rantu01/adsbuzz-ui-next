# Todo List

## Phase 1: Foundation
- [ ] Choose database (PostgreSQL + Prisma recommended)
- [ ] Set up project structure (controllers, services, repositories, models)
- [ ] Configure Prisma schema based on database_schema.md
- [ ] Set up environment config (.env, config/index.js)
- [ ] Set up logger utility
- [ ] Create database connection lib

## Phase 2: Auth & RBAC
- [ ] Implement auth middleware (JWT)
- [ ] Create users table & model
- [ ] Implement login/logout API routes
- [ ] Implement RBAC middleware with role-permission mapping
- [ ] Create auth service with bcrypt password hashing

## Phase 3: CRUD APIs (Order by dependency)
- [ ] Settings API (base rate, payment methods) — no dependencies
- [ ] Series API — no dependencies
- [ ] Cards API — no dependencies
- [ ] Customers API — no dependencies
- [ ] Ad Accounts API — depends on Cards, Series, Customers
- [ ] Vendors API — no dependencies
- [ ] Sale Setups API — depends on Ad Accounts
- [ ] Invoices API — depends on Customers, Ad Accounts

## Phase 4: Business Logic APIs
- [ ] Topups API (approve/reject/sync) — depends on Invoices
- [ ] Insights API (aggregated data) — depends on Invoices, Ad Accounts
- [ ] Reports API (monthly reports) — depends on Invoices
- [ ] Reports export (CSV download)
- [ ] Activities API (audit log)
- [ ] Dashboard aggregation endpoint

## Phase 5: Frontend Integration
- [ ] Replace seed data with API calls in AppContext
- [ ] Add loading states to all views
- [ ] Add error handling for API failures
- [ ] Add optimistic updates for better UX
- [ ] Implement payment screenshot upload flow

## Phase 6: Polish & Testing
- [ ] Add form validation with error messages
- [ ] Add confirmation dialogs for destructive actions
- [ ] Write unit tests for services
- [ ] Write integration tests for API routes
- [ ] Write E2E tests for critical flows (create sale, approve topup)
- [ ] Performance optimization (memoization, pagination)

## Phase 7: Deployment
- [ ] Dockerize application
- [ ] Set up CI/CD pipeline
- [ ] Configure production database
- [ ] Set up monitoring & logging
- [ ] Deploy to Vercel / custom server

## Notes
- The frontend currently has all state in AppContext with mock data
- Each context handler (onAddCustomer, onUpdateInvoice, etc.) maps directly to an API endpoint
- The goal is to replace each handler with a fetch call while keeping the UI unchanged
- Consider starting with a single entity (e.g., Customers) end-to-end as a reference pattern
