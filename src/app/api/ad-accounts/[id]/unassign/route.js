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

  const account = await getAdAccountUiByIdentifier(id);
  const social = account ? null : await getSocialAdAccountById(id);
  const target = account || social;
  if (!target) {
    return notFound("Ad account not found.");
  }

  // Capture the assigned customer before unassigning so the topup setup tied to
  // that customer/account can be auto-terminated afterwards.
  const customer = target.assignedCustomer ? await getCustomerById(target.assignedCustomer) : null;

  const saved = account
    ? await unassignAccount(id)
    : await unassignSocialAccount(id);
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
  return ok({ message: "Ad account unassigned from customer.", adAccount: saved });
});