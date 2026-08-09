import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, requireFields, optionalString } from "@/utils/validate";
import {
  listCustomers,
  createCustomer,
} from "@/models/customerModel";
import { getPagination, paginate } from "@/utils/pagination";
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/cache";

const CACHE_PREFIX = "GET:/api/customers";

export const GET = asyncHandler(async (request) => {
  const key = `${CACHE_PREFIX}:${request.url}`;
  const cached = cacheGet(key);
  if (cached) {
    return ok(cached);
  }

  const { searchParams } = new URL(request.url);
  const customers = await listCustomers({
    search: searchParams.get("search") || "",
    status: searchParams.get("status") || "",
    favorite: searchParams.get("favorite") || "",
  });

  // The UI loads the full customer list for own filtering/pagination. Only apply
  // server-side paging when an explicit page/limit was requested.
  let payload;
  if (searchParams.has("page") || searchParams.has("limit")) {
    const p = paginate(customers, getPagination(searchParams, { page: 1, limit: 50 }));
    payload = { customers: p.data, total: p.total, page: p.page, limit: p.limit, totalPages: p.totalPages };
  } else {
    payload = { customers, total: customers.length, page: 1, limit: customers.length, totalPages: 1 };
  }
  cacheSet(key, payload);
  return ok(payload);
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

  cacheInvalidate(CACHE_PREFIX);

  return ok({ message: "Customer created.", customer }, HttpStatus.CREATED);
});
