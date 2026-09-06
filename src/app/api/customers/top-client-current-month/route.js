import { asyncHandler, ok } from "@/utils/http";
import { getTopClientCurrentMonth } from "@/models/invoiceModel";
import { cacheGet, cacheSet } from "@/lib/cache";

// Server-side "Top Client Current Month" for the Customers page summary card.
// Returns one tiny payload (Client Name, Group ID, Total Topup Amount) so the
// client never downloads the full ledger for this card.
// NOTE: the key intentionally starts with "GET:/api/customers" so the
// existing invoice-write invalidation (`cacheInvalidate("GET:/api/customers")`
// on sale/approve/reject/pay) also clears this entry.
// NOTE: this static segment takes precedence over the sibling `[id]` dynamic
// route, so /api/customers/top-client-current-month always lands here.
const CACHE_PREFIX = "GET:/api/customers/top-client-current-month";

export const GET = asyncHandler(async () => {
  const cached = cacheGet(CACHE_PREFIX);
  if (cached) {
    return ok(cached);
  }

  const result = await getTopClientCurrentMonth();
  const payload = {
    month: result.month,
    topClient: result.topClient,
    totalTopupUSD: result.totalTopupUSD,
  };
  cacheSet(CACHE_PREFIX, payload);
  return ok(payload);
});
