import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { submitFeedback } from "@/models/invoiceModel";
import { getRequestActor } from "@/utils/auditActor";

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const feedback = optionalString(body.feedback ?? body.reason, 2000);
  if (!feedback) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Feedback text is required.");
  }

  const screenshot = optionalString(body.screenshot, 1000);

  const actor = await getRequestActor(request);
  const invoice = await submitFeedback(id, { feedback, screenshot, actor });
  if (!invoice) {
    return notFound("Topup invoice not found.");
  }
  return ok({ message: "Feedback submitted. Moving to final approval review.", invoice });
});
