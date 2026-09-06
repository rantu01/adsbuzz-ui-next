import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { rejectOfficeExpenseEntry } from "@/models/officeExpenseEntryModel";
import { getRequestActor } from "@/utils/auditActor";

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);
  if (!String(body?.note || "").trim()) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "A note/reason is required to reject an entry.", { code: "NOTE_REQUIRED" });
  }
  const actor = (await getRequestActor(request)) || body.actor || null;
  try {
    const entry = await rejectOfficeExpenseEntry(id, { actor, note: body.note });
    if (!entry) return notFound("Expense entry not found.");
    return ok({ message: "Entry rejected.", entry });
  } catch (err) {
    if (err?.code === "NOTE_REQUIRED") throw new ApiError(HttpStatus.BAD_REQUEST, err.message, { code: err.code });
    throw err;
  }
});
