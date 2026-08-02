import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};

export function ok(data, status = HttpStatus.OK) {
  return NextResponse.json({ success: true, ...data }, { status });
}

export function fail(message, status = HttpStatus.BAD_REQUEST, details) {
  return NextResponse.json({ success: false, message, details }, { status });
}

export function notFound(message = "Resource not found") {
  return fail(message, HttpStatus.NOT_FOUND);
}

export function unauthorized(message = "Authentication required") {
  return fail(message, HttpStatus.UNAUTHORIZED);
}

export function forbidden(message = "You do not have permission to perform this action") {
  return fail(message, HttpStatus.FORBIDDEN);
}

export function badRequest(message = "Invalid request") {
  return fail(message, HttpStatus.BAD_REQUEST);
}

export function conflict(message = "Resource already exists") {
  return fail(message, HttpStatus.CONFLICT);
}

export function asyncHandler(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

export function handleApiError(error) {
  if (error instanceof ApiError) {
    return fail(error.message, error.status, error.details);
  }

  if (error && error.name === "MongoServerError" && error.code === 11000) {
    return fail("Duplicate value. This record already exists.", HttpStatus.CONFLICT);
  }

  if (error && error.name === "ValidationError") {
    return fail(error.message, HttpStatus.UNPROCESSABLE_ENTITY);
  }

  console.error("[API Error]", error);
  return fail(
    error?.message || "Internal server error",
    HttpStatus.INTERNAL_SERVER_ERROR
  );
}
