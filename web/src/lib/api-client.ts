const jsonHeaders = { "Content-Type": "application/json" };

async function parseError(res: Response, json: unknown): Promise<string> {
  if (json && typeof json === "object" && "error" in json && typeof (json as { error: string }).error === "string") {
    return (json as { error: string }).error;
  }
  return `Request failed (${res.status})`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(await parseError(res, json));
  }
  if (!json || typeof json !== "object" || !("data" in json)) {
    throw new Error("Invalid API response");
  }
  return (json as { data: T }).data;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(await parseError(res, json));
  }
  if (!json || typeof json !== "object" || !("data" in json)) {
    throw new Error("Invalid API response");
  }
  return (json as { data: T }).data;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(await parseError(res, json));
  }
  if (!json || typeof json !== "object" || !("data" in json)) {
    throw new Error("Invalid API response");
  }
  return (json as { data: T }).data;
}
