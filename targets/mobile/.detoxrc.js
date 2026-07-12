/**
 * @file Detox configuration — the ON-DEVICE test harness for the Android app.
 *
 * This exists because of a gap the react-native-web proxy suite could not close, and was honest
 * about (see `tests/e2e-mobile/perf.spec.js`): the app's headline promise — **1000 prompts in one
 * roll with no performance loss** — is a claim about a *phone*, and the proxy runs `@shopify/flash-list`'s
 * WEB renderer, which does not recycle like the native one. Measuring it there measures
 * react-native-web. So the promise is verified where it is actually made: on a real Android runtime,
 * against real frame timings the device reports itself (`dumpsys gfxinfo`).
 *
 * The native project (`android/`) is NOT committed — Expo CNG regenerates it from `app.json`
 * (`npm run prebuild:android`), so nothing here is a hand-edited native file that can silently rot.
 *
 * Run it (Windows/local):
 *   npm --prefix targets/mobile run prebuild:android   # once (or after a native config change)
 *   npm --prefix targets/mobile run e2e:build          # gradle: app + androidTest APKs (RELEASE)
 *   npm --prefix targets/mobile run e2e                # boots the AVD and runs the specs
 *
 * RELEASE, not debug, on purpose: a debug build runs JS through the dev bundle with dev-mode React
 * checks on, so its numbers are pessimistic fiction. The perf claim is about what a user runs.
 */
const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";

// Emulators are x86_64 and phones are arm64 — building the other two ABIs packages megabytes of
// native libs nothing here will ever load. Overridable (`RN_ABIS`) for a real-device run on older hw.
const abis = process.env.RN_ABIS || "x86_64,arm64-v8a";

// Optional escape hatch: build against an NDK that's already on the machine rather than letting AGP
// download the exact pinned one (~700 MB — a multi-hour stall on a home line, and the app compiles no
// C++ of its own). Set ANDROID_NDK_VERSION to an installed version; unset, this is a no-op and CI keeps
// the pinned NDK. See gradle/ndk-override.init.gradle.
const ndkInit = process.env.ANDROID_NDK_VERSION
  ? " --init-script ../gradle/ndk-override.init.gradle"
  : "";

/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: "jest",
      config: "e2e/jest.config.js",
    },
    jest: {
      setupTimeout: 300000,
    },
  },
  apps: {
    "android.release": {
      type: "android.apk",
      binaryPath: "android/app/build/outputs/apk/release/app-release.apk",
      testBinaryPath:
        "android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk",
      // `:app:` scoped ON PURPOSE. The unscoped `assembleAndroidTest` builds an androidTest variant for
      // EVERY module in the graph — every Expo library, in DEBUG, none of which this suite ever runs. It
      // is pure waste, and it is not harmless: a CI run died in `:expo-constants:packageDebugAndroidTest`,
      // a task whose output nothing consumes. Build the two artifacts Detox actually installs.
      build: `cd android && ${gradle} :app:assembleRelease :app:assembleAndroidTest -DtestBuildType=release -PreactNativeArchitectures=${abis}${ndkInit}`,
    },
    "android.debug": {
      type: "android.apk",
      binaryPath: "android/app/build/outputs/apk/debug/app-debug.apk",
      testBinaryPath: "android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk",
      build: `cd android && ${gradle} :app:assembleDebug :app:assembleAndroidTest -DtestBuildType=debug -PreactNativeArchitectures=${abis}${ndkInit}`,
      reversePorts: [8081],
    },
  },
  devices: {
    // The local AVD (created for the 2026-07-09 emulator work). CI creates its own with the same
    // name via reactivecircus/android-emulator-runner.
    emulator: {
      type: "android.emulator",
      device: { avdName: process.env.DETOX_AVD_NAME || "rap_phone" },
      // The AVD has no host GPU on this box (see notes/version/2026-07.md) — swiftshader boots it.
      gpuMode: process.env.DETOX_GPU || "swiftshader_indirect",
      headless: process.env.DETOX_HEADLESS === "true",
    },
    // A real phone over adb — the highest-fidelity run there is.
    attached: {
      type: "android.attached",
      device: { adbName: process.env.DETOX_ADB_NAME || ".*" },
    },
  },
  configurations: {
    "android.emu.release": { device: "emulator", app: "android.release" },
    "android.emu.debug": { device: "emulator", app: "android.debug" },
    "android.att.release": { device: "attached", app: "android.release" },
  },
};
