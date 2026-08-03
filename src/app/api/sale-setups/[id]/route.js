import { asyncHandler, ok, notFound } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { getSaleSetupById, updateSaleSetup } from "@/models/saleSetupModel";

export const GET = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const setup = await getSaleSetupById(id);
  if (!setup) {
    return notFound("Sale setup not found.");
  }
  return ok({ setup });
});

export const PUT = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const existing = await getSaleSetupById(id);
  if (!existing) {
    return notFound("Sale setup not found.");
  }

  const setup = await updateSaleSetup(id, body);
  return ok({ message: "Sale setup updated.", setup });
});
