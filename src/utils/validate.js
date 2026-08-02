import { ApiError, HttpStatus } from "@/utils/http";

export function requireFields(body, fields) {
  const missing = [];
  for (const field of fields) {
    const value = body?.[field];
    if (value === undefined || value === null || value === "") {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      `Missing required field(s): ${missing.join(", ")}`
    );
  }
}

export function requirePositiveNumber(value, fieldName = "value") {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new ApiError(HttpStatus.BAD_REQUEST, `${fieldName} must be a positive number.`);
  }
  return num;
}

export function requireEnum(value, allowed, fieldName = "value") {
  if (!allowed.includes(value)) {
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      `${fieldName} must be one of: ${allowed.join(", ")}`
    );
  }
  return value;
}

export function optionalString(value, maxLength = Infinity) {
  if (value === undefined || value === null) return "";
  const str = String(value).trim();
  if (str.length > maxLength) {
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      `Value exceeds maximum length of ${maxLength} characters.`
    );
  }
  return str;
}

export function normalizeEmail(value, fieldName = "email") {
  const email = optionalString(value, 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, `${fieldName} must be a valid email address.`);
  }
  return email;
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid JSON body.");
  }
}
