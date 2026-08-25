import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import {
  listOfficeExpenses,
  createOfficeExpense,
} from "@/models/officeExpenseModel";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const officeExpenses = await listOfficeExpenses({
    search: searchParams.get("search") || "",
  });
  return ok({ officeExpenses, total: officeExpenses.length });
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const mainCategory = optionalString(body.mainCategory, 200);
  if (!mainCategory || !mainCategory.trim()) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Main category is required.");
  }

  try {
    const officeExpense = await createOfficeExpense({
      mainCategory,
      subCategories: body.subCategories,
    });
    return ok({ message: "Office expense category created.", officeExpense }, HttpStatus.CREATED);
  } catch (err) {
    if (err.message === "DUPLICATE") {
      throw new ApiError(HttpStatus.CONFLICT, "A category with this name already exists.");
    }
    if (err.message === "MAIN_CATEGORY_REQUIRED") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Main category is required.");
    }
    throw err;
  }
});
