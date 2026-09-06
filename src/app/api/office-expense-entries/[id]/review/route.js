import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { reviewOfficeExpenseEntry } from "@/models/officeExpenseEntryModel";
import { getRequestActor } from "@/utils/auditActor";

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);
  if (!String(body?.note || "").trim()) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "A note/reason is required to request a review.", { code: "NOTE_REQUIRED" });
  }
  const actor = (await getRequestActor(request)) || body.actor || null;
  try {
    const entry = await reviewOfficeExpenseEntry(id, { actor, note: body.note });
    if (!entry) return notFound("Expense entry not found.");
    return ok({ message: "Entry marked as Review Need.", entry });
  } catch (err) {
    if (err?.code === "NOTE_REQUIRED") throw new ApiError(HttpStatus.BAD_REQUEST, err.message, { code: err.code });
    if (err?.code === "ALREADY_APPROVED") throw new ApiError(HttpStatus.CONFLICT, err.message, { code: err.code });
    throw err;
  }
});
