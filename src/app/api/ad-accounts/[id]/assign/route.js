import { asyncHandler, ok, notFound, badRequest } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { getAdAccountUiByIdentifier, markAccountSold } from "@/models/adAccountModel";
import { getSocialAdAccountById, markSocialAccountSold } from "@/models/socialAdAccountModel";
import { cacheInvalidate } from "@/lib/cache";

const CACHE_PREFIX = "GET:/api/ad-accounts";
const SOCIAL_CACHE_PREFIX = "GET:/api/social-ad-accounts";

export const POST = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const customerId = String(body.customerId || "").trim();
  if (!customerId) {
    return badRequest("A customer is required to assign an ad account.");
  }

  // Try the main ad-accounts collection first, then fall back to the social
  // ad-accounts collection so accounts surfacing on the Ad Account Inventory
  // page (which load into the social collection) can be assigned exactly like
  // accounts on the Customers page. Assignment also automatically marks the
  // account as Sold.
  const account = await getAdAccountUiByIdentifier(id);
  if (account) {
    const saved = await markAccountSold(id, customerId);
    if (!saved) {
      return notFound("Ad account not found.");
    }
    cacheInvalidate(CACHE_PREFIX);
    return ok({ message: "Ad account assigned to customer.", adAccount: saved });
  }

  const social = await getSocialAdAccountById(id);
  if (!social) {
    return notFound("Ad account not found.");
  }

  const saved = await markSocialAccountSold(id, customerId);
  if (!saved) {
    return notFound("Ad account not found.");
  }
  cacheInvalidate(SOCIAL_CACHE_PREFIX);
  return ok({ message: "Ad account assigned to customer.", adAccount: saved });
});