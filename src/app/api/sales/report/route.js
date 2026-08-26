import { asyncHandler, ok } from "@/utils/http";
import { getSalesEntryReport } from "@/models/invoiceModel";

// Aggregated Sales Entry reports (day-wise / month-wise counts + amounts).
// Read-only and scoped to reporting — it does not alter any existing data.
export const GET = asyncHandler(async () => {
  const report = await getSalesEntryReport();
  return ok(report);
});
