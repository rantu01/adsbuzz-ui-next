import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { listVendors, createVendor } from "@/models/vendorModel";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const vendors = await listVendors({
    search: searchParams.get("search") || "",
  });
  return ok({ vendors, total: vendors.length });
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  if (!body.name) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Vendor name is required.");
  }

  try {
    const vendor = await createVendor(body);
    return ok({ message: "Vendor added.", vendor }, HttpStatus.CREATED);
  } catch (err) {
    if (err.message === "DUPLICATE") {
      throw new ApiError(HttpStatus.CONFLICT, "A vendor with this ID already exists.");
    }
    throw err;
  }
});