import { asyncHandler, ok, badRequest } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { bulkUpdateStatus } from "@/models/adAccountModel";

export const PATCH = asyncHandler(async (request) => {
  const body = await readJsonBody(request);
  const ids = Array.isArray(body.ids) ? body.ids : [body.id];
  const status = body.status;

  if (ids.length === 0 || !status) {
    return badRequest("ids and status are required.");
  }

  const result = await bulkUpdateStatus(ids, status);
  return ok({ message: "Ad account statuses updated.", result });
});