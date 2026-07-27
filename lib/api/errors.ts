import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
};

export type ApiErrorOptions = {
  code: string;
  message: string;
  status: number;
  requestId?: string;
  headers?: HeadersInit;
};

/** Create or reuse a request correlation id. */
export function getRequestId(request?: Request | null): string {
  const fromHeader = request?.headers.get("x-request-id")?.trim();
  if (fromHeader && /^[A-Za-z0-9._-]{8,128}$/.test(fromHeader)) {
    return fromHeader;
  }
  return randomUUID();
}

export function apiError(options: ApiErrorOptions): NextResponse<ApiErrorBody> {
  const requestId = options.requestId ?? randomUUID();
  const body: ApiErrorBody = {
    error: {
      code: options.code,
      message: options.message,
      requestId,
    },
  };

  const headers = new Headers(options.headers);
  headers.set("x-request-id", requestId);

  return NextResponse.json(body, {
    status: options.status,
    headers,
  });
}

export function unauthorized(
  requestId?: string,
  message = "Unauthorized",
): NextResponse<ApiErrorBody> {
  return apiError({
    code: "unauthorized",
    message,
    status: 401,
    requestId,
  });
}

export function forbidden(
  requestId?: string,
  message = "Project not found or access denied.",
): NextResponse<ApiErrorBody> {
  return apiError({
    code: "forbidden",
    message,
    status: 403,
    requestId,
  });
}

export function badRequest(
  message: string,
  requestId?: string,
  code = "bad_request",
): NextResponse<ApiErrorBody> {
  return apiError({ code, message, status: 400, requestId });
}

export function tooManyRequests(
  retryAfterSeconds: number,
  requestId?: string,
): NextResponse<ApiErrorBody> {
  return apiError({
    code: "rate_limited",
    message: "Too many requests. Try again shortly.",
    status: 429,
    requestId,
    headers: { "Retry-After": String(retryAfterSeconds) },
  });
}

export function internalError(
  requestId?: string,
  message = "Something went wrong. Please try again.",
): NextResponse<ApiErrorBody> {
  return apiError({
    code: "internal_error",
    message,
    status: 500,
    requestId,
  });
}

/** Attach request id to a successful JSON response. */
export function apiJson<T>(
  data: T,
  init: { status?: number; requestId: string; headers?: HeadersInit },
): NextResponse<T> {
  const headers = new Headers(init.headers);
  headers.set("x-request-id", init.requestId);
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers,
  });
}

/** Map unknown errors to a safe user-facing message (no secrets). */
export function safeErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error instanceof Error && error.message) {
    const msg = error.message;
    if (/token|secret|password|api[_-]?key|service.?role/i.test(msg)) {
      return fallback;
    }
    if (msg.length > 240) return fallback;
    return msg;
  }
  return fallback;
}
