/**
 * @file The OS "open this file" / "show this file in the file manager" commands — as **argv arrays**,
 * never shell strings.
 *
 * ## Why this file exists
 *
 * The backend used to do this:
 *
 * ```js
 * exec(`cmd /c start "" "${fp}"`);        // open in the default program
 * exec(`explorer /select,"${fp}"`);       // reveal in Explorer
 * ```
 *
 * `fp` comes from `resolveOutputFile()`, which stops **path traversal** (no `/`, `\`, `..`) — and stops
 * nothing else. A file in the output folder named `x" & calc & ".png` closes the quote and runs whatever
 * follows: `/api/image/open` becomes arbitrary command execution (CodeQL `js/command-line-injection`,
 * **critical**). "It's a local-only backend" is mitigation, not absolution — it is one `--host` flag away
 * from being on a LAN, and the file that carries the payload can arrive from anywhere the gallery writes.
 *
 * The fix is not a better escape function; escaping is a losing game played on the attacker's board.
 * The fix is **no shell**: build the program and its arguments separately and hand them to `execFile`,
 * which passes argv straight to the OS. A quote in a filename is then just a quote in a filename.
 *
 * These builders are pure so the invariant is *testable* — see `tests/regression/bugRegressions.test.js`,
 * which asserts a malicious filename lands intact in a single argv entry and never in a command string.
 * @module gui/server/osCommands
 */
import path from "node:path";

/**
 * The command that opens a file with the OS default program.
 * @param {string} file Absolute path to the file.
 * @param {string} [platform] `process.platform` (injectable for tests).
 * @returns {{cmd: string, args: string[]}} Program + argv. No shell, ever.
 */
export function openFileCommand(file, platform = process.platform) {
  if (platform === "win32") {
    // `explorer.exe <file>` launches the file's default handler — same effect as `cmd /c start`, with
    // no shell and no `cmd` re-parsing (which has its own quoting horrors — see CVE-2024-27980).
    return { cmd: "explorer.exe", args: [file] };
  }
  if (platform === "darwin") return { cmd: "open", args: [file] };
  return { cmd: "xdg-open", args: [file] };
}

/**
 * The command that reveals a file in the OS file manager (selected, not opened).
 * @param {string} file Absolute path to the file.
 * @param {string} [platform] `process.platform` (injectable for tests).
 * @returns {{cmd: string, args: string[]}} Program + argv.
 */
export function revealFileCommand(file, platform = process.platform) {
  // Explorer wants `/select,<path>` as ONE argument — a genuine quirk, not a shell string: the comma is
  // part of the switch. Passed as a single argv entry it stays inert.
  if (platform === "win32") return { cmd: "explorer.exe", args: [`/select,${file}`] };
  if (platform === "darwin") return { cmd: "open", args: ["-R", file] };
  // Linux has no universal "reveal": open the containing folder, which is what every desktop does.
  return { cmd: "xdg-open", args: [path.dirname(file)] };
}
