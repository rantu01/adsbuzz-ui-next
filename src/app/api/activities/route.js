import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { listActivities, createActivity } from "@/models/activityModel";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit")) || 100;
  const activities = await listActivities({ limit });
  return ok({ activities, total: activities.length });
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const action = optionalString(body.action, 200);
  if (!action) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "action is required.");
  }

  const activity = await createActivity(body);
  return ok({ message: "Activity logged.", activity }, HttpStatus.CREATED);
});
