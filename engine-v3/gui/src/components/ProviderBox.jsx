/**
 * The provider controls box — one collapsible card (collapsed by default) holding the active
 * provider's OWN controls, capability-driven from its `settings.js`. Each control has an info
 * tooltip. The BYOK key is NOT saved automatically — it's held in memory for the session unless
 * you explicitly Save it to the browser (and you can Clear a saved one). The negative prompt is a
 * real textarea that accepts DPL (rolled out before sending), with a Random roll button.
 * @module gui/components/ProviderBox
 */
import { useEffect, useState } from "react";
import { Text, Num, Toggle, Select } from "./Field.jsx";
import { getProvider } from "../lib/providers/index.js";
import { useProviderSettings } from "../lib/useProvider.js";
import { infoFor } from "../../providers/_shared/fieldInfo.js";
import { getSessionKey, setSessionKey } from "../lib/sessionKeys.js";
import { expandPrompt } from "../lib/promptEngine.js";

/**
 * A small info "i" with a tooltip.
 * @param {object} props `{ text }`.
 * @returns {(JSX.Element|null)}
 */
function InfoTip({ text }) {
  if (!text) return null;
  return (
    <span className="info-tip" title={text} aria-label={text} role="img">
      i
    </span>
  );
}

/**
 * Render one capability-driven provider field (with its tooltip).
 * @param {object} props `{ f, params, setParam, optionData, onRandom }`.
 * @returns {JSX.Element}
 */
function ProviderField({ f, params, setParam, optionData, onRandom }) {
  const v = params[f.key];
  const label = (
    <>
      {f.label}
      <InfoTip text={infoFor(f)} />
    </>
  );
  if (f.type === "checkbox")
    return <Toggle label={label} value={v} onChange={(x) => setParam(f.key, x)} />;
  if (f.type === "select") {
    const options = f.options || optionData[f.optionsFrom] || [];
    return (
      <Select
        label={label}
        value={v ?? ""}
        options={options}
        onChange={(x) => setParam(f.key, x)}
      />
    );
  }
  if (f.type === "number") {
    return (
      <Num
        label={label}
        value={v}
        min={f.min}
        max={f.max}
        step={f.step}
        onChange={(x) => setParam(f.key, x)}
      />
    );
  }
  if (f.type === "textarea") {
    return (
      <label className="field field-wide">
        <span className="field-label-row">
          {label}
          {onRandom && (
            <button
              type="button"
              className="field-roll"
              onClick={() => onRandom(f.key)}
              title="Roll the DPL in this box into a concrete value"
            >
              ⟳ random
            </button>
          )}
        </span>
        <textarea
          rows={3}
          value={v ?? ""}
          placeholder="e.g. blurry, lowres, {#bad-anatomy} — DPL is rolled out before sending"
          onChange={(e) => setParam(f.key, e.target.value)}
        />
      </label>
    );
  }
  return <Text label={label} value={v} onChange={(x) => setParam(f.key, x)} />;
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
  const [collapsed, setCollapsed] = useState(true);
  const [keyInput, setKeyInput] = useState("");

  // Reset the in-memory key field when the provider changes (show the session key, else the saved one).
  useEffect(() => {
    setKeyInput(getSessionKey(pid) || settings.keys?.[pid] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  const setParam = (key, value) =>
    setSettings((s) => ({
      ...s,
      providerParams: { ...s.providerParams, [pid]: { ...s.providerParams?.[pid], [key]: value } },
    }));

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

  // Roll a DPL field (e.g. the negative prompt) into one concrete randomized value.
  const rollField = (key) => {
    try {
      setParam(key, expandPrompt(params[key] || "{#random-words}", settings));
    } catch {
      /* engine not ready — leave as-is */
    }
  };

  const onKeyInput = (val) => {
    setKeyInput(val);
    setSessionKey(pid, val); // in memory only — not persisted until Save
  };
  const saved = !!settings.keys?.[pid];
  const saveKey = () => {
    if (!keyInput) return;
    if (
      confirm(
        "Save this API key in your browser? It will persist on this device until you clear it.",
      )
    )
      setSettings((s) => ({ ...s, keys: { ...s.keys, [pid]: keyInput } }));
  };
  const clearKey = () => {
    if (!confirm("Remove the saved API key from this browser?")) return;
    setSettings((s) => {
      const keys = { ...s.keys };
      delete keys[pid];
      return { ...s, keys };
    });
  };

  const fields = schema?.fields || [];
  if (!provider || (!fields.length && !provider.needsKey)) return null;

  const tierLabel =
    provider.tier === "api"
      ? "image API"
      : provider.tier === "syntax"
        ? "copy-prompt"
        : "plain text";

  return (
    <section className="card provider-box">
      <button
        className="provider-box-head"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="disclosure">{collapsed ? "▸" : "▾"}</span>
        <h2 className="section-title">{provider.label}</h2>
        <span className="provider-tag">{tierLabel}</span>
        {collapsed && <span className="provider-box-hint">controls</span>}
      </button>

      {!collapsed && (
        <div className="provider-box-body">
          {provider.needsKey && (
            <div className="key-row">
              <label className="field field-wide">
                <span className="field-label-row">
                  API key
                  <InfoTip text="Your key for this provider. Kept in memory for this session only — click Save to store it in this browser." />
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="not saved unless you click Save"
                  value={keyInput}
                  onChange={(e) => onKeyInput(e.target.value)}
                />
              </label>
              <div className="key-actions">
                <button onClick={saveKey} disabled={!keyInput}>
                  Save
                </button>
                {saved && (
                  <button className="ghost" onClick={clearKey}>
                    Clear saved
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="group-body">
            {fields.map((f) => (
              <ProviderField
                key={f.key}
                f={f}
                params={params}
                setParam={setParam}
                optionData={options}
                onRandom={f.key === "negativePrompt" ? rollField : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
