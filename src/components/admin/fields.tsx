import { CircleHelp, TriangleAlert, X } from "lucide-react";
import { useId, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";

type BaseFieldProps = {
  label: string;
  error?: string;
  hint?: string;
  tooltip?: string;
  dirty?: boolean;
};

function FieldShell({
  label,
  error,
  hint,
  tooltip,
  dirty,
  children,
}: BaseFieldProps & { children: ReactNode }) {
  return (
    <label className={`admin-field ${error ? "has-error" : ""}`}>
      <span className="admin-field-label-row">
        <span className="admin-field-label">{label}</span>
        {tooltip ? <FieldTooltip text={tooltip} /> : null}
        <FieldDirtyMark show={Boolean(dirty)} />
      </span>
      {children}
      {hint && !error ? <span className="admin-field-hint">{hint}</span> : null}
      {error ? <span className="admin-field-error">{error}</span> : null}
    </label>
  );
}

function FieldDirtyMark({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="admin-field-dirty-mark" title="Cambios sin guardar" aria-label="Cambios sin guardar">
      <TriangleAlert size={14} aria-hidden="true" />
      <span className="admin-field-dirty-text">Cambios sin guardar</span>
    </span>
  );
}

export function FieldTooltip({ text }: { text: string }) {
  return (
    <span
      className="admin-field-tooltip"
      role="img"
      aria-label={text}
      tabIndex={0}
      title={text}
    >
      <CircleHelp size={14} aria-hidden="true" />
      <span className="admin-field-tooltip-popover" role="tooltip">
        {text}
      </span>
    </span>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  hint,
  tooltip,
  dirty,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <FieldShell label={label} error={error} hint={hint} tooltip={tooltip} dirty={dirty}>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  error,
  hint,
  tooltip,
  dirty,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <FieldShell label={label} error={error} hint={hint} tooltip={tooltip} dirty={dirty}>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </FieldShell>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  error,
  hint,
  tooltip,
  dirty,
}: BaseFieldProps & {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <FieldShell label={label} error={error} hint={hint} tooltip={tooltip} dirty={dirty}>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  error,
  hint,
  tooltip,
  dirty,
}: BaseFieldProps & {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <FieldShell label={label} error={error} hint={hint} tooltip={tooltip} dirty={dirty}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  label,
  value,
  onChange,
  tooltip,
  dirty,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  tooltip?: string;
  dirty?: boolean;
}) {
  return (
    <label className="admin-checkbox">
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
      {tooltip ? <FieldTooltip text={tooltip} /> : null}
      <FieldDirtyMark show={Boolean(dirty)} />
    </label>
  );
}

export function TagsField({
  label,
  value,
  onChange,
  hint = "Pulsa Enter para añadir un tag.",
  error,
  tooltip,
  dirty,
}: BaseFieldProps & {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const addDraft = () => {
    if (draft.trim().length === 0) return;
    onChange([...value, draft]);
    setDraft("");
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, position) => position !== index));
  };

  const moveTag = (fromIndex: number, toIndex: number) => {
    if (
      !Number.isInteger(fromIndex) ||
      !Number.isInteger(toIndex) ||
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= value.length ||
      toIndex >= value.length
    ) {
      return;
    }
    const copy = value.slice();
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, moved);
    onChange(copy);
  };

  const finishDrag = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragStart = (event: DragEvent<HTMLLIElement>, index: number) => {
    setDraggedIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (event: DragEvent<HTMLLIElement>, index: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDrop = (event: DragEvent<HTMLLIElement>, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    const fromIndex = draggedIndex ?? Number(event.dataTransfer.getData("text/plain"));
    moveTag(fromIndex, index);
    finishDrag();
  };

  const handleEditorDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (draggedIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleEditorDrop = (event: DragEvent<HTMLDivElement>) => {
    if (draggedIndex === null) return;
    event.preventDefault();
    moveTag(draggedIndex, value.length - 1);
    finishDrag();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    addDraft();
  };

  return (
    <div className={`admin-field admin-tags-field ${error ? "has-error" : ""}`}>
      <span className="admin-field-label-row">
        <label className="admin-field-label" htmlFor={inputId}>
          {label}
        </label>
        {tooltip ? <FieldTooltip text={tooltip} /> : null}
        <FieldDirtyMark show={Boolean(dirty)} />
      </span>
      <div
        className="admin-tags-editor"
        onClick={() => inputRef.current?.focus()}
        onDragOver={handleEditorDragOver}
        onDrop={handleEditorDrop}
      >
        {value.length > 0 ? (
          <ul className="admin-tags-list" aria-label={`${label} actuales`}>
            {value.map((tag, index) => (
              <li
                className={`admin-tag-pill ${draggedIndex === index ? "is-dragging" : ""} ${
                  dragOverIndex === index && draggedIndex !== index ? "is-drag-over" : ""
                }`}
                key={`${tag}-${index}`}
                draggable
                onDragStart={(event) => handleDragStart(event, index)}
                onDragOver={(event) => handleDragOver(event, index)}
                onDrop={(event) => handleDrop(event, index)}
                onDragEnd={finishDrag}
              >
                <span>{tag}</span>
                <button
                  type="button"
                  draggable={false}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeAt(index);
                  }}
                  aria-label={`Eliminar ${tag}`}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {hint && !error ? <span className="admin-field-hint">{hint}</span> : null}
      {error ? <span className="admin-field-error">{error}</span> : null}
    </div>
  );
}

// datetime-local works in minutes; the stored value keeps the trimmed ISO
// string (or null when empty). The backend treats a naive value as UTC.
export function DateTimeField({
  label,
  value,
  onChange,
  hint,
  tooltip,
  dirty,
}: BaseFieldProps & {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const localValue = value ? value.slice(0, 16) : "";
  return (
    <FieldShell label={label} hint={hint} tooltip={tooltip} dirty={dirty}>
      <input
        type="datetime-local"
        value={localValue}
        onChange={(event) => onChange(event.target.value ? event.target.value : null)}
      />
    </FieldShell>
  );
}

// Ordered list editor with add / remove / move controls. Keeps the parent in
// charge of the data; it only ever calls onChange with a new array.
export function CollectionEditor<T>({
  title,
  items,
  onChange,
  makeEmpty,
  renderItem,
  describeItem,
  addLabel = "Añadir",
  reorderOnMove,
}: {
  title: string;
  items: T[];
  onChange: (items: T[]) => void;
  makeEmpty: () => T;
  renderItem: (item: T, update: (next: T) => void, index: number) => ReactNode;
  describeItem?: (item: T, index: number) => string;
  addLabel?: string;
  reorderOnMove?: (items: T[]) => T[];
}) {
  const replaceAt = (index: number, next: T) => {
    const copy = items.slice();
    copy[index] = next;
    onChange(copy);
  };

  const removeAt = (index: number) => {
    onChange(items.filter((_, position) => position !== index));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const copy = items.slice();
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    onChange(reorderOnMove ? reorderOnMove(copy) : copy);
  };

  return (
    <div className="admin-collection">
      <div className="admin-collection-head">
        <h3>{title}</h3>
        <button type="button" onClick={() => onChange([...items, makeEmpty()])}>
          {addLabel}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="admin-collection-empty">Sin elementos todavía.</p>
      ) : (
        <ul className="admin-collection-list">
          {items.map((item, index) => (
            <li className="admin-collection-item" key={index}>
              <div className="admin-collection-item-head">
                <span>{describeItem ? describeItem(item, index) : `#${index + 1}`}</span>
                <div className="admin-collection-item-actions">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Subir">
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label="Bajar"
                  >
                    ↓
                  </button>
                  <button type="button" className="admin-danger" onClick={() => removeAt(index)} aria-label="Eliminar">
                    ✕
                  </button>
                </div>
              </div>
              <div className="admin-collection-item-body">
                {renderItem(item, (next) => replaceAt(index, next), index)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
