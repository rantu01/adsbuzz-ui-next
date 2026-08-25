import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import {
  listOfficeExpenseMonths,
  createOfficeExpenseMonth,
} from "@/models/officeExpenseMonthModel";

export const GET = asyncHandler(async (request) => {
  const months = await listOfficeExpenseMonths();
  return ok({ months, total: months.length });
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const month = optionalString(body.month, 20);
  if (!month || !month.trim()) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Month (YYYY-MM) is required.");
  }

  try {
    const created = await createOfficeExpenseMonth({
      month,
      preparedBy: body.preparedBy,
      cashInHand: body.cashInHand,
    });
    return ok({ message: "Month created.", month: created }, HttpStatus.CREATED);
  } catch (err) {
    if (err.message === "MONTH_REQUIRED") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Month (YYYY-MM) is required.");
    }
    if (err.message === "DUPLICATE") {
      throw new ApiError(HttpStatus.CONFLICT, "This month already exists.");
    }
    throw err;
  }
});
