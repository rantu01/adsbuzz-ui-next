import { asyncHandler, ok } from "@/utils/http";
import { getOfficeExpenseDashboard, getOfficeExpenseOverview } from "@/models/officeExpenseEntryModel";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year") || "";
  const dashboard = await getOfficeExpenseDashboard(year);
  const overview = await getOfficeExpenseOverview();
  return ok({ dashboard, overview });
});
