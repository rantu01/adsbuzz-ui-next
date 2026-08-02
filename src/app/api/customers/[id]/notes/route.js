import { asyncHandler, ok, notFound } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { updateCustomerNotes } from "@/models/customerModel";

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const notes = String(body.notes ?? "");
  const customer = await updateCustomerNotes(id, notes);
  if (!customer) {
    return notFound("Customer not found.");
  }

  return ok({ message: "Customer notes updated.", customer });
});
