import { NextResponse } from "next/server";
import { apiErrorPayload, getRequestId } from "@/lib/api";

/** Standard error JSON + x-request-id header. */
export function jsonApiError(
  request: Request | null,
  options: {
    code: string;
    message: string;
    status: number;
    headers?: Record<string, string>;
    extra?: Record<string, unknown>;
  },
): NextResponse {
  const requestId = getRequestId(request);
  const headers = new Headers(options.headers);
  headers.set("x-request-id", requestId);
  return NextResponse.json(
    {
      ...apiErrorPayload(options.code, options.message, requestId),
      ...options.extra,
    },
    { status: options.status, headers },
  );
}
