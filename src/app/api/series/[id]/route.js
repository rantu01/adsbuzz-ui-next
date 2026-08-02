import { asyncHandler, ok, notFound, badRequest } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { getSeriesByCode, updateSeries } from "@/models/seriesModel";

export const GET = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const series = await getSeriesByCode(id);
  if (!series) {
    return notFound("Series not found.");
  }
  return ok({ series });
});

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const existing = await getSeriesByCode(id);
  if (!existing) {
    return notFound("Series not found.");
  }

  const series = await updateSeries(id, body);
  return ok({ message: "Series updated.", series });
});