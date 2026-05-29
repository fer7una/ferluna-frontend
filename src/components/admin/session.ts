export type AdminSession = {
  accessToken: string;
  expiresAt: number;
};

const ADMIN_SESSION_STORAGE_KEY = "ferluna-admin-session";

export function getStoredAdminSession(): AdminSession | null {
  try {
    const rawSession = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!rawSession) return null;

    const session = JSON.parse(rawSession) as Partial<AdminSession>;
    if (
      typeof session.accessToken !== "string" ||
      session.accessToken.length === 0 ||
      typeof session.expiresAt !== "number" ||
      !Number.isFinite(session.expiresAt)
    ) {
      clearStoredAdminSession();
      return null;
    }
    if (Date.now() >= session.expiresAt * 1000) {
      clearStoredAdminSession();
      return null;
    }

    return {
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
    };
  } catch {
    clearStoredAdminSession();
    return null;
  }
}

export function storeAdminSession(session: AdminSession) {
  try {
    sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    return;
  }
}

export function clearStoredAdminSession() {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    return;
  }
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatSessionExpiry(unixSeconds: number) {
  if (!Number.isFinite(unixSeconds)) {
    return "sesión inválida";
  }

  return DATE_TIME_FORMATTER.format(new Date(unixSeconds * 1000));
}
