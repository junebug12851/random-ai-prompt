// Metro config for the Expo mobile target. The prompt engine is linked in-project at ./engine (a
// junction to ../../engine, created by `npm run link:engine`) so all resolution stays inside the
// project root and the engine's deps (lodash, compromise) are installed locally. No monorepo watch
// hacks needed. See notes/systems for the mobile target.
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);