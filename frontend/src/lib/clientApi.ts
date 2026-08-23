"use client";

export class ClientApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function handle<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : undefined;
  if (!res.ok) throw new ClientApiError(res.status, body?.error || res.statusText, body?.details);
  return body as T;
}

export const clientApi = {
  get: <T = any>(path: string) => fetch(`/api${path}`, { credentials: "include" }).then((r) => handle<T>(r)),

  post: <T = any>(path: string, data?: unknown) =>
    fetch(`/api${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }).then((r) => handle<T>(r)),

  patch: <T = any>(path: string, data?: unknown) =>
    fetch(`/api${path}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }).then((r) => handle<T>(r)),

  put: <T = any>(path: string, data?: unknown) =>
    fetch(`/api${path}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }).then((r) => handle<T>(r)),

  delete: <T = any>(path: string) =>
    fetch(`/api${path}`, { method: "DELETE", credentials: "include" }).then((r) => handle<T>(r)),

  upload: <T = any>(path: string, formData: FormData) =>
    fetch(`/api${path}`, { method: "POST", credentials: "include", body: formData }).then((r) => handle<T>(r)),
};
