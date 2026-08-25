import { asyncHandler, ok, notFound, badRequest } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import {
  getOfficeExpenseEntryById,
  updateOfficeExpenseEntry,
  deleteOfficeExpenseEntry,
} from "@/models/officeExpenseEntryModel";

export const GET = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const entry = await getOfficeExpenseEntryById(id);
  if (!entry) return notFound("Expense entry not found.");
  return ok({ entry });
});

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const existing = await getOfficeExpenseEntryById(id);
  if (!existing) return notFound("Expense entry not found.");

  const entry = await updateOfficeExpenseEntry(id, body);
  return ok({ message: "Expense entry updated.", entry });
});

export const DELETE = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const existing = await getOfficeExpenseEntryById(id);
  if (!existing) return notFound("Expense entry not found.");

  const entry = await deleteOfficeExpenseEntry(id);
  return ok({ message: "Expense entry deleted.", entry });
});
