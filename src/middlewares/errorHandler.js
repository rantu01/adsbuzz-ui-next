import logger from "@/utils/logger";
import { handleApiError } from "@/utils/http";

export function errorHandler(error, request) {
  logger.error(`Request ${request?.url || ""} failed.`, error);
  return handleApiError(error);
}

export default errorHandler;
