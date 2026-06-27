/**
 * The provider's own controls (rendered inside the header provider-settings gear popover,
 * `ProviderGear`) — capability-driven from the provider's `settings.js`, each with an info tooltip.
 * What's NOT here: the BYOK API key lives in the header `ApiKeyField`; the provider label/tier is
 * shown by the gear popover header; and the negative prompt is edited on the composer via its
 * Prompt/Negative switch (so it's filtered out of these controls).
 * @module gui/components/ProviderBox
 */
import { useEffect } from "react";
import { Text, Num, Toggle, Select } from "./Field.jsx";
import { getProvider } from "../lib/providers/index.js";
import { useProviderSettings } from "../lib/useProvider.js";
import { infoFor } from "../../providers/_shared/fieldInfo.js";

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
 * @param {object} props `{ f, params, setParam, optionData }`.
 * @returns {JSX.Element}
 */
function ProviderField({ f, params, setParam, optionData }) {
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
  return <Text label={label} value={v} onChange={(x) => setParam(f.key, x)} />;
}

/**
 * The provider's own controls (rendered inside the header gear popover).
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

  if (!provider) return null;
  // The negative prompt is edited on the composer (Prompt/Negative switch), not in here.
  const fields = (schema?.fields || []).filter((f) => f.key !== "negativePrompt");
  if (!fields.length)
    return (
      <p className="hint provider-controls-empty">
        {schema ? "This provider has no extra settings." : "Loading…"}
      </p>
    );

  return (
    <div className="provider-controls group-body">
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
  );
}
