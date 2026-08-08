import { asyncHandler, ok, notFound, badRequest } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { getAdAccountUiByIdentifier, markAccountSold } from "@/models/adAccountModel";
import { cacheInvalidate } from "@/lib/cache";

const CACHE_PREFIX = "GET:/api/ad-accounts";

export const POST = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const customerId = String(body.customerId || "").trim();
  if (!customerId) {
    return badRequest("A customer is required to assign an ad account.");
  }

  const account = await getAdAccountUiByIdentifier(id);
  if (!account) {
    return notFound("Ad account not found.");
  }

  const saved = await markAccountSold(id, customerId);
  if (!saved) {
    return notFound("Ad account not found.");
  }
  cacheInvalidate(CACHE_PREFIX);
  return ok({ message: "Ad account assigned to customer.", adAccount: saved });
});
