import { asyncHandler, ok, notFound } from "@/utils/http";
import { getCustomerById } from "@/models/customerModel";
import { getCustomerTopupSummary } from "@/models/invoiceModel";
import { cacheGet, cacheSet } from "@/lib/cache";

const CACHE_PREFIX = "GET:/api/customers/[id]/topup-summary";

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

  const summary = await getCustomerTopupSummary(customer.id);
  const payload = { customerId: customer.id, summary };
  cacheSet(key, payload);
  return ok(payload);
});