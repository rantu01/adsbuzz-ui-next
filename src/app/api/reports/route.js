import { asyncHandler, ok } from "@/utils/http";
import { getMonthlyReport } from "@/models/reportModel";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || "";
  const report = await getMonthlyReport(month);
  return ok({ report });
});