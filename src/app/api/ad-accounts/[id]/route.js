import { asyncHandler, ok, notFound, badRequest } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import {
  getAdAccountUiByIdentifier,
  updateAdAccountById,
  updateAdAccountStatus,
} from "@/models/adAccountModel";

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
  return ok({ message: "Ad account updated.", adAccount: account });
});