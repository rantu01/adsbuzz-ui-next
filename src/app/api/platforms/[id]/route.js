import { asyncHandler, ok, notFound } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { getPlatformById, updatePlatform, togglePlatformStatus, deletePlatform } from "@/models/platformModel";

export const GET = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const platform = await getPlatformById(id);
  if (!platform) {
    return notFound("Platform not found.");
  }
  return ok({ platform });
});

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const existing = await getPlatformById(id);
  if (!existing) {
    return notFound("Platform not found.");
  }

  if (body.statusOnly) {
    const platform = await togglePlatformStatus(id);
    return ok({ message: "Platform status updated.", platform });
  }

  const platform = await updatePlatform(id, body);
  return ok({ message: "Platform updated.", platform });
});

export const DELETE = asyncHandler(async (request, { params }) => {
  const { id } = await params;

  const existing = await getPlatformById(id);
  if (!existing) {
    return notFound("Platform not found.");
  }

  const platform = await deletePlatform(id);
  return ok({ message: "Platform deleted.", platform });
});
