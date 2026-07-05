/**
 * @file
 * GIF frame capture + encoding. A {@link Recorder} snapshots the screen (the full viewport, or a
 * fixed sub-region) on demand while a scenario drives the app, collecting a sequence of PNG frames.
 * {@link encodeGif} then stitches them into an animated GIF whose total run time matches the
 * scenario's requested duration.
 *
 * The encoder keeps FULL-viewport animations small via **inter-frame differencing**: the UI is
 * almost identical frame-to-frame (only a small region changes as text is typed or the cursor
 * moves), so every frame after the first stores ONLY its changed pixels and leaves the rest
 * transparent — revealing the retained previous frame. A shared global palette + a reserved
 * transparent index make this a standard, widely-supported GIF optimization. So a full 1025×768
 * walkthrough compresses to a few hundred KB rather than several MB.
 *
 * Encoding is pure JavaScript (`gifenc` + `pngjs`) — no `ffmpeg` or other native binary — so the
 * same code runs on the Windows dev machine and the Linux Pages runner without a system dependency.
 * @module scripts/screenshots/frames
 */
import { PNG } from "pngjs";
import gifenc from "gifenc";

// gifenc ships as CJS; its functions hang off the default export under Node's ESM interop.
const { GIFEncoder, quantize, applyPalette, nearestColorIndex } = gifenc;

/**
 * Captures uniform frames for a GIF. With a `clipSelector`, the target element's box is resolved and
 * locked on the first frame (every frame is that same rectangle). Without one, the full viewport is
 * captured — which is always a fixed size, so frames stay uniform (a hard requirement for the encoder).
 */
export class Recorder {
  /**
   * @param {import("@playwright/test").Page} page
   * @param {string|null} clipSelector The element to crop to, or null/undefined for the full viewport.
   */
  constructor(page, clipSelector) {
    this.page = page;
    this.clipSelector = clipSelector || null;
    /** @type {{x: number, y: number, width: number, height: number}|null} */
    this.clip = null;
    /** @type {Buffer[]} */
    this.frames = [];
  }

  /** Resolve and lock the crop rectangle once, from the target element's box (no-op for full-frame). */
  async lockClip() {
    if (!this.clipSelector || this.clip) return;
    const box = await this.page.locator(this.clipSelector).boundingBox();
    if (!box) throw new Error(`Recorder: clip target not found: ${this.clipSelector}`);
    this.clip = {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  }

  /** Capture one frame (the locked crop, or the whole viewport). */
  async frame() {
    await this.lockClip();
    this.frames.push(await this.page.screenshot(this.clip ? { clip: this.clip } : {}));
  }

  /**
   * Hold on the most recent frame by repeating it, e.g. to pause on the finished result.
   * @param {number} count How many extra copies to append.
   */
  hold(count) {
    const last = this.frames.at(-1);
    if (!last) return;
    for (let i = 0; i < count; i++) this.frames.push(last);
  }
}

/** Decode a PNG buffer to `{ width, height, data }` where `data` is RGBA bytes. */
function decode(buffer) {
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height, data: png.data };
}

/** Build a shared 255-colour palette by sampling a few spread frames (index 255 is left for transparency). */
function buildPalette(decoded) {
  const picks = [decoded[0]];
  if (decoded.length > 2) picks.push(decoded[Math.floor(decoded.length / 2)]);
  picks.push(decoded.at(-1));
  const total = picks.reduce((n, f) => n + f.data.length, 0);
  const sample = new Uint8Array(total);
  let off = 0;
  for (const f of picks) {
    sample.set(f.data, off);
    off += f.data.length;
  }
  return quantize(sample, 255);
}

/**
 * Build this frame's palette indices. The first frame is mapped in full; every later frame reuses the
 * previous frame's index buffer and only recomputes the pixels that CHANGED (the rest become the
 * transparent index). Since typing/cursor motion changes a small region, this is far cheaper than
 * re-mapping the whole frame each time — the dominant cost of a full-viewport GIF.
 */
function frameIndices(cur, prev, colorPalette, transparentIndex) {
  const px = cur.length >> 2;
  const indices = new Uint8Array(px);
  if (!prev) {
    const full = applyPalette(cur, colorPalette);
    indices.set(full.subarray ? full.subarray(0, px) : full.slice(0, px));
    return indices;
  }
  for (let p = 0, i = 0; i < px; p += 4, i++) {
    if (
      cur[p] === prev[p] &&
      cur[p + 1] === prev[p + 1] &&
      cur[p + 2] === prev[p + 2] &&
      cur[p + 3] === prev[p + 3]
    ) {
      indices[i] = transparentIndex; // unchanged → reveal the retained previous frame
    } else {
      indices[i] = nearestColorIndex(colorPalette, [cur[p], cur[p + 1], cur[p + 2]]);
    }
  }
  return indices;
}

/**
 * Encode a sequence of equal-size PNG frames into an optimized animated GIF of a given duration.
 * @param {Buffer[]} frames The captured PNG frames (all identical dimensions).
 * @param {object} opts
 * @param {number} opts.durationMs Target total run time of the animation.
 * @returns {Buffer} The GIF bytes.
 */
export function encodeGif(frames, { durationMs }) {
  if (!frames.length) throw new Error("encodeGif: no frames captured");
  const decoded = frames.map(decode);
  const { width, height } = decoded[0];
  // GIF frame delays are centiseconds, so round the per-frame delay to the nearest 10ms.
  const delay = Math.max(20, Math.round(durationMs / decoded.length / 10) * 10);

  const colorPalette = buildPalette(decoded);
  const transparentIndex = 255;
  const palette = colorPalette.slice();
  palette[transparentIndex] = [0, 0, 0]; // reserved slot, only ever used for "unchanged"

  const gif = GIFEncoder();
  let prev = null;
  for (let i = 0; i < decoded.length; i++) {
    const { data } = decoded[i];
    const indices = frameIndices(data, prev, colorPalette, transparentIndex);
    gif.writeFrame(indices, width, height, {
      palette,
      delay,
      first: i === 0,
      transparent: i > 0,
      transparentIndex,
      dispose: 1, // keep the frame in place so later transparent frames reveal it
    });
    prev = data;
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}
