type ErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
};

export type ApiErrorResponse = {
  ok: false;
  error: ErrorPayload;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function success<T>(data: T): ApiSuccessResponse<T> {
  return { ok: true, data };
}

export function error(code: string, message: string, details?: unknown): ApiErrorResponse {
  if (details === undefined) {
    return { ok: false, error: { code, message } };
  }

  return { ok: false, error: { code, message, details } };
}
