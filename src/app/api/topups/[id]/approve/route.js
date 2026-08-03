import { asyncHandler, ok, notFound } from "@/utils/http";
import { approveInvoice } from "@/models/invoiceModel";

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const invoice = await approveInvoice(id);
  if (!invoice) {
    return notFound("Topup invoice not found.");
  }
  return ok({ message: "Topup approved.", invoice });
});
