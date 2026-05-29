import type { ReactNode } from "react";

type BaseFieldProps = {
  label: string;
  error?: string;
  hint?: string;
};

function FieldShell({
  label,
  error,
  hint,
  children,
}: BaseFieldProps & { children: ReactNode }) {
  return (
    <label className={`admin-field ${error ? "has-error" : ""}`}>
      <span className="admin-field-label">{label}</span>
      {children}
      {hint && !error ? <span className="admin-field-hint">{hint}</span> : null}
      {error ? <span className="admin-field-error">{error}</span> : null}
    </label>
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
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
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
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
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
}: BaseFieldProps & {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
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
}: BaseFieldProps & {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
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
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="admin-checkbox">
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function TagsField({
  label,
  value,
  onChange,
  hint = "Separadas por comas",
  error,
}: BaseFieldProps & {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      <input
        type="text"
        value={value.join(", ")}
        onChange={(event) =>
          onChange(
            event.target.value
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0),
          )
        }
      />
    </FieldShell>
  );
}

// datetime-local works in minutes; the stored value keeps the trimmed ISO
// string (or null when empty). The backend treats a naive value as UTC.
export function DateTimeField({
  label,
  value,
  onChange,
  hint,
}: BaseFieldProps & {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const localValue = value ? value.slice(0, 16) : "";
  return (
    <FieldShell label={label} hint={hint}>
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
}: {
  title: string;
  items: T[];
  onChange: (items: T[]) => void;
  makeEmpty: () => T;
  renderItem: (item: T, update: (next: T) => void) => ReactNode;
  describeItem?: (item: T, index: number) => string;
  addLabel?: string;
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
    onChange(copy);
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
                {renderItem(item, (next) => replaceAt(index, next))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
