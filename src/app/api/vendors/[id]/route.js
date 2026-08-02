import { asyncHandler, ok, notFound } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { getVendorById, updateVendor, recordVendorPayment } from "@/models/vendorModel";

export const GET = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const vendor = await getVendorById(id);
  if (!vendor) {
    return notFound("Vendor not found.");
  }
  return ok({ vendor });
});

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const existing = await getVendorById(id);
  if (!existing) {
    return notFound("Vendor not found.");
  }

  if (body.recordPayment === true) {
    const vendor = await recordVendorPayment(id, {
      amountUSD: body.amountUSD,
      paymentMethod: body.paymentMethod,
      date: body.date,
    });
    return ok({ message: "Payment recorded.", vendor });
  }

  const vendor = await updateVendor(id, body);
  return ok({ message: "Vendor updated.", vendor });
});