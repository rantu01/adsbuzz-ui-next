import { asyncHandler, ok, notFound } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { getSocialAdAccountById, updateSocialAdAccount, deleteSocialAdAccount } from "@/models/socialAdAccountModel";
import { cacheInvalidate } from "@/lib/cache";

const CACHE_PREFIX = "GET:/api/social-ad-accounts";

export const GET = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const account = await getSocialAdAccountById(id);
  if (!account) {
    return notFound("Social ad account not found.");
  }
  return ok({ adAccount: account });
});

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const account = await updateSocialAdAccount(id, body);
  if (!account) {
    return notFound("Social ad account not found.");
  }
  cacheInvalidate(CACHE_PREFIX);
  return ok({ message: "Social ad account updated.", adAccount: account });
});

export const DELETE = asyncHandler(async (request, { params }) => {
  const { id } = await params;

  const existing = await getSocialAdAccountById(id);
  if (!existing) {
    return notFound("Social ad account not found.");
  }

  await deleteSocialAdAccount(id);
  cacheInvalidate(CACHE_PREFIX);
  return ok({ message: "Social ad account deleted.", adAccount: existing });
});
