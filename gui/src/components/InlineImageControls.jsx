/**
 * The active image provider's *common* image knobs, surfaced inline at the bottom-left of the
 * prompt box (next to the Prompts counter) instead of being buried in the provider gear: the
 * batch count ("Images") and the output size (a Size / Ratio select, or a Width × Height pair —
 * whichever the provider exposes). Capability-driven: it reads the provider's own settings schema
 * and renders only the controls that exist, so providers without image knobs (plain text, the
 * copy-prompt syntax providers like Midjourney) render nothing. Values are written to the same
 * `providerParams[id]` namespace the provider gear (`ProviderBox`) uses, so the two stay in sync.
 * @module gui/components/InlineImageControls
 */
import { useIntl, defineMessages } from "react-intl";
import { getProvider } from "../lib/providers/index.js";
import { useProviderSettings } from "../lib/useProvider.js";

const msgs = defineMessages({
  imagesTitle: { id: "inlineImg.imagesTitle", defaultMessage: "Images generated per prompt" },
  images: { id: "inlineImg.images", defaultMessage: "Images" },
  ratio: { id: "inlineImg.ratio", defaultMessage: "Ratio" },
  size: { id: "inlineImg.size", defaultMessage: "Size" },
  sizeTitle: { id: "inlineImg.sizeTitle", defaultMessage: "Output size — width × height" },
  width: { id: "inlineImg.width", defaultMessage: "Width" },
  height: { id: "inlineImg.height", defaultMessage: "Height" },
});

// Keys a provider may use to express output size / aspect. The first matching field wins (rendered
// as its native control — select or text); only when there's none do we fall back to the
// imageWidth × imageHeight number pair. `ar` is Midjourney's aspect-ratio flag.
const SIZE_KEYS = ["size", "imageSize", "aspectRatio", "ar"];

/**
 * Inline provider image controls (Images + Size).
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {(JSX.Element|null)}
 */
export default function InlineImageControls({ settings, setSettings }) {
  const intl = useIntl();
  const provider = getProvider(settings.provider);
  const pid = provider?.id;
  const { schema, options } = useProviderSettings(pid);

  // Surface for any provider that exposes the relevant fields — the in-app generators (api tier)
  // plus copy-prompt providers like Midjourney (its aspect ratio). Providers without these fields
  // (plain text) render nothing.
  if (!provider || !schema) return null;

  const fields = schema.fields || [];
  const defaults = schema.defaults || {};
  const params = settings.providerParams?.[pid] || {};
  const setParam = (key, value) =>
    setSettings((s) => ({
      ...s,
      providerParams: { ...s.providerParams, [pid]: { ...s.providerParams?.[pid], [key]: value } },
    }));

  const batch = fields.find((f) => f.key === "batchSize");
  const sizeField = fields.find((f) => SIZE_KEYS.includes(f.key));
  const width = fields.find((f) => f.key === "imageWidth");
  const height = fields.find((f) => f.key === "imageHeight");

  if (!batch && !sizeField && !(width && height)) return null;

  const sizeLabel = intl.formatMessage(
    sizeField && (sizeField.key === "aspectRatio" || sizeField.key === "ar") ? msgs.ratio : msgs.size,
  );
  const sizeOptions = sizeField ? sizeField.options || options[sizeField.optionsFrom] || [] : [];

  return (
    <>
      {batch && (
        <label className="field-count" title={intl.formatMessage(msgs.imagesTitle)}>
          <span className="field-count-label">{intl.formatMessage(msgs.images)}</span>
          <input
            type="number"
            min={batch.min ?? 1}
            max={batch.max}
            value={params.batchSize ?? defaults.batchSize ?? 1}
            onChange={(e) => setParam("batchSize", Math.max(1, Number(e.target.value) || 1))}
            aria-label={intl.formatMessage(msgs.imagesTitle)}
          />
        </label>
      )}

      {sizeField ? (
        <label className="field-count field-size" title={sizeField.label}>
          <span className="field-count-label">{sizeLabel}</span>
          {sizeField.type === "select" ? (
            <select
              className="field-size-select"
              value={params[sizeField.key] ?? defaults[sizeField.key] ?? ""}
              onChange={(e) => setParam(sizeField.key, e.target.value)}
              aria-label={sizeField.label}
            >
              {sizeOptions.map((o) => {
                const opt = typeof o === "string" ? { value: o, label: o } : o;
                return (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              type={sizeField.type === "number" ? "number" : "text"}
              className="field-size-text"
              value={params[sizeField.key] ?? defaults[sizeField.key] ?? ""}
              onChange={(e) => setParam(sizeField.key, e.target.value)}
              aria-label={sizeField.label}
              placeholder="1:1"
            />
          )}
        </label>
      ) : (
        width &&
        height && (
          <label className="field-count field-size" title={intl.formatMessage(msgs.sizeTitle)}>
            <span className="field-count-label">{intl.formatMessage(msgs.size)}</span>
            <span className="field-size-wh">
              <input
                type="number"
                min={width.min}
                max={width.max}
                step={width.step}
                value={params.imageWidth ?? defaults.imageWidth ?? 512}
                onChange={(e) => setParam("imageWidth", Number(e.target.value) || 0)}
                aria-label={intl.formatMessage(msgs.width)}
              />
              <span className="field-size-x" aria-hidden="true">
                ×
              </span>
              <input
                type="number"
                min={height.min}
                max={height.max}
                step={height.step}
                value={params.imageHeight ?? defaults.imageHeight ?? 512}
                onChange={(e) => setParam("imageHeight", Number(e.target.value) || 0)}
                aria-label={intl.formatMessage(msgs.height)}
              />
            </span>
          </label>
        )
      )}
    </>
  );
}
