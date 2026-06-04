import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import {
  ApiError,
  fetchAdminSiteData,
  saveAdminSiteData,
  type AdminContentData,
} from "../../api";
import {
  applyVisualOrder,
  emptyDoc,
  emptyLink,
  emptyMomentaryItem,
  emptySection,
  emptySectionItem,
  emptyTab,
  hasUnsavedChanges,
  itemsForDirty,
  nextCollectionOrder,
  normalizeOptionalText,
  prepareForSave,
  sectionForDirty,
  tabForDirty,
  validateDoc as validateContentDoc,
} from "../../features/adminContent/document";
import { ICON_KEYS } from "../../icons";
import type {
  LinkKind,
  MomentaryItem,
  MomentaryTab,
  ProfileLink,
  SectionItem,
  SiteVisualSettings,
  SiteSection,
} from "../../types";
import {
  CheckboxField,
  CollectionEditor,
  DateTimeField,
  NumberField,
  SelectField,
  TagsField,
  TextAreaField,
  TextField,
} from "./fields";
import {
  clearStoredAdminSession,
  formatSessionExpiry,
  getStoredAdminSession,
} from "./session";

const ICON_OPTIONS = ICON_KEYS.map((key) => ({ value: key, label: key }));
const SESSION_EXPIRY_AUTOSAVE_LEAD_MS = 30_000;
const LINK_KIND_OPTIONS: { value: LinkKind; label: string }[] = [
  { value: "github", label: "GitHub" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "mail", label: "Email" },
  { value: "web", label: "Web" },
];
const FIELD_HELP = {
  profile: {
    name: "Nombre público que aparece como identidad principal del portal.",
    role: "Rol profesional que se muestra junto al nombre.",
    location: "Ubicación pública asociada al perfil.",
    email: "Correo de contacto público.",
    tagline: "Frase breve que resume la propuesta o enfoque del perfil.",
    avatarAlt: "Texto alternativo usado por lectores de pantalla para describir el avatar.",
    highlights: "Lista corta de ideas destacadas del perfil, separadas por comas.",
  },
  visual: {
    sectionOrbitDurationSeconds: "Segundos que tarda la órbita de secciones en dar una vuelta completa.",
    momentaryOrbitDurationSeconds: "Segundos que tarda la órbita de pestañas momentáneas en dar una vuelta completa.",
  },
  link: {
    label: "Texto interno para identificar el enlace de marca.",
    href: "URL o mailto al que apunta el enlace.",
    kind: "Tipo de enlace; decide qué icono se muestra en la cabecera.",
  },
  section: {
    id: "Identificador único de la sección; también vincula sus items.",
    route: "Ruta pública sin barra inicial, por ejemplo cv o projects.",
    label: "Texto corto del botón que aparece en la órbita 1.",
    eyebrow: "Texto pequeño que aparece encima del título de la sección.",
    title: "Título principal de la vista de sección.",
    iconKey: "Icono del catálogo visual usado en el botón orbital.",
    angle: "Posición inicial del botón en la órbita, expresada en grados.",
    order: "Número usado para ordenar secciones; menor aparece antes.",
    description: "Texto descriptivo de la sección. Admite markdown básico: **negrita**, *cursiva*, `código`, enlaces y listas.",
    visibleFrom: "Fecha desde la que la sección puede aparecer; vacío significa sin inicio programado.",
    visibleUntil: "Fecha desde la que la sección deja de aparecer; vacío significa sin final programado.",
    enabled: "Activa o desactiva la sección sin borrarla.",
  },
  tab: {
    id: "Identificador único de la pestaña momentánea; también vincula sus items.",
    label: "Texto del botón que aparece en la órbita 2.",
    iconKey: "Icono del catálogo visual usado en la pestaña.",
    angle: "Posición inicial del botón en la órbita, expresada en grados.",
    order: "Número usado para ordenar pestañas; menor aparece antes.",
    visibleFrom: "Fecha desde la que la pestaña puede aparecer; vacío significa sin inicio programado.",
    visibleUntil: "Fecha desde la que la pestaña deja de aparecer; vacío significa sin final programado.",
    enabled: "Activa o desactiva la pestaña sin borrarla.",
  },
  item: {
    id: "Identificador único del item dentro del documento de contenido.",
    kind: "Tipo semántico del item, por ejemplo card, project, post, doc o note.",
    iconKey: "Icono del catálogo visual usado en la tarjeta.",
    kicker: "Etiqueta corta que aparece encima del título de la tarjeta.",
    title: "Título principal de la tarjeta.",
    meta: "Dato secundario opcional, como empresa, estado o subtítulo.",
    href: "Enlace opcional de la tarjeta; si está vacío no se muestra acción.",
    order: "Número usado para ordenar items; menor aparece antes.",
    description: "Texto principal de la tarjeta. Admite markdown básico: **negrita**, *cursiva*, `código`, enlaces y listas.",
    tags: "Etiquetas visibles de la tarjeta, separadas por comas.",
    visibleFrom: "Fecha desde la que el item puede aparecer; vacío significa sin inicio programado.",
    visibleUntil: "Fecha desde la que el item deja de aparecer; vacío significa sin final programado.",
    featured: "Marca el item como destacado para estilos o tratamiento visual.",
  },
};

// Which entity the sidebar is editing. Sections/tabs are addressed by index so
// the selection survives the user editing their (mutable) id.
type Selection =
  | { kind: "identity" }
  | { kind: "visual" }
  | { kind: "section"; index: number }
  | { kind: "tab"; index: number };

