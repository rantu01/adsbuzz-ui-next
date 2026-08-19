import { asyncHandler, ok, notFound } from "@/utils/http";
import { getAdAccountUiByIdentifier, unassignAccount } from "@/models/adAccountModel";
import { getSocialAdAccountById, unassignSocialAccount } from "@/models/socialAdAccountModel";
import { getCustomerById } from "@/models/customerModel";
import { terminateSaleSetupsForAccount } from "@/models/saleSetupModel";
import { cacheInvalidate } from "@/lib/cache";

const CACHE_PREFIX = "GET:/api/ad-accounts";
const SOCIAL_CACHE_PREFIX = "GET:/api/social-ad-accounts";

export const POST = asyncHandler(async (request, { params }) => {
  const { id } = await params;

  // Unassign may be called without a body (e.g. quick actions); a reason is
  // optional and only recorded when supplied.
  let reason = "";
  try {
    const body = await request.json();
    reason = String(body?.reason || "").trim();
  } catch {
    // no body — nothing to read
  }

  const account = await getAdAccountUiByIdentifier(id);
  const social = account ? null : await getSocialAdAccountById(id);
  const target = account || social;
  if (!target) {
    return notFound("Ad account not found.");
  }

  // Capture the assigned customer before unassigning so the topup setup tied to
  // that customer/account can be auto-terminated afterwards and the unassign can
  // be logged against the right customer in the activity feed.
  const previousCustomerId = target.assignedCustomer || "";
  const customer = previousCustomerId ? await getCustomerById(previousCustomerId) : null;

  const saved = account
    ? await unassignAccount(id, reason)
    : await unassignSocialAccount(id, reason);
  if (!saved) {
    return notFound("Ad account not found.");
  }

  // Auto-terminate the active Sale Setup for this account (against the customer's
  // group). Existing sales/history records are left completely untouched.
  await terminateSaleSetupsForAccount({
    adAccountId: target.adAccountId,
    groupId: customer?.groupId || "",
  });

  cacheInvalidate(CACHE_PREFIX);
  if (social) cacheInvalidate(SOCIAL_CACHE_PREFIX);
  return ok({
    message: "Ad account unassigned from customer.",
    adAccount: saved,
    previousCustomerId,
  });
});