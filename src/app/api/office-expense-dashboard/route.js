import { asyncHandler, ok } from "@/utils/http";
import { getOfficeExpenseDashboard } from "@/models/officeExpenseEntryModel";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year") || "";
  const dashboard = await getOfficeExpenseDashboard(year);
  return ok({ dashboard });
});
