import { asyncHandler, ok, notFound, badRequest } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import {
  getOfficeExpenseById,
  updateOfficeExpense,
  deleteOfficeExpense,
} from "@/models/officeExpenseModel";

export const GET = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const officeExpense = await getOfficeExpenseById(id);
  if (!officeExpense) {
    return notFound("Office expense category not found.");
  }
  return ok({ officeExpense });
});

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const existing = await getOfficeExpenseById(id);
  if (!existing) {
    return notFound("Office expense category not found.");
  }

  try {
    const officeExpense = await updateOfficeExpense(id, body);
    return ok({ message: "Office expense category updated.", officeExpense });
  } catch (err) {
    if (err && err.message === "DUPLICATE") {
      return badRequest("A category with this name already exists.");
    }
    throw err;
  }
});

export const DELETE = asyncHandler(async (request, { params }) => {
  const { id } = await params;

  const existing = await getOfficeExpenseById(id);
  if (!existing) {
    return notFound("Office expense category not found.");
  }

  const officeExpense = await deleteOfficeExpense(id);
  return ok({ message: "Office expense category deleted.", officeExpense });
});
