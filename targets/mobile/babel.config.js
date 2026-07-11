module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    env: {
      // Jest runs in Node's CommonJS VM, where a native `import()` throws ("A dynamic import
      // callback was invoked without --experimental-vm-modules"). The SHARED provider manifests
      // lazy-load their code + settings with `import()` — that's how Metro code-splits them — so
      // under test those calls must compile down to `require()`. Test env only; the real Metro
      // bundle keeps its dynamic imports.
      test: { plugins: ['dynamic-import-node'] },
    },
  };
};
