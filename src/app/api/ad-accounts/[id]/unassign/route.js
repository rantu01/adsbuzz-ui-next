import { asyncHandler, ok, notFound } from "@/utils/http";
import { getAdAccountUiByIdentifier, unassignAccount } from "@/models/adAccountModel";
import { cacheInvalidate } from "@/lib/cache";

const CACHE_PREFIX = "GET:/api/ad-accounts";

export const POST = asyncHandler(async (request, { params }) => {
  const { id } = await params;

  const account = await getAdAccountUiByIdentifier(id);
  if (!account) {
    return notFound("Ad account not found.");
  }

  const saved = await unassignAccount(id);
  if (!saved) {
    return notFound("Ad account not found.");
  }
  cacheInvalidate(CACHE_PREFIX);
  return ok({ message: "Ad account unassigned from customer.", adAccount: saved });
});