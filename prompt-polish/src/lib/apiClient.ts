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
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const parsed = await parseJsonResponse(response, url);
  if (!isApiSuccess<T>(parsed) && !isApiError(parsed)) {
    throw new Error(`Invalid API envelope from ${url} (${response.status})`);
  }

  const envelope: ApiEnvelope<T> = parsed;

  if (envelope.ok === false) {
    throw new Error(envelope.error.message);
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
