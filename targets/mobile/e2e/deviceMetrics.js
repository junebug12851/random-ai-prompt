/**
 * @file Real device metrics, read from the device itself (`adb shell dumpsys`).
 *
 * Detox can drive the app but it cannot tell you whether the phone *stuttered*. Android can: the
 * framework already counts every frame it renders and every one it misses (`gfxinfo`), and reports
 * the process's real memory (`meminfo`). Those are the only numbers that can honestly settle "does
 * the app stay smooth at 1000 prompts" — everything else is a stopwatch around a promise.
 *
 * Nothing here is instrumentation we add to the app: it's the platform's own accounting, so it can't
 * be gamed by the test.
 */
const { execFileSync } = require("child_process");
const path = require("path");

/** The app under test (must match `expo.android.package` in app.json). */
const PACKAGE = "io.fairyfox.randomaiprompt";

/** `adb` isn't on PATH on a stock Windows Android-Studio install — resolve it from the SDK. */
function adbPath() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk) return "adb";
  return path.join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
}

function adb(args, deviceId) {
  const full = deviceId ? ["-s", deviceId, ...args] : args;
  return execFileSync(adbPath(), full, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

/** Zero the frame counters, so a measurement covers exactly the interaction under test. */
function resetFrameStats(deviceId) {
  adb(["shell", "dumpsys", "gfxinfo", PACKAGE, "reset"], deviceId);
}

/**
 * Read the frame stats Android accumulated since the last reset.
 *
 * `jankPercent` is the headline: the share of frames that missed their deadline. A de-virtualized
 * list (every row mounted) shows up here as a wall of janky frames and a 90th percentile in the
 * hundreds of ms — the exact regression the proxy suite could not see.
 *
 * @returns {{total:number, janky:number, jankPercent:number, p50:number, p90:number, p95:number, p99:number}}
 */
function readFrameStats(deviceId) {
  const out = adb(["shell", "dumpsys", "gfxinfo", PACKAGE], deviceId);
  const num = (re) => {
    const m = out.match(re);
    return m ? Number(m[1]) : NaN;
  };
  const total = num(/Total frames rendered:\s*(\d+)/);
  const janky = num(/Janky frames:\s*(\d+)/);
  const jankPercent = num(/Janky frames:\s*\d+\s*\(([\d.]+)%\)/);
  return {
    total,
    janky,
    jankPercent,
    p50: num(/50th percentile:\s*(\d+)ms/),
    p90: num(/90th percentile:\s*(\d+)ms/),
    p95: num(/95th percentile:\s*(\d+)ms/),
    p99: num(/99th percentile:\s*(\d+)ms/),
  };
}

/**
 * Total PSS of the app process, in MB — the memory the phone actually gave it.
 *
 * The point isn't a byte budget; it's the shape. Holding 1000 rendered rows costs an order of
 * magnitude more than holding a recycled window of ~15, so this catches "we stopped virtualizing"
 * even if the emulator is fast enough to hide the jank.
 */
function readMemoryMb(deviceId) {
  const out = adb(["shell", "dumpsys", "meminfo", PACKAGE], deviceId);
  const m = out.match(/TOTAL(?: PSS)?:?\s+(\d+)/);
  return m ? Number(m[1]) / 1024 : NaN;
}

module.exports = { PACKAGE, adb, resetFrameStats, readFrameStats, readMemoryMb };
