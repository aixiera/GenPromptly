type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type ApiEnvelope<T> = ApiSuccess<T> | ApiError;

const ACTIVE_ORG_STORAGE_KEY = "prompt_polish_active_org_id";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readActiveOrgId(): string | null {
  if (!canUseStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
  const orgId = raw?.trim();
  return orgId || null;
}

export function setActiveOrg(activeOrgId: string): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, activeOrgId);
}

export function clearActiveOrg(): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 429 || error.code === "RATE_LIMITED") {
      return "Too many requests. Try again in a minute.";
    }
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiSuccess<T>(value: unknown): value is ApiSuccess<T> {
  return isObject(value) && value.ok === true && "data" in value;
}

function isApiError(value: unknown): value is ApiError {
  if (!isObject(value) || value.ok !== false || !("error" in value)) {
    return false;
  }

  const errorValue = value.error;
  return (
    isObject(errorValue) &&
    typeof errorValue.code === "string" &&
    typeof errorValue.message === "string"
  );
}

async function parseJsonResponse(response: Response, url: string): Promise<unknown> {
  const raw = await response.text();
  if (!raw) {
    throw new Error(`Empty response body from ${url} (${response.status})`);
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    const preview = raw.slice(0, 200).replace(/\s+/g, " ").trim();
    throw new Error(
      `Expected JSON response from ${url} (${response.status}). Received: ${preview || "<non-json body>"}`
    );
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const activeOrgId = readActiveOrgId();

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(activeOrgId ? { "x-org-id": activeOrgId } : {}),
      ...(init?.headers ?? {}),
    },
  });

  let parsed: unknown;
  try {
    parsed = await parseJsonResponse(response, url);
  } catch (err: unknown) {
    if (response.status === 429) {
      throw new ApiRequestError("Too many requests. Try again in a minute.", 429, "RATE_LIMITED");
    }
    throw err;
  }

  if (!isApiSuccess<T>(parsed) && !isApiError(parsed)) {
    throw new ApiRequestError(`Invalid API envelope from ${url} (${response.status})`, response.status);
  }

  const envelope: ApiEnvelope<T> = parsed;

  if (envelope.ok === false) {
    if (
      activeOrgId &&
      (envelope.error.code === "ORG_NOT_FOUND" || envelope.error.code === "ORG_NOT_ACCESSIBLE")
    ) {
      clearActiveOrg();
      return request<T>(url, init);
    }

    throw new ApiRequestError(
      envelope.error.message,
      response.status,
      envelope.error.code,
      envelope.error.details
    );
  }

  return envelope.data;
}

export async function apiGet<T>(url: string): Promise<T> {
  return request<T>(url, { method: "GET" });
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function apiDelete<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: "DELETE",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
