import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import {
  listOfficeExpenseEntries,
  createOfficeExpenseEntry,
} from "@/models/officeExpenseEntryModel";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const entries = await listOfficeExpenseEntries({
    month: searchParams.get("month") || "",
    category: searchParams.get("category") || "",
    search: searchParams.get("search") || "",
  });
  return ok({ entries, total: entries.length });
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const month = optionalString(body.month, 20);
  const category = optionalString(body.category, 200);
  if (!month || !month.trim()) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Month is required.");
  }
  if (!category || !category.trim()) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Category is required.");
  }

  try {
    const entry = await createOfficeExpenseEntry({
      month,
      voucherNo: body.voucherNo,
      category,
      subCategory: body.subCategory,
      description: body.description,
      amount: body.amount,
      date: body.date,
    });
    return ok({ message: "Expense entry created.", entry }, HttpStatus.CREATED);
  } catch (err) {
    if (err.message === "MONTH_REQUIRED") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Month is required.");
    }
    if (err.message === "CATEGORY_REQUIRED") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Category is required.");
    }
    throw err;
  }
});