function validateDoc(doc: AdminContentData): string[] {
  const errors: string[] = [];
  const required = (value: string, message: string) => {
    if (!value || !value.trim()) errors.push(message);
  };

  const { profile } = doc;
  required(profile.name, "El perfil necesita un nombre.");
  required(profile.role, "El perfil necesita un rol.");
  required(profile.tagline, "El perfil necesita un tagline.");
  required(profile.location, "El perfil necesita una ubicación.");
  required(profile.email, "El perfil necesita un email.");
  required(profile.avatarAlt, "El perfil necesita un texto alternativo de avatar.");
  profile.links.forEach((link, index) => {
    required(link.label, `Enlace #${index + 1}: falta la etiqueta.`);
    required(link.href, `Enlace #${index + 1}: falta la URL.`);
  });

  if (
    !Number.isFinite(doc.visualSettings.sectionOrbitDurationSeconds) ||
    doc.visualSettings.sectionOrbitDurationSeconds <= 0
  ) {
    errors.push("La duración de la 1.ª órbita debe ser mayor que 0.");
  }
  if (
    !Number.isFinite(doc.visualSettings.momentaryOrbitDurationSeconds) ||
    doc.visualSettings.momentaryOrbitDurationSeconds <= 0
  ) {
    errors.push("La duración de la 2.ª órbita debe ser mayor que 0.");
  }

  const sectionIds = new Set<string>();
  const routes = new Set<string>();
  doc.sections.forEach((section, index) => {
    const label = section.id || `#${index + 1}`;
    required(section.id, `Sección ${label}: falta el id.`);
    required(section.route, `Sección ${label}: falta la ruta.`);
    required(section.label, `Sección ${label}: falta la etiqueta.`);
    required(section.eyebrow, `Sección ${label}: falta el eyebrow.`);
    required(section.title, `Sección ${label}: falta el título.`);
    required(section.description, `Sección ${label}: falta la descripción.`);
    if (section.id) {
      if (sectionIds.has(section.id)) errors.push(`Sección ${label}: id duplicado.`);
      sectionIds.add(section.id);
    }
    if (section.route) {
      if (routes.has(section.route)) errors.push(`Sección ${label}: ruta duplicada.`);
      routes.add(section.route);
    }
  });

  const itemIds = new Set<string>();
  doc.sectionItems.forEach((item, index) => {
    const label = item.id || `#${index + 1}`;
    required(item.id, `Item ${label}: falta el id.`);
    required(item.kind, `Item ${label}: falta el kind.`);
    required(item.kicker, `Item ${label}: falta el kicker.`);
    required(item.title, `Item ${label}: falta el título.`);
    required(item.description, `Item ${label}: falta la descripción.`);
    if (!sectionIds.has(item.sectionId)) {
      errors.push(`Item ${label}: la sección "${item.sectionId}" no existe.`);
    }
    if (item.id) {
      if (itemIds.has(item.id)) errors.push(`Item ${label}: id duplicado.`);
      itemIds.add(item.id);
    }
  });

  const tabIds = new Set<string>();
  doc.momentaryTabs.forEach((tab, index) => {
    const label = tab.id || `#${index + 1}`;
    required(tab.id, `Pestaña ${label}: falta el id.`);
    required(tab.label, `Pestaña ${label}: falta la etiqueta.`);
    if (tab.id) {
      if (tabIds.has(tab.id)) errors.push(`Pestaña ${label}: id duplicado.`);
      tabIds.add(tab.id);
    }
  });

  const tabItemIds = new Set<string>();
  doc.momentaryItems.forEach((item, index) => {
    const label = item.id || `#${index + 1}`;
    required(item.id, `Item de pestaña ${label}: falta el id.`);
    required(item.kind, `Item de pestaña ${label}: falta el kind.`);
    required(item.kicker, `Item de pestaña ${label}: falta el kicker.`);
    required(item.title, `Item de pestaña ${label}: falta el título.`);
    required(item.description, `Item de pestaña ${label}: falta la descripción.`);
    if (!tabIds.has(item.tabId)) {
      errors.push(`Item de pestaña ${label}: la pestaña "${item.tabId}" no existe.`);
    }
    if (item.id) {
      if (tabItemIds.has(item.id)) errors.push(`Item de pestaña ${label}: id duplicado.`);
      tabItemIds.add(item.id);
    }
  });

  return errors;
}

