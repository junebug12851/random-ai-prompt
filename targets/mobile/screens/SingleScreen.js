/**
 * @file The single-image view — the phone port of the web SPA's SingleView.jsx, at full feature
 * parity. One saved image up close with: prev/next navigation (position i/N), an open-full viewer,
 * overlay actions (open / share / save-to-Photos / delete), Convert (format) and Resize (scale +
 * AI upscale) tools, a lineage header + derived-children strips (Re-rolls / Variations / Resizes)
 * with in-flight placeholders, the prompt and negative each shown in their Sent / AI / Roll / DPL
 * layers (each copyable, with inline Re-roll / Make-variation actions), a curated details table
 * that toggles to raw JSON with Copy Markdown / Copy JSON, and a clickable keyword cloud (searchable,
 * AI-rebuildable). Desktop-only affordances map to their mobile equivalents: open-in-app → full
 * viewer, reveal-in-files → system share sheet, download → save to Photos, ImageMagick convert /
 * resize → expo-image-manipulator.
 */
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../lib/theme.js";
import {
  listImages,
  deleteImage,
  saveImageSrc,
  updateImageMeta,
} from "../lib/storage.js";
import {
  getImageProvider,
  getUpscaleProvider,
  getTextProvider,
  providerDefaults,
  systemFor,
  UPSCALE_PROVIDERS,
} from "../lib/imageProviders.js";
import { getKey } from "../lib/keys.js";
import { run, baseSettings } from "../lib/engine.js";
import {
  promptLayers,
  negativeLayers,
  buildDetails,
  parseKeywords,
  linkChildren,
  toMarkdown,
} from "../lib/single.js";

// Native-only modules (guarded so the react-native-web verification build still bundles).
const FS = Platform.OS === "web" ? null : require("expo-file-system/legacy");
const Manip = Platform.OS === "web" ? null : require("expo-image-manipulator");
const Media = Platform.OS === "web" ? null : require("expo-media-library");
const Sharing = Platform.OS === "web" ? null : require("expo-sharing");

// The resize factors offered (mirrors the web derive.js RESIZE_SCALES). <1 down, >1 up.
const RESIZE_SCALES = [0.25, 0.5, 2, 4];
const FRAC = { 0.25: "¼×", 0.5: "½×" };
const FORMATS = ["PNG", "JPEG", "WEBP"];

// Which layer a re-roll / variation draws from, and the human label.
const LAYER_LABEL = { dpl: "DPL source", roll: "Engine roll", ai: "AI translation", final: "Sent to model" };

async function copyText(t) {
  await Clipboard.setStringAsync(String(t ?? ""));
}

