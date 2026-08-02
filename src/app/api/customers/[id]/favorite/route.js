import { asyncHandler, ok, notFound } from "@/utils/http";
import { toggleCustomerFavorite } from "@/models/customerModel";

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const customer = await toggleCustomerFavorite(id);
  if (!customer) {
    return notFound("Customer not found.");
  }

  return ok({
    message: customer.favorite ? "Added to favorites." : "Removed from favorites.",
    customer,
  });
});
