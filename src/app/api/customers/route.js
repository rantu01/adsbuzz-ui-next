import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, requireFields, optionalString } from "@/utils/validate";
import {
  listCustomers,
  createCustomer,
} from "@/models/customerModel";
import { getPagination, paginate } from "@/utils/pagination";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const customers = await listCustomers({
    search: searchParams.get("search") || "",
    status: searchParams.get("status") || "",
    favorite: searchParams.get("favorite") || "",
  });
  const p = paginate(customers, getPagination(searchParams, { page: 1, limit: 50 }));
  return ok({ customers: p.data, total: p.total, page: p.page, limit: p.limit, totalPages: p.totalPages });
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  requireFields(body, ["name", "email", "companyName"]);

  const name = optionalString(body.name, 200);
  const email = optionalString(body.email, 254).toLowerCase();
  const companyName = optionalString(body.companyName, 200);

  if (!name) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Customer name is required.");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "A valid email is required.");
  }

  const customer = await createCustomer({
    name,
    email,
    phone: body.phone,
    companyName,
    groupId: body.groupId,
    status: body.status,
    creditLimitUSD: body.creditLimitUSD,
  });

  return ok({ message: "Customer created.", customer }, HttpStatus.CREATED);
});
