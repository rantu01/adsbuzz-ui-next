import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { listSeries, createSeries } from "@/models/seriesModel";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const series = await listSeries({
    search: searchParams.get("search") || "",
  });
  return ok({ series, total: series.length });
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const seriesId = optionalString(body.seriesId, 100);
  const seriesName = optionalString(body.seriesName, 200);

  if (!seriesName) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Series name is required.");
  }

  try {
    const series = await createSeries({
      seriesId,
      seriesName,
      platform: body.platform,
      status: body.status,
    });
    return ok({ message: "Series created.", series }, HttpStatus.CREATED);
  } catch (err) {
    if (err.message === "DUPLICATE") {
      throw new ApiError(HttpStatus.CONFLICT, "A series with this code already exists.");
    }
    throw err;
  }
});