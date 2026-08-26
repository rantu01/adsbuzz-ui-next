import { asyncHandler, ok, badRequest } from "@/utils/http";
import { searchSalesByAdAccount } from "@/models/invoiceModel";

// Searches the real Sales Entry data by Ad Account ID or Ad Account Name and
// returns all dates on which sales entries were made for the matched account.
// Read-only and intentionally scoped to verification — it does not alter any
// existing Sales Entry logic or other functionality.
export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) {
    return badRequest("Please provide an Ad Account ID or Ad Account Name to search.");
  }

  const result = await searchSalesByAdAccount({ query: q });
  return ok(result);
});
