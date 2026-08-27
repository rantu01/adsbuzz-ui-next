import { asyncHandler, ok, badRequest } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { bulkUpdateSocialStatus } from "@/models/socialAdAccountModel";
import { cacheInvalidate } from "@/lib/cache";

export const PATCH = asyncHandler(async (request) => {
  const body = await readJsonBody(request);
  const ids = Array.isArray(body.ids) ? body.ids : [body.id];
  const status = body.status;

  if (ids.length === 0 || !status) {
    return badRequest("ids and status are required.");
  }

  const result = await bulkUpdateSocialStatus(ids, status);
  cacheInvalidate("GET:/api/social-ad-accounts");
  return ok({ message: "Social ad account statuses updated.", result });
});