export function AdminPage() {
  const navigate = useNavigate();
  const [session] = useState(() => getStoredAdminSession());
  const [doc, setDoc] = useState<AdminContentData>(() => emptyDoc());
  const [revision, setRevision] = useState(0);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [status, setStatus] = useState("Cargando…");
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selection, setSelection] = useState<Selection>({ kind: "identity" });
  const savePromiseRef = useRef<Promise<boolean> | null>(null);

  // Used when the session is lost for any reason other than an explicit logout
  // (expired token, 401): send the user to the login form so they can
  // re-authenticate, instead of dumping them on the public portal.
  const redirectToLogin = useCallback(() => {
    clearStoredAdminSession();
    navigate("/admin/login", { replace: true, state: { expired: true } });
  }, [navigate]);

  const applyLoaded = useCallback((data: AdminContentData & { revision: number }) => {
    const next: AdminContentData = {
      profile: data.profile,
      visualSettings: data.visualSettings,
      sections: data.sections,
      sectionItems: data.sectionItems,
      momentaryTabs: data.momentaryTabs,
      momentaryItems: data.momentaryItems,
    };
    setDoc(next);
    setRevision(data.revision);
    setSavedSnapshot(JSON.stringify(next));
    setLoaded(true);
  }, []);

  // Parse the saved baseline once so the sidebar can flag exactly which entity
  // has unsaved edits. Entities are matched by id; a missing id (new or renamed
  // section/tab) counts as changed.
  const savedDoc = useMemo<AdminContentData | null>(
    () => (savedSnapshot ? (JSON.parse(savedSnapshot) as AdminContentData) : null),
    [savedSnapshot],
  );
  const dirty = loaded && hasUnsavedChanges(doc, savedDoc);

  const loadAdminData = useCallback(
    async (signal?: AbortSignal) => {
      const currentSession = getStoredAdminSession();
      if (!currentSession) {
        redirectToLogin();
        return;
      }

      setBusy(true);
      setMessage(null);
      setStatus("Cargando…");

      try {
        const data = await fetchAdminSiteData(currentSession.accessToken, signal);
        applyLoaded(data);
        setStatus("Contenido cargado");
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        if (loadError instanceof ApiError && loadError.status === 401) {
          redirectToLogin();
          return;
        }
        setStatus("Error");
        setMessage(loadError instanceof Error ? loadError.message : "No se pudo cargar el contenido.");
      } finally {
        setBusy(false);
      }
    },
    [applyLoaded, redirectToLogin],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadAdminData(controller.signal);
    return () => controller.abort();
  }, [loadAdminData]);

  // Proactively bounce to the login form the moment the token expires, so a
  // later save/reload can't fail mid-edit on a dead session.
  useEffect(() => {
    if (!session) return;
    const msUntilExpiry = session.expiresAt * 1000 - Date.now();
    if (msUntilExpiry <= 0) {
      redirectToLogin();
      return;
    }
    const timer = window.setTimeout(redirectToLogin, msUntilExpiry);
    return () => window.clearTimeout(timer);
  }, [session, redirectToLogin]);

  const saveAdminData = useCallback(async (options?: { message?: string | null }) => {
    if (savePromiseRef.current) {
      return savePromiseRef.current;
    }

    const currentSession = getStoredAdminSession();
    if (!currentSession) {
      redirectToLogin();
      return false;
    }

    const validationErrors = validateContentDoc(doc);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setStatus("Revisa los campos");
      setMessage(null);
      return false;
    }

    const savePromise = (async () => {
      setErrors([]);
      setBusy(true);
      setMessage(null);
      setStatus("Guardando…");

      try {
        const saved = await saveAdminSiteData(currentSession.accessToken, prepareForSave(doc), revision);
        applyLoaded(saved);
        setStatus("Guardado");
        setMessage(options?.message === undefined ? "Cambios guardados correctamente." : options.message);
        return true;
      } catch (saveError) {
        if (saveError instanceof ApiError && saveError.status === 401) {
          redirectToLogin();
          return false;
        }
        if (saveError instanceof ApiError && saveError.status === 409) {
          setStatus("Conflicto");
          setMessage(
            "El contenido cambió desde que lo cargaste. Pulsa «Recargar» para traer la última versión (perderás los cambios sin guardar).",
          );
          return false;
        }
        setStatus("Error");
        setMessage(saveError instanceof Error ? saveError.message : "No se pudo guardar el contenido.");
        return false;
      } finally {
        setBusy(false);
        savePromiseRef.current = null;
      }
    })();

    savePromiseRef.current = savePromise;
    return savePromise;
  }, [applyLoaded, doc, redirectToLogin, revision]);

  const logout = useCallback(async () => {
    if (dirty) {
      const saved = await saveAdminData({
        message: "Cambios guardados antes de cerrar sesión.",
      });
      if (!saved) return;
    }

    clearStoredAdminSession();
    navigate("/", { replace: true });
  }, [dirty, navigate, saveAdminData]);

  // Try to preserve pending edits before the proactive expiry redirect removes
  // the admin session. The existing expiry timer remains the hard deadline.
  useEffect(() => {
    if (!session || !dirty) return;

    const msUntilExpiry = session.expiresAt * 1000 - Date.now();
    if (msUntilExpiry <= 0) return;

    const autosaveDelay = Math.max(0, msUntilExpiry - SESSION_EXPIRY_AUTOSAVE_LEAD_MS);
    const autosaveTimer = window.setTimeout(() => {
      void saveAdminData({ message: null }).then((saved) => {
        if (saved) redirectToLogin();
      });
    }, autosaveDelay);

    return () => window.clearTimeout(autosaveTimer);
  }, [dirty, redirectToLogin, saveAdminData, session]);

  const isProfileDirty =
    savedDoc !== null && JSON.stringify(doc.profile) !== JSON.stringify(savedDoc.profile);
  const isVisualDirty =
    savedDoc !== null && JSON.stringify(doc.visualSettings) !== JSON.stringify(savedDoc.visualSettings);

  const isSectionDirty = (section: SiteSection): boolean => {
    if (!savedDoc) return false;
    const saved = savedDoc.sections.find((item) => item.id === section.id);
    if (!saved) return true;
    if (JSON.stringify(sectionForDirty(section)) !== JSON.stringify(sectionForDirty(saved))) return true;
    const current = doc.sectionItems.filter((item) => item.sectionId === section.id);
    const base = savedDoc.sectionItems.filter((item) => item.sectionId === section.id);
    return JSON.stringify(itemsForDirty(current)) !== JSON.stringify(itemsForDirty(base));
  };

  const isTabDirty = (tab: MomentaryTab): boolean => {
    if (!savedDoc) return false;
    const saved = savedDoc.momentaryTabs.find((item) => item.id === tab.id);
    if (!saved) return true;
    if (JSON.stringify(tabForDirty(tab)) !== JSON.stringify(tabForDirty(saved))) return true;
    const current = doc.momentaryItems.filter((item) => item.tabId === tab.id);
    const base = savedDoc.momentaryItems.filter((item) => item.tabId === tab.id);
    return JSON.stringify(itemsForDirty(current)) !== JSON.stringify(itemsForDirty(base));
  };

  const baselineReady = savedDoc !== null;

  const patchProfile = (patch: Partial<AdminContentData["profile"]>) =>
    setDoc((current) => ({ ...current, profile: { ...current.profile, ...patch } }));
  const patchVisualSettings = (patch: Partial<SiteVisualSettings>) =>
    setDoc((current) => ({
      ...current,
      visualSettings: { ...current.visualSettings, ...patch },
    }));

  const sections = doc.sections;
  const tabs = doc.momentaryTabs;

  // A stale index (after reload/reorder/delete) safely falls back to identity.
  const active: Selection =
    (selection.kind === "section" && !sections[selection.index]) ||
    (selection.kind === "tab" && !tabs[selection.index])
      ? { kind: "identity" }
      : selection;

  const activeSection = active.kind === "section" ? sections[active.index] : null;
  const activeSavedSection = active.kind === "section" ? savedDoc?.sections[active.index] : undefined;
  const activeSectionItems = activeSection
    ? doc.sectionItems.filter((item) => item.sectionId === activeSection.id)
    : [];
  const activeSavedSectionItems =
    activeSection && savedDoc
      ? savedDoc.sectionItems.filter((item) => item.sectionId === (activeSavedSection?.id ?? activeSection.id))
      : [];
  const activeTab = active.kind === "tab" ? tabs[active.index] : null;
  const activeSavedTab = active.kind === "tab" ? savedDoc?.momentaryTabs[active.index] : undefined;
  const activeTabItems = activeTab
    ? doc.momentaryItems.filter((item) => item.tabId === activeTab.id)
    : [];
  const activeSavedTabItems =
    activeTab && savedDoc
      ? savedDoc.momentaryItems.filter((item) => item.tabId === (activeSavedTab?.id ?? activeTab.id))
      : [];

  // Renaming a section/tab id cascades to its items so they are never orphaned.
  const updateSection = (index: number, next: SiteSection) =>
    setDoc((current) => {
      const prev = current.sections[index];
      const nextSections = current.sections.map((item, i) => (i === index ? next : item));
      const nextItems =
        prev && prev.id !== next.id
          ? current.sectionItems.map((item) =>
              item.sectionId === prev.id ? { ...item, sectionId: next.id } : item,
            )
          : current.sectionItems;
      return { ...current, sections: nextSections, sectionItems: nextItems };
    });

  const updateTab = (index: number, next: MomentaryTab) =>
    setDoc((current) => {
      const prev = current.momentaryTabs[index];
      const nextTabs = current.momentaryTabs.map((item, i) => (i === index ? next : item));
      const nextItems =
        prev && prev.id !== next.id
          ? current.momentaryItems.map((item) =>
              item.tabId === prev.id ? { ...item, tabId: next.id } : item,
            )
          : current.momentaryItems;
      return { ...current, momentaryTabs: nextTabs, momentaryItems: nextItems };
    });

  const addSection = () => {
    setSelection({ kind: "section", index: doc.sections.length });
    setDoc((current) => ({ ...current, sections: [...current.sections, emptySection()] }));
  };

  const addTab = () => {
    setSelection({ kind: "tab", index: doc.momentaryTabs.length });
    setDoc((current) => ({ ...current, momentaryTabs: [...current.momentaryTabs, emptyTab()] }));
  };

  const deleteSection = (index: number) => {
    const sectionId = doc.sections[index]?.id;
    setDoc((current) => ({
      ...current,
      sections: current.sections.filter((_, i) => i !== index),
      sectionItems: current.sectionItems.filter((item) => item.sectionId !== sectionId),
    }));
    setSelection({ kind: "identity" });
  };

  const deleteTab = (index: number) => {
    const tabId = doc.momentaryTabs[index]?.id;
    setDoc((current) => ({
      ...current,
      momentaryTabs: current.momentaryTabs.filter((_, i) => i !== index),
      momentaryItems: current.momentaryItems.filter((item) => item.tabId !== tabId),
    }));
    setSelection({ kind: "identity" });
  };

  // Items live in flat arrays; replacing one owner's slice keeps the rest intact.
  const replaceSectionItems = (sectionId: string, next: SectionItem[]) =>
    setDoc((current) => ({
      ...current,
      sectionItems: [...current.sectionItems.filter((item) => item.sectionId !== sectionId), ...next],
    }));

  const replaceTabItems = (tabId: string, next: MomentaryItem[]) =>
    setDoc((current) => ({
      ...current,
      momentaryItems: [...current.momentaryItems.filter((item) => item.tabId !== tabId), ...next],
    }));

  return (
    <main className="admin-shell">
      <section className="admin-panel" aria-labelledby="admin-title">
        <header className="admin-header">
          <div className="admin-header-titles">
            <p>Fernando Luna</p>
            <h1 id="admin-title" className="admin-title">Administración de contenido</h1>
          </div>
          <a href="/">Volver al portal</a>
        </header>

        <div className="admin-toolbar">
          <div className="admin-toolbar-meta">
            <span className="admin-session-expiry">
              Sesión activa hasta {session ? formatSessionExpiry(session.expiresAt) : "sin sesión"}
            </span>
            <span className={`admin-dirty ${dirty ? "is-dirty" : ""}`}>
              {dirty ? (
                <TriangleAlert className="admin-dirty-icon" size={16} aria-hidden="true" />
              ) : null}
              {dirty ? "Cambios sin guardar" : "Sin cambios"}
            </span>
          </div>
          <div className="admin-toolbar-actions">
            <button type="button" onClick={() => loadAdminData()} disabled={busy}>
              Recargar
            </button>
            <button type="button" className="admin-primary" onClick={() => void saveAdminData()} disabled={busy}>
              Guardar
            </button>
            <button type="button" className="admin-danger" onClick={logout} disabled={busy}>
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="admin-status" aria-live="polite">
          {status ? <span>{status}</span> : null}
          {message ? <strong>{message}</strong> : null}
        </div>

        {errors.length > 0 ? (
          <div className="admin-errors" role="alert">
            <p>No se guardó. Corrige estos puntos:</p>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="admin-layout">
          <nav className="admin-sidebar" aria-label="Bloques del editor">
            <button
              type="button"
              className={`admin-nav-item ${active.kind === "identity" ? "is-active" : ""}`}
              onClick={() => setSelection({ kind: "identity" })}
            >
              <span className="admin-nav-item-label">Identidad</span>
              <NavDirtyMark show={isProfileDirty} />
            </button>

            <button
              type="button"
              className={`admin-nav-item ${active.kind === "visual" ? "is-active" : ""}`}
              onClick={() => setSelection({ kind: "visual" })}
            >
              <span className="admin-nav-item-label">Visual</span>
              <NavDirtyMark show={isVisualDirty} />
            </button>

            <div className="admin-nav-group">
              <div className="admin-nav-group-head">
                <span>Secciones · 1ª órbita</span>
                <button type="button" onClick={addSection} aria-label="Añadir sección" title="Añadir sección">
                  +
                </button>
              </div>
              {sections.length === 0 ? (
                <p className="admin-nav-empty">Sin secciones</p>
              ) : (
                sections.map((section, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`admin-nav-item ${active.kind === "section" && active.index === index ? "is-active" : ""}`}
                    onClick={() => setSelection({ kind: "section", index })}
                  >
                    <span className="admin-nav-item-label">
                      {section.label || section.id || `Sección ${index + 1}`}
                    </span>
                    <NavDirtyMark show={isSectionDirty(section)} />
                  </button>
                ))
              )}
            </div>

            <div className="admin-nav-group">
              <div className="admin-nav-group-head">
                <span>Pestañas · 2ª órbita</span>
                <button type="button" onClick={addTab} aria-label="Añadir pestaña" title="Añadir pestaña">
                  +
                </button>
              </div>
              {tabs.length === 0 ? (
                <p className="admin-nav-empty">Sin pestañas</p>
              ) : (
                tabs.map((tab, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`admin-nav-item ${active.kind === "tab" && active.index === index ? "is-active" : ""}`}
                    onClick={() => setSelection({ kind: "tab", index })}
                  >
                    <span className="admin-nav-item-label">
                      {tab.label || tab.id || `Pestaña ${index + 1}`}
                    </span>
                    <NavDirtyMark show={isTabDirty(tab)} />
                  </button>
                ))
              )}
            </div>
          </nav>

          <fieldset className="admin-section admin-content" disabled={busy}>
            {active.kind === "identity" ? (
              <IdentityEditor
                profile={doc.profile}
                savedProfile={savedDoc?.profile}
                baselineReady={baselineReady}
                patchProfile={patchProfile}
              />
            ) : active.kind === "visual" ? (
              <VisualSettingsEditor
                settings={doc.visualSettings}
                savedSettings={savedDoc?.visualSettings}
                baselineReady={baselineReady}
                patchSettings={patchVisualSettings}
              />
            ) : active.kind === "section" ? (
              <SectionEditor
                section={activeSection!}
                savedSection={activeSavedSection}
                baselineReady={baselineReady}
                onChange={(next) => updateSection(active.index, next)}
                onDelete={() => deleteSection(active.index)}
                items={activeSectionItems}
                savedItems={activeSavedSectionItems}
                onItemsChange={(next) => replaceSectionItems(activeSection!.id, next)}
              />
            ) : (
              <TabEditor
                tab={activeTab!}
                savedTab={activeSavedTab}
                baselineReady={baselineReady}
                onChange={(next) => updateTab(active.index, next)}
                onDelete={() => deleteTab(active.index)}
                items={activeTabItems}
                savedItems={activeSavedTabItems}
                onItemsChange={(next) => replaceTabItems(activeTab!.id, next)}
              />
            )}
          </fieldset>
        </div>
      </section>
    </main>
  );
}

