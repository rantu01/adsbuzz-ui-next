import { asyncHandler, ok, notFound, badRequest } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { getCustomerById, updateCustomer } from "@/models/customerModel";

export const GET = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) {
    return notFound("Customer not found.");
  }
  return ok({ customer });
});

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const existing = await getCustomerById(id);
  if (!existing) {
    return notFound("Customer not found.");
  }

  const customer = await updateCustomer(id, body);
  return ok({ message: "Customer updated.", customer });
});
