/**
 * The header provider picker. Choosing a provider also sets the engine dialect/`mode` (the
 * provider owns the dialect). Its controls live in the provider box; everything else is behind
 * the gear.
 * @module gui/components/ProviderSelect
 */
import { availableProviders } from "../lib/providers/index.js";
import { providerMode } from "../lib/useProvider.js";

/**
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {JSX.Element}
 */
export default function ProviderSelect({ settings, setSettings }) {
  const onChange = (e) => {
    const id = e.target.value;
    setSettings((s) => ({ ...s, provider: id, mode: providerMode(id) }));
  };
  return (
    <label className="provider-select" title="Image provider">
      <span className="provider-select-label">Provider</span>
      <select value={settings.provider} onChange={onChange}>
        {availableProviders().map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
