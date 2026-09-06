import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { approveOfficeExpenseEntry } from "@/models/officeExpenseEntryModel";
import { getRequestActor } from "@/utils/auditActor";

function toApiError(err) {
  if (err?.code === "ALREADY_APPROVED" || err?.code === "DUPLICATE_APPROVAL") {
    return new ApiError(HttpStatus.CONFLICT, err.message, { code: err.code });
  }
  if (err?.code === "ENTRY_REJECTED" || err?.code === "AWAITING_FINAL_APPROVAL") {
    return new ApiError(HttpStatus.BAD_REQUEST, err.message, { code: err.code });
  }
  return err;
}

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  let body = {};
  try {
    body = await readJsonBody(request);
  } catch {
    body = {};
  }
  const actor = (await getRequestActor(request)) || body.actor || body.approver || null;
  try {
    const entry = await approveOfficeExpenseEntry(id, { actor, note: body.note || "" });
    if (!entry) return notFound("Expense entry not found.");
    return ok({ message: "Approval recorded.", entry });
  } catch (err) {
    throw toApiError(err);
  }
});