// Orange warning mark shown in the sidebar next to an entity with unsaved
// edits, matching the toolbar "Cambios sin guardar" indicator.
function NavDirtyMark({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <TriangleAlert className="admin-nav-dirty-icon" size={14} role="img" aria-label="Cambios sin guardar" />
  );
}

function fieldChanged<T>(baselineReady: boolean, current: T, saved: T | undefined): boolean {
  if (!baselineReady) return false;
  return JSON.stringify(current) !== JSON.stringify(saved);
}

// Optional string fields (meta, href, the visible-from/until timestamps) follow
// the same null/""/whitespace rule as prepareForSave, so a per-field mark never
// disagrees with the toolbar or sidebar about whether an empty value changed.
function optionalFieldChanged(
  baselineReady: boolean,
  current: string | null,
  saved: string | null | undefined,
): boolean {
  if (!baselineReady) return false;
  return normalizeOptionalText(current) !== normalizeOptionalText(saved);
}

function IdentityEditor({
  profile,
  savedProfile,
  baselineReady,
  patchProfile,
}: {
  profile: AdminContentData["profile"];
  savedProfile?: AdminContentData["profile"];
  baselineReady: boolean;
  patchProfile: (patch: Partial<AdminContentData["profile"]>) => void;
}) {
  return (
    <>
      <div className="admin-entity-head">
        <h2>Identidad</h2>
      </div>
      <div className="admin-grid">
        <TextField label="Nombre" value={profile.name} dirty={fieldChanged(baselineReady, profile.name, savedProfile?.name)} tooltip={FIELD_HELP.profile.name} onChange={(value) => patchProfile({ name: value })} />
        <TextField label="Rol" value={profile.role} dirty={fieldChanged(baselineReady, profile.role, savedProfile?.role)} tooltip={FIELD_HELP.profile.role} onChange={(value) => patchProfile({ role: value })} />
        <TextField label="Ubicación" value={profile.location} dirty={fieldChanged(baselineReady, profile.location, savedProfile?.location)} tooltip={FIELD_HELP.profile.location} onChange={(value) => patchProfile({ location: value })} />
        <TextField label="Email" type="email" value={profile.email} dirty={fieldChanged(baselineReady, profile.email, savedProfile?.email)} tooltip={FIELD_HELP.profile.email} onChange={(value) => patchProfile({ email: value })} />
      </div>
      <TextAreaField label="Tagline" value={profile.tagline} dirty={fieldChanged(baselineReady, profile.tagline, savedProfile?.tagline)} tooltip={FIELD_HELP.profile.tagline} onChange={(value) => patchProfile({ tagline: value })} />
      <TextField
        label="Texto alternativo del avatar"
        value={profile.avatarAlt}
        dirty={fieldChanged(baselineReady, profile.avatarAlt, savedProfile?.avatarAlt)}
        tooltip={FIELD_HELP.profile.avatarAlt}
        onChange={(value) => patchProfile({ avatarAlt: value })}
      />
      <TagsField label="Highlights" value={profile.highlights} dirty={fieldChanged(baselineReady, profile.highlights, savedProfile?.highlights)} tooltip={FIELD_HELP.profile.highlights} onChange={(value) => patchProfile({ highlights: value })} />
      <hr className="admin-divider" />
      <CollectionEditor<ProfileLink>
        title="Enlaces de marca"
        items={profile.links}
        onChange={(links) => patchProfile({ links })}
        makeEmpty={emptyLink}
        addLabel="Añadir enlace"
        describeItem={(link, index) => link.label || `Enlace ${index + 1}`}
        renderItem={(link, update, index) => {
          const savedLink = savedProfile?.links[index];
          return (
          <div className="admin-grid">
            <TextField label="Etiqueta" value={link.label} dirty={fieldChanged(baselineReady, link.label, savedLink?.label)} tooltip={FIELD_HELP.link.label} onChange={(value) => update({ ...link, label: value })} />
            <TextField label="URL" value={link.href} dirty={fieldChanged(baselineReady, link.href, savedLink?.href)} tooltip={FIELD_HELP.link.href} onChange={(value) => update({ ...link, href: value })} />
            <SelectField
              label="Tipo"
              value={link.kind}
              options={LINK_KIND_OPTIONS}
              dirty={fieldChanged(baselineReady, link.kind, savedLink?.kind)}
              tooltip={FIELD_HELP.link.kind}
              onChange={(value) => update({ ...link, kind: value as LinkKind })}
            />
          </div>
          );
        }}
      />
    </>
  );
}

