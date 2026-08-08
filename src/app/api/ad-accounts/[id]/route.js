import { asyncHandler, ok, notFound, badRequest } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import {
  getAdAccountUiByIdentifier,
  updateAdAccountById,
  updateAdAccountStatus,
  deleteAdAccount,
} from "@/models/adAccountModel";
import { cacheInvalidate } from "@/lib/cache";

const CACHE_PREFIX = "GET:/api/ad-accounts";

export const GET = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const account = await getAdAccountUiByIdentifier(id);
  if (!account) {
    return notFound("Ad account not found.");
  }
  return ok({ adAccount: account });
});

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const account = body.statusOnly
    ? await updateAdAccountStatus(id, body.status)
    : await updateAdAccountById(id, body);

  if (!account) {
    return notFound("Ad account not found.");
  }
  cacheInvalidate(CACHE_PREFIX);
  return ok({ message: "Ad account updated.", adAccount: account });
});

export const DELETE = asyncHandler(async (request, { params }) => {
  const { id } = await params;

  const existing = await getAdAccountUiByIdentifier(id);
  if (!existing) {
    return notFound("Ad account not found.");
  }

  await deleteAdAccount(id);
  cacheInvalidate(CACHE_PREFIX);
  return ok({ message: "Ad account deleted.", adAccount: existing });
});