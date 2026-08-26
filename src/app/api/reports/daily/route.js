import { asyncHandler, ok, badRequest } from "@/utils/http";
import { getDailySalesReport } from "@/models/invoiceModel";

export const dynamic = "force-dynamic";

// Date-Wise Sales Report — aggregated day-by-day sales over a date range
// (defaults to the whole month when only `month` is supplied). Read-only.
export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  let from = (searchParams.get("from") || "").trim();
  let to = (searchParams.get("to") || "").trim();
  const month = (searchParams.get("month") || "").trim();

  if (month && !from && !to) {
    const [y, m] = month.split("-");
    const year = Number(y);
    const mon = Number(m);
    if (year && mon) {
      const lastDay = new Date(year, mon, 0).getDate();
      from = `${month}-01`;
      to = `${month}-${String(lastDay).padStart(2, "0")}`;
    }
  }

  if (!from && !to) {
    return badRequest("Please provide a date range (from/to) or a month.");
  }

  const report = await getDailySalesReport({ from, to });
  return ok(report);
});
