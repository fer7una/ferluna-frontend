import { fallbackSiteData } from "./contentFallback";
import type { SiteData } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type AdminLoginResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: number;
};

export async function fetchSiteData(signal?: AbortSignal): Promise<SiteData> {
  const response = await fetch(`${API_BASE_URL}/api/site`, {
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API responded with ${response.status}`);
  }

  return normalizeSiteData((await response.json()) as Partial<SiteData>);
}

export async function loginAdmin(password: string, signal?: AbortSignal): Promise<AdminLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
    signal,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readApiError(response));
  }

  return (await response.json()) as AdminLoginResponse;
}

export async function fetchAdminSiteData(token: string, signal?: AbortSignal): Promise<SiteData> {
  const response = await fetch(`${API_BASE_URL}/api/admin/site`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readApiError(response));
  }

  return (await response.json()) as SiteData;
}

export async function saveAdminSiteData(
  token: string,
  data: Pick<SiteData, "sections" | "sectionItems" | "momentaryTabs">,
  signal?: AbortSignal,
) {
  const response = await fetch(`${API_BASE_URL}/api/admin/site`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    signal,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readApiError(response));
  }

  return (await response.json()) as Pick<SiteData, "sections" | "sectionItems" | "momentaryTabs">;
}

async function readApiError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? `API responded with ${response.status}`;
  } catch {
    return `API responded with ${response.status}`;
  }
}

function normalizeSiteData(payload: Partial<SiteData>): SiteData {
  return {
    profile: payload.profile ?? fallbackSiteData.profile,
    cv: payload.cv ?? fallbackSiteData.cv,
    projects: arrayOrFallback(payload.projects, fallbackSiteData.projects),
    posts: arrayOrFallback(payload.posts, fallbackSiteData.posts),
    docs: arrayOrFallback(payload.docs, fallbackSiteData.docs),
    sections: arrayOrFallback(payload.sections, fallbackSiteData.sections),
    sectionItems: arrayOrFallback(payload.sectionItems, fallbackSiteData.sectionItems),
    momentaryTabs: arrayOrFallback(payload.momentaryTabs, fallbackSiteData.momentaryTabs),
  };
}

function arrayOrFallback<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? value : fallback;
}

export { fallbackSiteData };
