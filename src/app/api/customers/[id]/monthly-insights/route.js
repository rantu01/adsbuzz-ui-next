import { asyncHandler, ok, notFound } from "@/utils/http";
import { getCustomerById } from "@/models/customerModel";
import { getCustomerMonthlyInsights } from "@/models/invoiceModel";
import { cacheGet, cacheSet } from "@/lib/cache";

// Read-only per-customer Monthly Topup Insights for the CRM Notes section.
// Queries + aggregates ONLY the selected customer's invoices (never the full
// ledger) so the response stays small and fast. Never writes to MongoDB.
// NOTE: the prefix intentionally starts with "GET:/api/customers" so the
// existing invoice-write invalidation (`cacheInvalidate("GET:/api/customers")`
// on sale/approve/reject/pay) also clears these scoped entries.
const CACHE_PREFIX = "GET:/api/customers/[id]/monthly-insights";

export const GET = asyncHandler(async (request, { params }) => {
  const { id } = await params;

  const key = `${CACHE_PREFIX}:${id}`;
  const cached = cacheGet(key);
  if (cached) {
    return ok(cached);
  }

  const customer = await getCustomerById(id);
  if (!customer) {
    return notFound("Customer not found.");
  }

  const insights = await getCustomerMonthlyInsights(customer.id);
  const payload = { customerId: customer.id, insights };
  cacheSet(key, payload);
  return ok(payload);
});
