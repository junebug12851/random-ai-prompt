/**
 * A compact BYOK key field for one provider — used per-row inside the header Providers dropdown
 * (once for the image provider, once for the text/rewrite provider). It targets the provider given
 * by `providerId` (falling back to the active image provider) and only appears when that provider
 * needs a key. The key is held in memory for the session only; the in-field Save icon persists it
 * to this browser and the Clear icon removes a saved one. The "Get a key" link and an info tooltip
 * are kept here too. Renders nothing for local / no-key / "none" providers.
 * @module gui/components/ApiKeyField
 */
import { useEffect, useState } from "react";
import { getProvider } from "../lib/providers/index.js";
import { getSessionKey, setSessionKey } from "../lib/sessionKeys.js";
import { metaFor } from "../lib/providerMeta.js";

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
 * A provider's API-key field.
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @param {string} [props.providerId] The provider whose key to edit (defaults to the active image
 *   provider). `"none"` / falsy renders nothing.
 * @returns {(JSX.Element|null)}
 */
export default function ApiKeyField({ settings, setSettings, providerId }) {
  const id = providerId ?? settings.provider;
  const provider = id && id !== "none" ? getProvider(id) : null;
  const pid = provider?.id;
  const [keyInput, setKeyInput] = useState("");

  // Show the session key when the provider changes, falling back to the saved one.
  useEffect(() => {
    setKeyInput(getSessionKey(pid) || settings.keys?.[pid] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  if (!provider || !provider.needsKey) return null;

  const saved = !!settings.keys?.[pid];
  const persisted = settings.keys?.[pid] || "";
  const keyUrl = metaFor(pid).keyUrl;

  const onKeyInput = (val) => {
    setKeyInput(val);
    setSessionKey(pid, val); // in memory only — not persisted until Save
  };
  const saveKey = () => {
    if (!keyInput) return;
    if (
      confirm("Save this API key in your browser? It will persist on this device until you clear it.")
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

  // Save is redundant once the typed value already matches the saved one.
  const canSave = !!keyInput && keyInput !== persisted;

  return (
    <div className="hkey">
      <InfoTip text="Your key for this provider. Kept in memory for this session only — click the save icon to store it in this browser." />
      <div className={`hkey-input${saved ? " saved" : ""}`}>
        <input
          type="password"
          autoComplete="off"
          aria-label={`${provider.label} API key`}
          placeholder="API key — not saved unless you save it"
          value={keyInput}
          onChange={(e) => onKeyInput(e.target.value)}
        />
        <button
          type="button"
          className="hkey-icon save"
          onClick={saveKey}
          disabled={!canSave}
          title={saved ? "Update the saved key in this browser" : "Save key in this browser"}
          aria-label="Save API key"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              d="M5 3h11l3 3v15H5V3z M8 3v5h7V3 M8 21v-7h8v7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {saved && (
          <button
            type="button"
            className="hkey-icon clear"
            onClick={clearKey}
            title="Remove the saved key from this browser"
            aria-label="Clear saved API key"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                d="M6 6l12 12 M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
      {keyUrl && (
        <a className="key-link" href={keyUrl} target="_blank" rel="noreferrer">
          Get a key ↗
        </a>
      )}
    </div>
  );
}
