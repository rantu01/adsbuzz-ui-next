import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { finalApproveOfficeExpenseEntry } from "@/models/officeExpenseEntryModel";
import { getRequestActor } from "@/utils/auditActor";

function toApiError(err) {
  if (err?.code === "ALREADY_APPROVED" || err?.code === "DUPLICATE_APPROVAL") {
    return new ApiError(HttpStatus.CONFLICT, err.message, { code: err.code });
  }
  if (err?.code === "ENTRY_REJECTED" || err?.code === "INITIALS_INCOMPLETE") {
    return new ApiError(HttpStatus.BAD_REQUEST, err.message, { code: err.code, pending: err.pending ?? null });
  }
  if (err?.code === "INSUFFICIENT_BALANCE") {
    return new ApiError(HttpStatus.BAD_REQUEST, err.message, { code: "INSUFFICIENT_BALANCE", available: err.available ?? 0 });
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
    const entry = await finalApproveOfficeExpenseEntry(id, { actor, note: body.note || "" });
    if (!entry) return notFound("Expense entry not found.");
    return ok({ message: "Expense finally approved. Amount deducted from Cash In Hand.", entry });
  } catch (err) {
    throw toApiError(err);
  }
});
