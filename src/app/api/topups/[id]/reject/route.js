import { asyncHandler, ok, notFound } from "@/utils/http";
import { rejectInvoice } from "@/models/invoiceModel";

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const invoice = await rejectInvoice(id);
  if (!invoice) {
    return notFound("Topup invoice not found.");
  }
  return ok({ message: "Topup rejected.", invoice });
});
