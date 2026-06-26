/**
 * The provider controls box — one optional card holding the active provider's OWN controls
 * (URL / key / checkpoint / sampler / steps / size / …). It's capability-driven: it renders
 * whatever fields that provider's `settings.js` declares (so each shows only what it supports),
 * stored under the per-provider namespace `providerParams[id]`. Hidden for providers with no
 * controls. The provider is chosen in the header; everything non-provider lives behind the gear.
 * @module gui/components/ProviderBox
 */
import { useEffect } from "react";
import { Text, Num, Toggle, Select } from "./Field.jsx";
import { getProvider } from "../lib/providers/index.js";
import { useProviderSettings } from "../lib/useProvider.js";

/**
 * Render one capability-driven provider field bound to the per-provider param namespace.
 * @param {object} props `{ f, params, setParam, optionData }`.
 * @returns {JSX.Element}
 */
function ProviderField({ f, params, setParam, optionData }) {
  const v = params[f.key];
  if (f.type === "checkbox") {
    return <Toggle label={f.label} value={v} onChange={(x) => setParam(f.key, x)} />;
  }
  if (f.type === "select") {
    const options = f.options || optionData[f.optionsFrom] || [];
    return (
      <Select
        label={f.label}
        value={v ?? ""}
        options={options}
        onChange={(x) => setParam(f.key, x)}
      />
    );
  }
  if (f.type === "number") {
    return (
      <Num
        label={f.label}
        value={v}
        min={f.min}
        max={f.max}
        step={f.step}
        onChange={(x) => setParam(f.key, x)}
      />
    );
  }
  return <Text label={f.label} value={v} onChange={(x) => setParam(f.key, x)} />;
}

/**
 * The provider controls box.
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {(JSX.Element|null)}
 */
export default function ProviderBox({ settings, setSettings }) {
  const provider = getProvider(settings.provider);
  const pid = provider?.id;
  const { schema, options } = useProviderSettings(pid);
  const params = settings.providerParams?.[pid] || {};

  const setParam = (key, value) =>
    setSettings((s) => ({
      ...s,
      providerParams: { ...s.providerParams, [pid]: { ...s.providerParams?.[pid], [key]: value } },
    }));
  const setKey = (value) => setSettings((s) => ({ ...s, keys: { ...s.keys, [pid]: value } }));

  // Seed missing param defaults when the provider's schema loads (without clobbering saved values).
  useEffect(() => {
    if (!schema?.defaults || !pid) return;
    setSettings((s) => {
      const cur = s.providerParams?.[pid] || {};
      let changed = false;
      const next = { ...cur };
      for (const [k, val] of Object.entries(schema.defaults)) {
        if (next[k] === undefined) {
          next[k] = val;
          changed = true;
        }
      }
      return changed ? { ...s, providerParams: { ...s.providerParams, [pid]: next } } : s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, pid]);

  const fields = schema?.fields || [];
  if (!provider || (!fields.length && !provider.needsKey)) return null;

  return (
    <section className="card provider-box">
      <div className="provider-box-head">
        <h2 className="section-title">{provider.label}</h2>
        <span className="provider-tag">
          {provider.tier === "api"
            ? "image API"
            : provider.tier === "syntax"
              ? "copy-prompt"
              : "plain text"}
        </span>
      </div>

      <div className="group-body">
        {provider.needsKey && (
          <label className="field">
            <span>API key</span>
            <input
              type="password"
              autoComplete="off"
              placeholder="kept only in this browser"
              value={settings.keys?.[pid] || ""}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
        )}
        {fields.map((f) => (
          <ProviderField
            key={f.key}
            f={f}
            params={params}
            setParam={setParam}
            optionData={options}
          />
        ))}
      </div>
    </section>
  );
}
