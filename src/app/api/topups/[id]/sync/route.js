import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { syncTopupStatus } from "@/models/invoiceModel";
import { getRequestActor } from "@/utils/auditActor";

export const POST = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const status = optionalString(body.status ?? body.topupStatus, 50);
  if (!status) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "status is required.");
  }

  const actor = await getRequestActor(request);
  const invoice = await syncTopupStatus(id, status, { actor });
  if (!invoice) {
    return notFound("Topup invoice not found.");
  }
  return ok({ message: "Topup status synced.", invoice });
});