function VisualSettingsEditor({
  settings,
  savedSettings,
  baselineReady,
  patchSettings,
}: {
  settings: SiteVisualSettings;
  savedSettings?: SiteVisualSettings;
  baselineReady: boolean;
  patchSettings: (patch: Partial<SiteVisualSettings>) => void;
}) {
  return (
    <>
      <div className="admin-entity-head">
        <h2>Visual</h2>
      </div>
      <div className="admin-grid">
        <NumberField
          label="Duración 1.ª órbita (s)"
          value={settings.sectionOrbitDurationSeconds}
          dirty={fieldChanged(baselineReady, settings.sectionOrbitDurationSeconds, savedSettings?.sectionOrbitDurationSeconds)}
          tooltip={FIELD_HELP.visual.sectionOrbitDurationSeconds}
          onChange={(value) => patchSettings({ sectionOrbitDurationSeconds: value })}
        />
        <NumberField
          label="Duración 2.ª órbita (s)"
          value={settings.momentaryOrbitDurationSeconds}
          dirty={fieldChanged(baselineReady, settings.momentaryOrbitDurationSeconds, savedSettings?.momentaryOrbitDurationSeconds)}
          tooltip={FIELD_HELP.visual.momentaryOrbitDurationSeconds}
          onChange={(value) => patchSettings({ momentaryOrbitDurationSeconds: value })}
        />
      </div>
    </>
  );
}

