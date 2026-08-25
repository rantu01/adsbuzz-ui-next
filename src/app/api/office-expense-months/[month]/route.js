import { asyncHandler, ok, notFound, badRequest } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import {
  getOfficeExpenseMonthByCode,
  updateOfficeExpenseMonth,
  deleteOfficeExpenseMonth,
} from "@/models/officeExpenseMonthModel";

export const GET = asyncHandler(async (request, { params }) => {
  const { month } = await params;
  const monthDoc = await getOfficeExpenseMonthByCode(month);
  if (!monthDoc) return notFound("Month not found.");
  return ok({ month: monthDoc });
});

export const PATCH = asyncHandler(async (request, { params }) => {
  const { month } = await params;
  const body = await readJsonBody(request);

  const existing = await getOfficeExpenseMonthByCode(month);
  if (!existing) return notFound("Month not found.");

  const updated = await updateOfficeExpenseMonth(month, body);
  return ok({ message: "Month updated.", month: updated });
});

export const DELETE = asyncHandler(async (request, { params }) => {
  const { month } = await params;
  const existing = await getOfficeExpenseMonthByCode(month);
  if (!existing) return notFound("Month not found.");

  const removed = await deleteOfficeExpenseMonth(month);
  return ok({ message: "Month deleted.", month: removed });
});
