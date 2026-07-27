export {
  apiError,
  apiJson,
  badRequest,
  forbidden,
  getRequestId,
  internalError,
  safeErrorMessage,
  tooManyRequests,
  unauthorized,
  type ApiErrorBody,
  type ApiErrorOptions,
} from "@/lib/api/errors";

/** Plain JSON body for routes that wrap CORS / streaming themselves. */
export function apiErrorPayload(
  code: string,
  message: string,
  requestId: string,
): {
  error: { code: string; message: string; requestId: string };
} {
  return { error: { code, message, requestId } };
}