function SectionEditor({
  section,
  savedSection,
  baselineReady,
  onChange,
  onDelete,
  items,
  savedItems,
  onItemsChange,
}: {
  section: SiteSection;
  savedSection?: SiteSection;
  baselineReady: boolean;
  onChange: (section: SiteSection) => void;
  onDelete: () => void;
  items: SectionItem[];
  savedItems: SectionItem[];
  onItemsChange: (items: SectionItem[]) => void;
}) {
  // Two-step delete: arming the confirmation requires a second, explicit click,
  // so an accidental press can't drop a section and all its items.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Disarm when the editor switches to another section so a confirmation armed
  // on one section can't carry over and delete the next one.
  useEffect(() => {
    setConfirmingDelete(false);
  }, [section.id]);

  return (
    <>
      <div className="admin-entity-head">
        <h2>{section.label || section.id || "Sección"}</h2>
        {confirmingDelete ? (
          <div className="admin-delete-confirm" role="group" aria-label="Confirmar eliminación de la sección">
            <span className="admin-delete-confirm-text">
              <TriangleAlert size={16} aria-hidden="true" />
              ¿Eliminar la sección y todos sus items?
            </span>
            <button
              type="button"
              className="admin-danger"
              onClick={() => {
                setConfirmingDelete(false);
                onDelete();
              }}
            >
              Sí, eliminar
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" className="admin-danger" onClick={() => setConfirmingDelete(true)}>
            Eliminar sección
          </button>
        )}
      </div>
      <div className="admin-grid">
        <TextField label="id" value={section.id} dirty={fieldChanged(baselineReady, section.id, savedSection?.id)} tooltip={FIELD_HELP.section.id} onChange={(value) => onChange({ ...section, id: value })} />
        <TextField label="route" value={section.route} dirty={fieldChanged(baselineReady, section.route, savedSection?.route)} tooltip={FIELD_HELP.section.route} onChange={(value) => onChange({ ...section, route: value })} />
        <TextField label="label" value={section.label} dirty={fieldChanged(baselineReady, section.label, savedSection?.label)} tooltip={FIELD_HELP.section.label} onChange={(value) => onChange({ ...section, label: value })} />
        <TextField label="eyebrow" value={section.eyebrow} dirty={fieldChanged(baselineReady, section.eyebrow, savedSection?.eyebrow)} tooltip={FIELD_HELP.section.eyebrow} onChange={(value) => onChange({ ...section, eyebrow: value })} />
        <TextField label="title" value={section.title} dirty={fieldChanged(baselineReady, section.title, savedSection?.title)} tooltip={FIELD_HELP.section.title} onChange={(value) => onChange({ ...section, title: value })} />
        <SelectField label="icono" value={section.iconKey} options={ICON_OPTIONS} dirty={fieldChanged(baselineReady, section.iconKey, savedSection?.iconKey)} tooltip={FIELD_HELP.section.iconKey} onChange={(value) => onChange({ ...section, iconKey: value })} />
        <NumberField label="ángulo" value={section.angle} dirty={fieldChanged(baselineReady, section.angle, savedSection?.angle)} tooltip={FIELD_HELP.section.angle} onChange={(value) => onChange({ ...section, angle: value })} />
        <NumberField label="orden" value={section.order} dirty={fieldChanged(baselineReady, section.order, savedSection?.order)} tooltip={FIELD_HELP.section.order} onChange={(value) => onChange({ ...section, order: value })} />
      </div>
      <TextAreaField label="descripción" value={section.description} dirty={fieldChanged(baselineReady, section.description, savedSection?.description)} tooltip={FIELD_HELP.section.description} hint="Markdown básico: **negrita**, *cursiva*, `código`, [enlace](https://...), - item o 1. item." onChange={(value) => onChange({ ...section, description: value })} />
      <div className="admin-grid">
        <DateTimeField label="visible desde" value={section.visibleFrom} dirty={optionalFieldChanged(baselineReady, section.visibleFrom, savedSection?.visibleFrom)} tooltip={FIELD_HELP.section.visibleFrom} onChange={(value) => onChange({ ...section, visibleFrom: value })} />
        <DateTimeField label="visible hasta" value={section.visibleUntil} dirty={optionalFieldChanged(baselineReady, section.visibleUntil, savedSection?.visibleUntil)} tooltip={FIELD_HELP.section.visibleUntil} onChange={(value) => onChange({ ...section, visibleUntil: value })} />
      </div>
      <CheckboxField label="Habilitada" value={section.enabled} dirty={fieldChanged(baselineReady, section.enabled, savedSection?.enabled)} tooltip={FIELD_HELP.section.enabled} onChange={(value) => onChange({ ...section, enabled: value })} />
      <hr className="admin-divider" />
      <CollectionEditor<SectionItem>
        title="Items de esta sección"
        items={items}
        onChange={onItemsChange}
        makeEmpty={() => ({ ...emptySectionItem(section.id), order: nextCollectionOrder(items) })}
        reorderOnMove={applyVisualOrder}
        addLabel="Añadir item"
        describeItem={(item, index) => item.title || item.id || `Item ${index + 1}`}
        renderItem={(item, update, index) => (
          <ItemEditor item={item} savedItem={savedItems[index]} baselineReady={baselineReady} onChange={update} />
        )}
      />
    </>
  );
}

