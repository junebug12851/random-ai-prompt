// Side-effect module: make every relative path in the app resolve from the
// project root, no matter where `node` was launched from. This MUST be imported
// before any module that reads cwd-relative files (settings loading, output
// folder, lists, etc.). With ES modules, importing this first guarantees the
// chdir runs before those modules evaluate.
process.chdir(import.meta.dirname);
