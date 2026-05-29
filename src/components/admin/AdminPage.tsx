import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import {
  ApiError,
  fetchAdminSiteData,
  saveAdminSiteData,
  type AdminContentData,
} from "../../api";
import { ICON_KEYS } from "../../icons";
import type {
  LinkKind,
  MomentaryItem,
  MomentaryTab,
  ProfileLink,
  SectionItem,
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
const LINK_KIND_OPTIONS: { value: LinkKind; label: string }[] = [
  { value: "github", label: "GitHub" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "mail", label: "Email" },
  { value: "web", label: "Web" },
];
const FIRST_ICON = ICON_KEYS[0] ?? "globe";

function emptyDoc(): AdminContentData {
  return {
    profile: {
      name: "",
      role: "",
      tagline: "",
      location: "",
      email: "",
      avatarAlt: "",
      links: [],
      highlights: [],
    },
    sections: [],
    sectionItems: [],
    momentaryTabs: [],
    momentaryItems: [],
  };
}

function emptySection(): SiteSection {
  return {
    id: "",
    route: "",
    label: "",
    eyebrow: "",
    title: "",
    description: "",
    iconKey: FIRST_ICON,
    orbit: "inner",
    angle: 0,
    order: 0,
    visibleFrom: null,
    visibleUntil: null,
    enabled: true,
  };
}

function emptySectionItem(sectionId: string): SectionItem {
  return {
    id: "",
    sectionId,
    kind: "card",
    kicker: "",
    title: "",
    meta: null,
    description: "",
    href: null,
    tags: [],
    iconKey: FIRST_ICON,
    order: 0,
    visibleFrom: null,
    visibleUntil: null,
    featured: false,
  };
}

function emptyTab(): MomentaryTab {
  return {
    id: "",
    label: "",
    iconKey: FIRST_ICON,
    angle: 0,
    order: 0,
    visibleFrom: null,
    visibleUntil: null,
    enabled: true,
  };
}

function emptyMomentaryItem(tabId: string): MomentaryItem {
  return {
    id: "",
    tabId,
    kind: "note",
    kicker: "",
    title: "",
    meta: null,
    description: "",
    href: null,
    tags: [],
    iconKey: FIRST_ICON,
    order: 0,
    visibleFrom: null,
    visibleUntil: null,
    featured: false,
  };
}

function emptyLink(): ProfileLink {
  return { label: "", href: "", kind: "web" };
}

// Which entity the sidebar is editing. Sections/tabs are addressed by index so
// the selection survives the user editing their (mutable) id.
type Selection =
  | { kind: "identity" }
  | { kind: "section"; index: number }
  | { kind: "tab"; index: number };

// Round every order to an integer (the backend stores order as INTEGER) and
// drop empty optional text to null before sending.
function prepareForSave(doc: AdminContentData): AdminContentData {
  const cleanItem = <T extends SectionItem | MomentaryItem>(item: T): T => ({
    ...item,
    order: Math.round(item.order),
    meta: item.meta && item.meta.trim() ? item.meta.trim() : null,
    href: item.href && item.href.trim() ? item.href.trim() : null,
  });

  return {
    profile: doc.profile,
    sections: doc.sections.map((section) => ({ ...section, order: Math.round(section.order) })),
    sectionItems: doc.sectionItems.map(cleanItem),
    momentaryTabs: doc.momentaryTabs.map((tab) => ({ ...tab, order: Math.round(tab.order) })),
    momentaryItems: doc.momentaryItems.map(cleanItem),
  };
}

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

  const logout = useCallback(() => {
    clearStoredAdminSession();
    navigate("/", { replace: true });
  }, [navigate]);

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

  const saveAdminData = async () => {
    const currentSession = getStoredAdminSession();
    if (!currentSession) {
      redirectToLogin();
      return;
    }

    const validationErrors = validateDoc(doc);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setStatus("Revisa los campos");
      setMessage(null);
      return;
    }

    setErrors([]);
    setBusy(true);
    setMessage(null);
    setStatus("Guardando…");

    try {
      const saved = await saveAdminSiteData(currentSession.accessToken, prepareForSave(doc), revision);
      applyLoaded(saved);
      setStatus("Guardado");
      setMessage("Cambios guardados correctamente.");
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 401) {
        redirectToLogin();
        return;
      }
      if (saveError instanceof ApiError && saveError.status === 409) {
        setStatus("Conflicto");
        setMessage(
          "El contenido cambió desde que lo cargaste. Pulsa «Recargar» para traer la última versión (perderás los cambios sin guardar).",
        );
        return;
      }
      setStatus("Error");
      setMessage(saveError instanceof Error ? saveError.message : "No se pudo guardar el contenido.");
    } finally {
      setBusy(false);
    }
  };

  const dirty = loaded && JSON.stringify(doc) !== savedSnapshot;

  // Parse the saved baseline once so the sidebar can flag exactly which entity
  // has unsaved edits. Entities are matched by id; a missing id (new or renamed
  // section/tab) counts as changed.
  const savedDoc = useMemo<AdminContentData | null>(
    () => (savedSnapshot ? (JSON.parse(savedSnapshot) as AdminContentData) : null),
    [savedSnapshot],
  );

  const isProfileDirty =
    savedDoc !== null && JSON.stringify(doc.profile) !== JSON.stringify(savedDoc.profile);

  const isSectionDirty = (section: SiteSection): boolean => {
    if (!savedDoc) return false;
    const saved = savedDoc.sections.find((item) => item.id === section.id);
    if (!saved) return true;
    if (JSON.stringify(section) !== JSON.stringify(saved)) return true;
    const current = doc.sectionItems.filter((item) => item.sectionId === section.id);
    const base = savedDoc.sectionItems.filter((item) => item.sectionId === section.id);
    return JSON.stringify(current) !== JSON.stringify(base);
  };

  const isTabDirty = (tab: MomentaryTab): boolean => {
    if (!savedDoc) return false;
    const saved = savedDoc.momentaryTabs.find((item) => item.id === tab.id);
    if (!saved) return true;
    if (JSON.stringify(tab) !== JSON.stringify(saved)) return true;
    const current = doc.momentaryItems.filter((item) => item.tabId === tab.id);
    const base = savedDoc.momentaryItems.filter((item) => item.tabId === tab.id);
    return JSON.stringify(current) !== JSON.stringify(base);
  };

  const patchProfile = (patch: Partial<AdminContentData["profile"]>) =>
    setDoc((current) => ({ ...current, profile: { ...current.profile, ...patch } }));

  const sections = doc.sections;
  const tabs = doc.momentaryTabs;

  // A stale index (after reload/reorder/delete) safely falls back to identity.
  const active: Selection =
    (selection.kind === "section" && !sections[selection.index]) ||
    (selection.kind === "tab" && !tabs[selection.index])
      ? { kind: "identity" }
      : selection;

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
            <button type="button" className="admin-primary" onClick={saveAdminData} disabled={busy}>
              Guardar
            </button>
            <button type="button" className="admin-danger" onClick={logout}>
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
              <IdentityEditor profile={doc.profile} patchProfile={patchProfile} />
            ) : active.kind === "section" ? (
              <SectionEditor
                section={sections[active.index]}
                onChange={(next) => updateSection(active.index, next)}
                onDelete={() => deleteSection(active.index)}
                items={doc.sectionItems.filter((item) => item.sectionId === sections[active.index].id)}
                onItemsChange={(next) => replaceSectionItems(sections[active.index].id, next)}
              />
            ) : (
              <TabEditor
                tab={tabs[active.index]}
                onChange={(next) => updateTab(active.index, next)}
                onDelete={() => deleteTab(active.index)}
                items={doc.momentaryItems.filter((item) => item.tabId === tabs[active.index].id)}
                onItemsChange={(next) => replaceTabItems(tabs[active.index].id, next)}
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

function IdentityEditor({
  profile,
  patchProfile,
}: {
  profile: AdminContentData["profile"];
  patchProfile: (patch: Partial<AdminContentData["profile"]>) => void;
}) {
  return (
    <>
      <div className="admin-entity-head">
        <h2>Identidad</h2>
      </div>
      <div className="admin-grid">
        <TextField label="Nombre" value={profile.name} onChange={(value) => patchProfile({ name: value })} />
        <TextField label="Rol" value={profile.role} onChange={(value) => patchProfile({ role: value })} />
        <TextField label="Ubicación" value={profile.location} onChange={(value) => patchProfile({ location: value })} />
        <TextField label="Email" type="email" value={profile.email} onChange={(value) => patchProfile({ email: value })} />
      </div>
      <TextAreaField label="Tagline" value={profile.tagline} onChange={(value) => patchProfile({ tagline: value })} />
      <TextField
        label="Texto alternativo del avatar"
        value={profile.avatarAlt}
        onChange={(value) => patchProfile({ avatarAlt: value })}
      />
      <TagsField label="Highlights" value={profile.highlights} onChange={(value) => patchProfile({ highlights: value })} />
      <hr className="admin-divider" />
      <CollectionEditor<ProfileLink>
        title="Enlaces de marca"
        items={profile.links}
        onChange={(links) => patchProfile({ links })}
        makeEmpty={emptyLink}
        addLabel="Añadir enlace"
        describeItem={(link, index) => link.label || `Enlace ${index + 1}`}
        renderItem={(link, update) => (
          <div className="admin-grid">
            <TextField label="Etiqueta" value={link.label} onChange={(value) => update({ ...link, label: value })} />
            <TextField label="URL" value={link.href} onChange={(value) => update({ ...link, href: value })} />
            <SelectField
              label="Tipo"
              value={link.kind}
              options={LINK_KIND_OPTIONS}
              onChange={(value) => update({ ...link, kind: value as LinkKind })}
            />
          </div>
        )}
      />
    </>
  );
}

function SectionEditor({
  section,
  onChange,
  onDelete,
  items,
  onItemsChange,
}: {
  section: SiteSection;
  onChange: (section: SiteSection) => void;
  onDelete: () => void;
  items: SectionItem[];
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
        <TextField label="id" value={section.id} onChange={(value) => onChange({ ...section, id: value })} />
        <TextField label="route" value={section.route} onChange={(value) => onChange({ ...section, route: value })} />
        <TextField label="label" value={section.label} onChange={(value) => onChange({ ...section, label: value })} />
        <TextField label="eyebrow" value={section.eyebrow} onChange={(value) => onChange({ ...section, eyebrow: value })} />
        <TextField label="title" value={section.title} onChange={(value) => onChange({ ...section, title: value })} />
        <SelectField label="icono" value={section.iconKey} options={ICON_OPTIONS} onChange={(value) => onChange({ ...section, iconKey: value })} />
        <NumberField label="ángulo" value={section.angle} onChange={(value) => onChange({ ...section, angle: value })} />
        <NumberField label="orden" value={section.order} onChange={(value) => onChange({ ...section, order: value })} />
      </div>
      <TextAreaField label="descripción" value={section.description} onChange={(value) => onChange({ ...section, description: value })} />
      <div className="admin-grid">
        <DateTimeField label="visible desde" value={section.visibleFrom} onChange={(value) => onChange({ ...section, visibleFrom: value })} />
        <DateTimeField label="visible hasta" value={section.visibleUntil} onChange={(value) => onChange({ ...section, visibleUntil: value })} />
      </div>
      <CheckboxField label="Habilitada" value={section.enabled} onChange={(value) => onChange({ ...section, enabled: value })} />
      <hr className="admin-divider" />
      <CollectionEditor<SectionItem>
        title="Items de esta sección"
        items={items}
        onChange={onItemsChange}
        makeEmpty={() => emptySectionItem(section.id)}
        addLabel="Añadir item"
        describeItem={(item, index) => item.title || item.id || `Item ${index + 1}`}
        renderItem={(item, update) => <ItemEditor item={item} onChange={update} />}
      />
    </>
  );
}

function TabEditor({
  tab,
  onChange,
  onDelete,
  items,
  onItemsChange,
}: {
  tab: MomentaryTab;
  onChange: (tab: MomentaryTab) => void;
  onDelete: () => void;
  items: MomentaryItem[];
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
        <TextField label="id" value={tab.id} onChange={(value) => onChange({ ...tab, id: value })} />
        <TextField label="label" value={tab.label} onChange={(value) => onChange({ ...tab, label: value })} />
        <SelectField label="icono" value={tab.iconKey} options={ICON_OPTIONS} onChange={(value) => onChange({ ...tab, iconKey: value })} />
        <NumberField label="ángulo" value={tab.angle} onChange={(value) => onChange({ ...tab, angle: value })} />
        <NumberField label="orden" value={tab.order} onChange={(value) => onChange({ ...tab, order: value })} />
      </div>
      <div className="admin-grid">
        <DateTimeField label="visible desde" value={tab.visibleFrom} onChange={(value) => onChange({ ...tab, visibleFrom: value })} />
        <DateTimeField label="visible hasta" value={tab.visibleUntil} onChange={(value) => onChange({ ...tab, visibleUntil: value })} />
      </div>
      <CheckboxField label="Habilitada" value={tab.enabled} onChange={(value) => onChange({ ...tab, enabled: value })} />
      <hr className="admin-divider" />
      <CollectionEditor<MomentaryItem>
        title="Items de esta pestaña"
        items={items}
        onChange={onItemsChange}
        makeEmpty={() => emptyMomentaryItem(tab.id)}
        addLabel="Añadir item"
        describeItem={(item, index) => item.title || item.id || `Item ${index + 1}`}
        renderItem={(item, update) => <ItemEditor item={item} onChange={update} />}
      />
    </>
  );
}

function ItemEditor<T extends SectionItem | MomentaryItem>({
  item,
  onChange,
}: {
  item: T;
  onChange: (item: T) => void;
}) {
  return (
    <>
      <div className="admin-grid">
        <TextField label="id" value={item.id} onChange={(value) => onChange({ ...item, id: value })} />
        <TextField label="kind" value={item.kind} onChange={(value) => onChange({ ...item, kind: value })} hint="card, project, post, doc, note…" />
        <SelectField label="icono" value={item.iconKey} options={ICON_OPTIONS} onChange={(value) => onChange({ ...item, iconKey: value })} />
        <TextField label="kicker" value={item.kicker} onChange={(value) => onChange({ ...item, kicker: value })} />
        <TextField label="title" value={item.title} onChange={(value) => onChange({ ...item, title: value })} />
        <TextField label="meta" value={item.meta ?? ""} onChange={(value) => onChange({ ...item, meta: value })} />
        <TextField label="href" value={item.href ?? ""} onChange={(value) => onChange({ ...item, href: value })} />
        <NumberField label="orden" value={item.order} onChange={(value) => onChange({ ...item, order: value })} />
      </div>
      <TextAreaField label="descripción" value={item.description} onChange={(value) => onChange({ ...item, description: value })} />
      <TagsField label="tags" value={item.tags} onChange={(value) => onChange({ ...item, tags: value })} />
      <div className="admin-grid">
        <DateTimeField label="visible desde" value={item.visibleFrom} onChange={(value) => onChange({ ...item, visibleFrom: value })} />
        <DateTimeField label="visible hasta" value={item.visibleUntil} onChange={(value) => onChange({ ...item, visibleUntil: value })} />
      </div>
      <CheckboxField label="Destacado" value={item.featured} onChange={(value) => onChange({ ...item, featured: value })} />
    </>
  );
}