function TabEditor({
  tab,
  savedTab,
  baselineReady,
  onChange,
  onDelete,
  items,
  savedItems,
  onItemsChange,
}: {
  tab: MomentaryTab;
  savedTab?: MomentaryTab;
  baselineReady: boolean;
  onChange: (tab: MomentaryTab) => void;
  onDelete: () => void;
  items: MomentaryItem[];
  savedItems: MomentaryItem[];
  onItemsChange: (items: MomentaryItem[]) => void;
}) {
  return (
    <>
      <div className="admin-entity-head">
        <h2>{tab.label || tab.id || "Pestaña"}</h2>
        <button type="button" className="admin-danger" onClick={onDelete}>
          Eliminar pestaña
        </button>
      </div>
      <div className="admin-grid">
        <TextField label="id" value={tab.id} dirty={fieldChanged(baselineReady, tab.id, savedTab?.id)} tooltip={FIELD_HELP.tab.id} onChange={(value) => onChange({ ...tab, id: value })} />
        <TextField label="label" value={tab.label} dirty={fieldChanged(baselineReady, tab.label, savedTab?.label)} tooltip={FIELD_HELP.tab.label} onChange={(value) => onChange({ ...tab, label: value })} />
        <SelectField label="icono" value={tab.iconKey} options={ICON_OPTIONS} dirty={fieldChanged(baselineReady, tab.iconKey, savedTab?.iconKey)} tooltip={FIELD_HELP.tab.iconKey} onChange={(value) => onChange({ ...tab, iconKey: value })} />
        <NumberField label="ángulo" value={tab.angle} dirty={fieldChanged(baselineReady, tab.angle, savedTab?.angle)} tooltip={FIELD_HELP.tab.angle} onChange={(value) => onChange({ ...tab, angle: value })} />
        <NumberField label="orden" value={tab.order} dirty={fieldChanged(baselineReady, tab.order, savedTab?.order)} tooltip={FIELD_HELP.tab.order} onChange={(value) => onChange({ ...tab, order: value })} />
      </div>
      <div className="admin-grid">
        <DateTimeField label="visible desde" value={tab.visibleFrom} dirty={optionalFieldChanged(baselineReady, tab.visibleFrom, savedTab?.visibleFrom)} tooltip={FIELD_HELP.tab.visibleFrom} onChange={(value) => onChange({ ...tab, visibleFrom: value })} />
        <DateTimeField label="visible hasta" value={tab.visibleUntil} dirty={optionalFieldChanged(baselineReady, tab.visibleUntil, savedTab?.visibleUntil)} tooltip={FIELD_HELP.tab.visibleUntil} onChange={(value) => onChange({ ...tab, visibleUntil: value })} />
      </div>
      <CheckboxField label="Habilitada" value={tab.enabled} dirty={fieldChanged(baselineReady, tab.enabled, savedTab?.enabled)} tooltip={FIELD_HELP.tab.enabled} onChange={(value) => onChange({ ...tab, enabled: value })} />
      <hr className="admin-divider" />
      <CollectionEditor<MomentaryItem>
        title="Items de esta pestaña"
        items={items}
        onChange={onItemsChange}
        makeEmpty={() => ({ ...emptyMomentaryItem(tab.id), order: nextCollectionOrder(items) })}
        reorderOnMove={applyVisualOrder}
        addLabel="Añadir item"
        describeItem={(item, index) => item.title || item.id || `Item ${index + 1}`}
        renderItem={(item, update, index) => (
          <ItemEditor item={item} savedItem={savedItems[index]} baselineReady={baselineReady} onChange={update} />
        )}
      />
    </>
  );
}