export default function SingleScreen({ image, onBack, onDeleted, onUpscaled, onSearch }) {
  const { T, rewriteProvider, providerSettings, backendUrl } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const { width } = useWindowDimensions();

  const [feed, setFeed] = useState([]); // full gallery, newest-first, with children linked
  const [current, setCurrent] = useState(image || null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [deriveErr, setDeriveErr] = useState("");
  const [derivations, setDerivations] = useState([]); // in-flight { id, kind, source }
  const [rawView, setRawView] = useState(false);
  const [showAllSettings, setShowAllSettings] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [resizeOpen, setResizeOpen] = useState(false);
  const [kwBusy, setKwBusy] = useState(false);
  const [kwErr, setKwErr] = useState("");

  const reload = useCallback(
    async (keepUri) => {
      const items = linkChildren(await listImages());
      setFeed(items);
      const uri = keepUri || current?.uri;
      const found = items.find((it) => it.uri === uri);
      if (found) setCurrent(found);
      return items;
    },
    [current?.uri],
  );

  // Sync when a NEW image is opened from the Gallery, and load the feed for prev/next + children.
  useEffect(() => {
    if (image?.uri) setCurrent(image);
    (async () => {
      const items = linkChildren(await listImages());
      setFeed(items);
      if (image?.uri) {
        const found = items.find((it) => it.uri === image.uri);
        if (found) setCurrent(found);
      } else if (items.length) {
        // No image was explicitly opened — fall back to the most recent one (like the web view).
        setCurrent((c) => c || items[0]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image?.uri]);

  const index = current ? feed.findIndex((it) => it.uri === current.uri) : -1;
  const total = feed.length;
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < total - 1;
  const go = (it) => {
    if (!it) return;
    setCurrent(it);
    setMsg("");
    setDeriveErr("");
    setRawView(false);
    setShowAllSettings(false);
  };

  if (!current) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyTitle}>No image selected</Text>
        <Text style={styles.emptyBody}>
          Open an image from the Gallery to view it up close. Prompt layers, details, re-roll,
          variations, resize, upscale, keywords, and more live here.
        </Text>
      </View>
    );
  }

  const p = promptLayers(current);
  const n = negativeLayers(current);
  const sentText = p.final || p.ai || p.roll || p.dpl || "";
  const { rows: detailRows, rest: restSettings } = buildDetails(current);
  const hasMeta = !!(current.layers || current.settings || current.provider);
  const rawJson = JSON.stringify(rawMeta(current), null, 2);
  const markdown = toMarkdown(sentText, n.final, detailRows);
  const savedKeywords = Array.isArray(current.keywords) ? current.keywords : null;
  const tags = savedKeywords && savedKeywords.length ? savedKeywords.slice(0, 80) : parseKeywords(sentText);

  // --- Derive gating (re-roll / make variation) ---
  const imgProv = getImageProvider(current.provider);
  const canGenerate = !!imgProv && !imgProv.copy && typeof imgProv.generate === "function";
  const hasSource = (src) => !!p[src];
  const hasSeedField = !!(imgProv?.settings || []).some((f) => f.key === "seed");

  const resolveDeriveText = async (src) => {
    if (src === "dpl") {
      if (!p.dpl) return null;
      try {
        const { prompts } = run.generatePrompts({
          ...baseSettings,
          ...(current.settings || {}),
          prompt: p.dpl,
          promptCount: 1,
        });
        return (prompts[0] || "").trim();
      } catch {
        return p.dpl;
      }
    }
    return p[src] ? String(p[src]) : null;
  };

  const runDerive = async (kind, source) => {
    if (busy) return;
    if (!canGenerate) {
      setDeriveErr("This image's provider can't generate here.");
      return;
    }
    const text = await resolveDeriveText(source);
    if (!text) {
      setDeriveErr(`That prompt layer (${LAYER_LABEL[source]}) isn't on this image.`);
      return;
    }
    const key = imgProv.local ? "" : await getKey(current.provider);
    if (!imgProv.local && !key) {
      setDeriveErr(`Add your ${imgProv.label} key in the ⋯ menu to re-roll / vary.`);
      return;
    }
    const neg = n.final || "";
    const settings = {
      ...providerDefaults(current.provider),
      ...(current.settings || {}),
      backendUrl,
      negativePrompt: neg,
    };
    if (hasSeedField) settings.seed = Math.floor(Math.random() * 1e15);
    const id = `${kind}-${source}-${Date.now()}`;
    setDerivations((d) => [...d, { id, kind, source }]);
    setBusy(true);
    setDeriveErr("");
    try {
      const { images } = await imgProv.generate({ prompt: text, key, settings });
      for (const img of images) {
        await saveImageSrc(img, {
          prompt: text,
          negative: neg,
          layers: { dpl: p.dpl ?? null, roll: text, ai: source === "ai" ? text : null, final: text },
          negativeLayers: { final: neg || null },
          provider: current.provider,
          providerLabel: current.providerLabel || imgProv.label,
          model: current.model,
          seed: settings.seed ?? current.seed,
          size: current.size,
          settings,
          parent: current.name,
          derivedKind: kind,
          derivedSource: source,
        });
      }
      await reload();
      onUpscaled?.();
    } catch (e) {
      setDeriveErr(e?.message || String(e));
    }
    setDerivations((d) => d.filter((x) => x.id !== id));
    setBusy(false);
  };

  // --- Resize (ImageMagick-equivalent via expo-image-manipulator) → tracked resize child ---
  const doResize = async (scale) => {
    if (busy || !Manip) return;
    const id = `resize-${scale}-${Date.now()}`;
    setResizeOpen(false);
    setDerivations((d) => [...d, { id, kind: "resize", source: null, scale }]);
    setBusy(true);
    try {
      const info = await Manip.manipulateAsync(current.uri, []);
      const targetW = Math.max(1, Math.round((info.width || 1024) * scale));
      const out = await Manip.manipulateAsync(current.uri, [{ resize: { width: targetW } }], {
        compress: 1,
        format: Manip.SaveFormat.PNG,
      });
      await saveImageSrc(out.uri, {
        prompt: current.prompt,
        negative: current.negative,
        layers: current.layers,
        negativeLayers: current.negativeLayers,
        provider: current.provider,
        providerLabel: current.providerLabel,
        model: current.model,
        seed: current.seed,
        size: `${out.width}×${out.height}`,
        settings: { ...(current.settings || {}), resizeScale: scale },
        parent: current.name,
        derivedKind: "resize",
        derivedSource: null,
      });
      await reload();
      onUpscaled?.();
      setMsg(`Resized ${FRAC[scale] || `${scale}×`} ✓`);
    } catch (e) {
      setDeriveErr(e?.message || String(e));
    }
    setDerivations((d) => d.filter((x) => x.id !== id));
    setBusy(false);
  };

  // --- AI Upscale (via the provider's upscale adapter) → tracked resize child ---
  const upscalers = UPSCALE_PROVIDERS;
  const doUpscale = async (upId) => {
    if (busy || !FS) return;
    const up = getUpscaleProvider(upId);
    if (!up) return;
    setResizeOpen(false);
    const id = `up-${upId}-${Date.now()}`;
    setDerivations((d) => [...d, { id, kind: "resize", source: null }]);
    setBusy(true);
    setMsg(`Upscaling with ${up.label}…`);
    try {
      const key = up.local ? "" : await getKey(up.id);
      if (!up.local && !key) {
        setMsg(`Add your ${up.label} key in the ⋯ menu to upscale.`);
        setDerivations((d) => d.filter((x) => x.id !== id));
        setBusy(false);
        return;
      }
      const settings = { ...providerDefaults(up.id), ...(providerSettings[up.id] || {}), backendUrl };
      const args = { key, settings };
      if (up.mode === "dataurl") {
        const b64 = await FS.readAsStringAsync(current.uri, { encoding: FS.EncodingType.Base64 });
        args.image = `data:image/png;base64,${b64}`;
      } else if (up.mode === "base64") {
        args.imageBase64 = await FS.readAsStringAsync(current.uri, { encoding: FS.EncodingType.Base64 });
      } else {
        args.imageFile = { uri: current.uri, name: "image.png", type: "image/png" };
      }
      const { images } = await up.upscale(args);
      let saved = 0;
      for (const img of images) {
        await saveImageSrc(img, {
          prompt: current.prompt,
          negative: current.negative,
          layers: current.layers,
          provider: [current.provider, up.id].filter(Boolean).join(" + "),
          providerLabel: current.providerLabel,
          model: "upscaled",
          settings: current.settings,
          parent: current.name,
          derivedKind: "resize",
          derivedSource: null,
        });
        saved++;
      }
      await reload();
      onUpscaled?.();
      setMsg(saved ? "Upscaled ✓ — saved to the Gallery." : "No upscaled image returned.");
    } catch (e) {
      setMsg(`Error: ${e?.message || String(e)}`);
    }
    setDerivations((d) => d.filter((x) => x.id !== id));
    setBusy(false);
  };

  // --- Convert format (expo-image-manipulator) → save to Photos (the mobile "download") ---
  const doConvert = async (fmt) => {
    // Guard + serialize like doResize/doUpscale so rapid double-taps can't race manipulateAsync/setMsg.
    if (busy || !Manip) return;
    setConvertOpen(false);
    setBusy(true);
    try {
      const format =
        fmt === "JPEG" ? Manip.SaveFormat.JPEG : fmt === "WEBP" ? Manip.SaveFormat.WEBP : Manip.SaveFormat.PNG;
      const out = await Manip.manipulateAsync(current.uri, [], { compress: 1, format });
      const ok = await saveToPhotos(out.uri);
      setMsg(ok ? `Converted to ${fmt} and saved to Photos ✓` : "Converted (couldn't save to Photos).");
    } catch (e) {
      setMsg(`Error: ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const saveToPhotos = async (uri) => {
    if (!Media) return false;
    try {
      const perm = await Media.requestPermissionsAsync();
      if (!perm.granted) {
        setMsg("Photos permission denied.");
        return false;
      }
      await Media.saveToLibraryAsync(uri || current.uri);
      return true;
    } catch (e) {
      setMsg(`Error: ${e?.message || String(e)}`);
      return false;
    }
  };
  const download = async () => {
    if (await saveToPhotos(current.uri)) setMsg("Saved to Photos ✓");
  };
  const share = async () => {
    if (Sharing && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(current.uri);
    else setMsg("Sharing isn't available here.");
  };
  const del = async () => {
    await deleteImage(current.uri);
    onDeleted?.();
  };

  const rebuildKeywords = async () => {
    setKwErr("");
    if (!rewriteProvider || rewriteProvider === "none") {
      setKwErr("Pick a Text provider in the ⋯ menu to rebuild keywords.");
      return;
    }
    const rprov = getTextProvider(rewriteProvider);
    const key = await getKey(rewriteProvider);
    if (!key) {
      setKwErr(`Add your ${rprov?.label || "Text provider"} key in the ⋯ menu.`);
      return;
    }
    setKwBusy(true);
    try {
      const out = await rprov.rewrite({
        prompt: sentText,
        key,
        system: systemFor("keyword"),
        mode: "keyword",
        settings: { backendUrl },
      });
      const kws = (out.text || "").split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
      if (!kws.length) {
        setKwErr("No keywords came back.");
      } else {
        const meta = await updateImageMeta(current.uri, { keywords: kws });
        if (meta) setCurrent((c) => ({ ...c, keywords: kws }));
        else setKwErr("Couldn't save keywords.");
      }
    } catch (e) {
      setKwErr(`Rebuild failed: ${e?.message || String(e)}`);
    }
    setKwBusy(false);
  };

  // Derived children, split by kind, plus any in-flight placeholders.
  const children = current.children || [];
  const strip = (kind, pendingKind) => {
    const kids = children.filter((c) => (kind === "resize" ? c.kind === "resize" : c.kind === pendingKind));
    const pend = derivations.filter((d) => (kind === "resize" ? d.kind === "resize" : d.kind === pendingKind));
    return { kids, pend };
  };
  const rerolls = strip("reroll", "reroll");
  const variations = strip("variation", "variation");
  const resizes = strip("resize", "resize");

  const imgW = Math.min(width, 900) - 32;

  // --- Small building blocks ---
  const LayerRow = ({ label, value, mono, accent, actions }) => {
    if (!value) return null;
    return (
      <View style={[styles.layerRow, accent && styles.layerRowAccent]}>
        <View style={styles.layerHead}>
          <Text style={styles.layerLabel}>{label}</Text>
          <View style={styles.layerActs}>
            {(actions || []).map((a) => (
              <TouchableOpacity key={a.key} onPress={a.onPress} disabled={a.disabled}>
                <Text style={[styles.layerAct, a.disabled && styles.layerActOff]}>
                  {a.label}
                  {a.disabled ? " 🔒" : ""}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => copyText(value)}>
              <Text style={styles.layerAct}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.layerVal, mono && styles.mono]} selectable>
          {value}
        </Text>
      </View>
    );
  };

  const DerivedStrip = ({ title, kids, pend, tint }) => {
    if (!kids.length && !pend.length) return null;
    return (
      <View style={styles.stripWrap}>
        <Text style={styles.stripTitle}>{title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripRow}>
          {kids.map((c) => (
            <TouchableOpacity
              key={c.uri}
              onPress={() => go(feed.find((it) => it.uri === c.uri))}
              activeOpacity={0.85}
            >
              <Image
                source={c.uri}
                style={[styles.stripThumb, { borderColor: tint }]}
                contentFit="cover"
                cachePolicy="disk"
                transition={100}
              />
            </TouchableOpacity>
          ))}
          {pend.map((d) => (
            <View key={d.id} style={[styles.stripThumb, styles.stripPending, { borderColor: tint }]}>
              <Text style={styles.stripDots}>…</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {/* Nav bar: Back + Prev / position / Next */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navBtn} onPress={onBack}>
          <Text style={styles.navBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.navRight}>
          <TouchableOpacity style={[styles.navBtn, !hasPrev && styles.navBtnOff]} onPress={() => go(feed[index - 1])} disabled={!hasPrev}>
            <Text style={styles.navBtnText}>‹ Prev</Text>
          </TouchableOpacity>
          {index >= 0 && (
            <Text style={styles.navPos}>
              {index + 1} / {total}
            </Text>
          )}
          <TouchableOpacity style={[styles.navBtn, !hasNext && styles.navBtnOff]} onPress={() => go(feed[index + 1])} disabled={!hasNext}>
            <Text style={styles.navBtnText}>Next ›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Image + overlay actions */}
      <View style={styles.imgWrap}>
        <TouchableOpacity activeOpacity={0.95} onPress={() => setViewerOpen(true)}>
          <Image
            source={current.uri}
            style={{ width: imgW, height: imgW, borderRadius: T.radius, backgroundColor: T.panel }}
            contentFit="contain"
            cachePolicy="disk"
            transition={120}
          />
        </TouchableOpacity>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.ovBtn} onPress={() => setViewerOpen(true)}>
            <Text style={styles.ovIcon}>⤢</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ovBtn} onPress={share}>
            <Text style={styles.ovIcon}>⤴</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ovBtn} onPress={download}>
            <Text style={styles.ovIcon}>⤓</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ovBtn, styles.ovDel]} onPress={del}>
            <Text style={styles.ovIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tools: Convert · Resize/Upscale */}
      <View style={styles.toolRow}>
        <TouchableOpacity style={styles.toolBtn} onPress={() => setConvertOpen((o) => !o)}>
          <Text style={styles.toolBtnText}>Convert ▾</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => setResizeOpen((o) => !o)}>
          <Text style={styles.toolBtnText}>Resize / Upscale ▾</Text>
        </TouchableOpacity>
      </View>
      {convertOpen && (
        <View style={styles.pickRow}>
          {FORMATS.map((f) => (
            <TouchableOpacity key={f} style={styles.pickChip} onPress={() => doConvert(f)}>
              <Text style={styles.pickChipText}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {resizeOpen && (
        <View>
          <Text style={styles.pickGroup}>Resize (on-device)</Text>
          <View style={styles.pickRow}>
            {RESIZE_SCALES.map((sc) => (
              <TouchableOpacity key={sc} style={styles.pickChip} onPress={() => doResize(sc)}>
                <Text style={styles.pickChipText}>{FRAC[sc] || `${sc}×`}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.pickGroup}>AI Upscale</Text>
          <View style={styles.pickRow}>
            {upscalers.map((u) => (
              <TouchableOpacity key={u.id} style={styles.pickChip} onPress={() => doUpscale(u.id)}>
                <Text style={styles.pickChipText}>{u.label.split(" (")[0]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      {msg ? <Text style={[styles.msg, msg.startsWith("Error") && styles.msgErr]}>{msg}</Text> : null}

      {/* Derived-children strips (with in-flight placeholders) */}
      <DerivedStrip title="Re-rolls" kids={rerolls.kids} pend={rerolls.pend} tint={T.accent} />
      <DerivedStrip title="Variations" kids={variations.kids} pend={variations.pend} tint={T.accentStrong} />
      <DerivedStrip title="Resizes" kids={resizes.kids} pend={resizes.pend} tint={T.border} />

      {/* Lineage header */}
      {(current.parent || children.length > 0) && (
        <View style={styles.lineage}>
          <Text style={styles.lineageType}>
            {current.derivedKind === "reroll"
              ? "Re-roll"
              : current.derivedKind === "resize"
                ? "Resize"
                : current.derivedKind === "variation"
                  ? "Variation"
                  : "Base image"}
            {current.parent && current.derivedSource && current.derivedKind !== "resize"
              ? ` from ${LAYER_LABEL[current.derivedSource] || current.derivedSource}`
              : ""}
          </Text>
          {current.parent && (
            <TouchableOpacity onPress={() => go(feed.find((it) => it.name === current.parent))}>
              <Text style={styles.lineageParent}>↑ Parent</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {deriveErr ? <Text style={styles.cardErr}>{deriveErr}</Text> : null}
      {!hasMeta && (
        <Text style={styles.note}>
          No metadata was saved for this image — it may pre-date the richer sidecar.
        </Text>
      )}

      {/* Prompt card — layers, most-relevant first, with inline re-roll / make-variation */}
      {(p.final || p.ai || p.roll || p.dpl) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Prompt</Text>
          <LayerRow
            label="Sent to model"
            value={p.final}
            accent
            actions={
              canGenerate
                ? [
                    {
                      key: "vary-final",
                      label: "Make variation",
                      disabled: busy || !hasSource("final"),
                      onPress: () => runDerive("variation", "final"),
                    },
                  ]
                : []
            }
          />
          {p.ai && p.ai !== p.final && (
            <LayerRow
              label="AI translation"
              value={p.ai}
              actions={
                canGenerate
                  ? [
                      {
                        key: "vary-ai",
                        label: "Make variation",
                        disabled: busy || !hasSource("ai"),
                        onPress: () => runDerive("variation", "ai"),
                      },
                    ]
                  : []
              }
            />
          )}
          {p.roll && p.roll !== p.final && <LayerRow label="Engine roll" value={p.roll} />}
          <LayerRow
            label="DPL source"
            value={p.dpl}
            mono
            actions={
              canGenerate
                ? [
                    {
                      key: "reroll-dpl",
                      label: "Re-roll",
                      disabled: busy || !hasSource("dpl"),
                      onPress: () => runDerive("reroll", "dpl"),
                    },
                  ]
                : []
            }
          />
        </View>
      )}

      {/* Negative card */}
      {(n.final || n.ai || n.roll || n.dpl) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Negative</Text>
          <LayerRow label="Sent to model" value={n.final} accent />
          {n.ai && n.ai !== n.final && <LayerRow label="AI translation" value={n.ai} />}
          {n.roll && n.roll !== n.final && <LayerRow label="Engine roll" value={n.roll} />}
          <LayerRow label="DPL source" value={n.dpl} mono />
        </View>
      )}

      {/* Details table / raw JSON, with copy menu */}
      {(hasMeta || detailRows.length > 0) && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Details</Text>
            <View style={styles.cardActs}>
              <TouchableOpacity onPress={() => setRawView((v) => !v)}>
                <Text style={[styles.cardAct, rawView && styles.cardActOn]}>{rawView ? "Table" : "Raw JSON"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCopyOpen((o) => !o)}>
                <Text style={[styles.cardAct, copyOpen && styles.cardActOn]}>Copy ⋯</Text>
              </TouchableOpacity>
            </View>
          </View>
          {copyOpen && (
            <View style={styles.copyRow}>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => {
                  copyText(markdown);
                  setCopyOpen(false);
                  setMsg("Markdown copied ✓");
                }}
              >
                <Text style={styles.copyBtnText}>Copy Markdown</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => {
                  copyText(rawJson);
                  setCopyOpen(false);
                  setMsg("JSON copied ✓");
                }}
              >
                <Text style={styles.copyBtnText}>Copy JSON</Text>
              </TouchableOpacity>
            </View>
          )}
          {rawView ? (
            <Text style={[styles.layerVal, styles.mono]} selectable>
              {rawJson}
            </Text>
          ) : (
            <>
              <View style={styles.table}>
                {detailRows.map(([k, v]) => (
                  <View style={styles.detailRow} key={k}>
                    <Text style={styles.detailKey}>{k}</Text>
                    <Text style={styles.detailVal} selectable>
                      {String(v)}
                    </Text>
                  </View>
                ))}
              </View>
              {restSettings.length > 0 && (
                <>
                  <TouchableOpacity onPress={() => setShowAllSettings((s) => !s)}>
                    <Text style={styles.allSettings}>
                      {showAllSettings ? "▾" : "▸"} All settings ({restSettings.length})
                    </Text>
                  </TouchableOpacity>
                  {showAllSettings && (
                    <View style={styles.table}>
                      {restSettings.map(([k, v]) => (
                        <View style={styles.detailRow} key={k}>
                          <Text style={styles.detailKey}>{k}</Text>
                          <Text style={styles.detailVal} selectable>
                            {String(v)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </View>
      )}

      {/* Keyword cloud */}
      {(tags.length > 1 || !!sentText.trim()) && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{savedKeywords ? "Keywords (edited)" : "Keywords"}</Text>
            <TouchableOpacity onPress={rebuildKeywords} disabled={kwBusy}>
              <Text style={[styles.cardAct, kwBusy && styles.cardActOff]}>
                {kwBusy ? "Rebuilding…" : "Rebuild with AI"}
              </Text>
            </TouchableOpacity>
          </View>
          {kwErr ? <Text style={styles.cardErr}>{kwErr}</Text> : null}
          <View style={styles.cloud}>
            {tags.map((t, i) => (
              <TouchableOpacity key={`${t}-${i}`} style={styles.chip} onPress={() => onSearch?.(t)}>
                <Text style={styles.chipText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Full-screen viewer */}
      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <TouchableOpacity style={styles.viewer} activeOpacity={1} onPress={() => setViewerOpen(false)}>
          <Image source={current.uri} style={styles.viewerImg} contentFit="contain" cachePolicy="disk" />
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

// A clean metadata object for the raw-JSON view / Copy JSON (drops the derived UI-only fields).
function rawMeta(item) {
  const { uri, children, ...meta } = item || {};
  return meta;
}

const makeStyles = (T) =>
  StyleSheet.create({
    scroll: { padding: 16, paddingBottom: 40 },

    navbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    navRight: { flexDirection: "row", alignItems: "center", gap: 10 },
    navBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.input,
    },
    navBtnOff: { opacity: 0.4 },
    navBtnText: { color: T.fgSoft, fontSize: 13, fontWeight: "700" },
    navPos: { color: T.muted, fontSize: 13, fontWeight: "700" },

    imgWrap: { position: "relative", alignItems: "center" },
    overlay: { position: "absolute", top: 10, right: 10, flexDirection: "row", gap: 6 },
    ovBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    ovDel: { backgroundColor: "rgba(180,30,40,0.7)" },
    ovIcon: { color: "#fff", fontSize: 16, fontWeight: "800" },

    toolRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    toolBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.input,
      alignItems: "center",
    },
    toolBtnText: { color: T.fgSoft, fontSize: 13.5, fontWeight: "700" },
    pickGroup: {
      color: T.muted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginTop: 10,
      marginBottom: 4,
    },
    pickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    pickChip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: T.radiusPill,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.elevated,
    },
    pickChipText: { color: T.fgSoft, fontSize: 13, fontWeight: "700" },

    msg: { color: T.muted, fontSize: 13, textAlign: "center", marginTop: 12 },
    msgErr: { color: T.dangerFg },

    stripWrap: { marginTop: 16 },
    stripTitle: {
      color: T.muted,
      fontSize: 11.5,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    stripRow: { flexDirection: "row", gap: 8 },
    stripThumb: { width: 76, height: 76, borderRadius: T.radiusSm, borderWidth: 2, backgroundColor: T.panel },
    stripPending: { alignItems: "center", justifyContent: "center" },
    stripDots: { color: T.faint, fontSize: 20, fontWeight: "800" },

    lineage: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
    lineageType: { color: T.fgSoft, fontSize: 13.5, fontWeight: "700" },
    lineageParent: { color: T.accent, fontSize: 13.5, fontWeight: "800" },

    note: { color: T.muted, fontSize: 13, lineHeight: 19, marginTop: 14 },
    cardErr: { color: T.dangerFg, fontSize: 13, marginTop: 10 },

    card: {
      backgroundColor: T.elevated,
      borderRadius: T.radius,
      borderWidth: 1,
      borderColor: T.borderSoft,
      padding: 14,
      marginTop: 16,
    },
    cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
    cardActs: { flexDirection: "row", alignItems: "center", gap: 16 },
    cardTitle: { color: T.fg, fontSize: 16, fontWeight: "800" },
    cardAct: { color: T.accent, fontSize: 13, fontWeight: "700" },
    cardActOn: { color: T.accentStrong },
    cardActOff: { opacity: 0.5 },

    layerRow: { marginTop: 10 },
    layerRowAccent: {
      borderLeftWidth: 3,
      borderLeftColor: T.accent,
      paddingLeft: 10,
      marginLeft: -2,
    },
    layerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
    layerLabel: {
      color: T.muted,
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    layerActs: { flexDirection: "row", alignItems: "center", gap: 14 },
    layerAct: { color: T.accent, fontSize: 12.5, fontWeight: "700" },
    layerActOff: { color: T.faint },
    layerVal: { color: T.fgSoft, fontSize: 14.5, lineHeight: 21 },
    mono: { fontFamily: "monospace", fontSize: 13.5 },

    copyRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
    copyBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.input,
      alignItems: "center",
    },
    copyBtnText: { color: T.fgSoft, fontSize: 13, fontWeight: "700" },

    table: { marginTop: 4 },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: T.borderSoft,
    },
    detailKey: { color: T.muted, fontSize: 13.5, fontWeight: "700", flexShrink: 0 },
    detailVal: { color: T.fgSoft, fontSize: 13.5, flexShrink: 1, textAlign: "right" },
    allSettings: { color: T.accent, fontSize: 13, fontWeight: "700", marginTop: 10 },

    cloud: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    chip: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: T.radiusPill,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.panel,
    },
    chipText: { color: T.fgSoft, fontSize: 13, fontWeight: "600" },

    viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)", alignItems: "center", justifyContent: "center" },
    viewerImg: { width: "100%", height: "100%" },

    empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    emptyIcon: { fontSize: 44, marginBottom: 12 },
    emptyTitle: { color: T.fg, fontSize: 18, fontWeight: "700", marginBottom: 8 },
    emptyBody: { color: T.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  });
