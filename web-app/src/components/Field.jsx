// Small labeled form controls. Each takes a value + onChange(newValue) so the
// parent owns state. Keeps the Settings / Builder forms uncluttered.

export function Text({ label, value, onChange, ...rest }) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />
    </label>
  );
}

export function Num({ label, value, onChange, step, min, max }) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <input
        type="number"
        value={value ?? 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
    </label>
  );
}

export function Toggle({ label, value, onChange }) {
  return (
    <label className="field field-toggle">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Select({ label, value, onChange, options }) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function TextArea({ label, value, onChange, rows = 3, ...rest }) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <textarea value={value ?? ""} rows={rows} onChange={(e) => onChange(e.target.value)} {...rest} />
    </label>
  );
}

export function Group({ title, children }) {
  return (
    <section className="group">
      {title && <h2>{title}</h2>}
      <div className="group-body">{children}</div>
    </section>
  );
}