function ItemEditor<T extends SectionItem | MomentaryItem>({
  item,
  savedItem,
  baselineReady,
  onChange,
}: {
  item: T;
  savedItem?: T;
  baselineReady: boolean;
  onChange: (item: T) => void;
}) {
  // The inputs need a string value; dirtiness is decided on the raw nullable
  // field via optionalFieldChanged so it matches the toolbar/sidebar exactly.
  const metaValue = item.meta ?? "";
  const hrefValue = item.href ?? "";

  return (
    <>
      <div className="admin-grid">
        <TextField label="id" value={item.id} dirty={fieldChanged(baselineReady, item.id, savedItem?.id)} tooltip={FIELD_HELP.item.id} onChange={(value) => onChange({ ...item, id: value })} />
        <TextField label="kind" value={item.kind} dirty={fieldChanged(baselineReady, item.kind, savedItem?.kind)} tooltip={FIELD_HELP.item.kind} onChange={(value) => onChange({ ...item, kind: value })} hint="card, project, post, doc, note…" />
        <SelectField label="icono" value={item.iconKey} options={ICON_OPTIONS} dirty={fieldChanged(baselineReady, item.iconKey, savedItem?.iconKey)} tooltip={FIELD_HELP.item.iconKey} onChange={(value) => onChange({ ...item, iconKey: value })} />
        <TextField label="kicker" value={item.kicker} dirty={fieldChanged(baselineReady, item.kicker, savedItem?.kicker)} tooltip={FIELD_HELP.item.kicker} onChange={(value) => onChange({ ...item, kicker: value })} />
        <TextField label="title" value={item.title} dirty={fieldChanged(baselineReady, item.title, savedItem?.title)} tooltip={FIELD_HELP.item.title} onChange={(value) => onChange({ ...item, title: value })} />
        <TextField label="meta" value={metaValue} dirty={optionalFieldChanged(baselineReady, item.meta, savedItem?.meta)} tooltip={FIELD_HELP.item.meta} onChange={(value) => onChange({ ...item, meta: value })} />
        <TextField label="href" value={hrefValue} dirty={optionalFieldChanged(baselineReady, item.href, savedItem?.href)} tooltip={FIELD_HELP.item.href} onChange={(value) => onChange({ ...item, href: value })} />
        <NumberField label="orden" value={item.order} dirty={fieldChanged(baselineReady, item.order, savedItem?.order)} tooltip={FIELD_HELP.item.order} onChange={(value) => onChange({ ...item, order: value })} />
      </div>
      <TextAreaField label="descripción" value={item.description} dirty={fieldChanged(baselineReady, item.description, savedItem?.description)} tooltip={FIELD_HELP.item.description} hint="Markdown básico: **negrita**, *cursiva*, `código`, [enlace](https://...), - item o 1. item." onChange={(value) => onChange({ ...item, description: value })} />
      <TagsField label="tags" value={item.tags} dirty={fieldChanged(baselineReady, item.tags, savedItem?.tags)} tooltip={FIELD_HELP.item.tags} onChange={(value) => onChange({ ...item, tags: value })} />
      <div className="admin-grid">
        <DateTimeField label="visible desde" value={item.visibleFrom} dirty={optionalFieldChanged(baselineReady, item.visibleFrom, savedItem?.visibleFrom)} tooltip={FIELD_HELP.item.visibleFrom} onChange={(value) => onChange({ ...item, visibleFrom: value })} />
        <DateTimeField label="visible hasta" value={item.visibleUntil} dirty={optionalFieldChanged(baselineReady, item.visibleUntil, savedItem?.visibleUntil)} tooltip={FIELD_HELP.item.visibleUntil} onChange={(value) => onChange({ ...item, visibleUntil: value })} />
      </div>
      <CheckboxField label="Destacado" value={item.featured} dirty={fieldChanged(baselineReady, item.featured, savedItem?.featured)} tooltip={FIELD_HELP.item.featured} onChange={(value) => onChange({ ...item, featured: value })} />
    </>
  );
}
