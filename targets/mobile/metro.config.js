// Metro config for the Expo mobile target inside the random-ai-prompt monorepo.
// The shared prompt engine lives at the repo root (../../engine), OUTSIDE this package. We resolve it via
// a Metro ALIAS to its REAL path (no copy, no symlink/junction — junctions resolved inconsistently across
// Metro versions). `watchFolders` lets Metro serve the engine's own files; `nodeModulesPaths` keeps
// React Native / Expo resolving from this package and the engine's deps (lodash, compromise) from the
// repo-root node_modules. App code imports the engine as `engine/...` (a bare specifier via the alias).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [repoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(repoRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  engine: path.resolve(repoRoot, 'engine'),
  // The cross-target app layer (provider adapters + transport). Aliased exactly like `engine` so the
  // mobile app IMPORTS the one shared implementation instead of hand-porting it (which is what forced
  // the old drift-detecting parity checks). App code imports it as `shared/...`.
  shared: path.resolve(repoRoot, 'targets/shared'),
};

module.exports = config;