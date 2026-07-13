/**
 * @file Regression: the backend's "open / reveal this image" actions were a COMMAND-INJECTION sink.
 *
 * Symptom (CodeQL `js/command-line-injection`, **critical**): the handlers built a shell string —
 *
 * ```js
 * exec(`cmd /c start "" "${fp}"`);
 * exec(`explorer /select,"${fp}"`);
 * ```
 *
 * — where `fp` is a path derived from a request. `resolveOutputFile()` blocks path traversal and
 * nothing else, so a file in the output folder named `x" & calc & ".png` closes the quote and the rest
 * runs as a command. The ImageMagick convert/resize paths had the same shape.
 *
 * The fix is structural, not cosmetic: **no shell**. `execFile(cmd, args)` hands argv straight to the
 * OS, so a quote inside a filename is data. These tests lock that in by asserting on the *shape* of
 * what would be executed — the filename must survive intact inside ONE argv entry, and nothing may ever
 * be concatenated into a command string.
 *
 * Proven against the old code: with the `exec(...)` version, the payload below was a separate command.
 */
import { describe, it, expect } from "vitest";
import { openFileCommand, revealFileCommand } from "../../targets/web/backend/osCommands.js";
import { mergeSidecar } from "../../targets/web/backend/manageFs.js";

/** A filename that is legal on disk and lethal in a shell. */
const EVIL = 'C:\\output\\x" & calc & ".png';

describe("regression: image open/reveal must never build a shell command", () => {
  it("passes the whole path as ONE argv entry on Windows (open)", () => {
    const { cmd, args } = openFileCommand(EVIL, "win32");
    expect(cmd).toBe("explorer.exe");
    expect(args).toEqual([EVIL]); // intact, single argument — not spliced into a command line
    expect(args).toHaveLength(1);
  });

  it("passes the whole path as ONE argv entry on Windows (reveal)", () => {
    const { cmd, args } = revealFileCommand(EVIL, "win32");
    expect(cmd).toBe("explorer.exe");
    // Explorer's quirk: `/select,<path>` is one argument. The comma is part of the switch, and the
    // payload rides inside the same entry — inert, because no shell ever sees it.
    expect(args).toEqual([`/select,${EVIL}`]);
    expect(args).toHaveLength(1);
  });

  it("never invokes a shell interpreter (no cmd /c, no sh -c)", () => {
    for (const platform of ["win32", "darwin", "linux"]) {
      for (const build of [openFileCommand, revealFileCommand]) {
        const { cmd, args } = build(EVIL, platform);
        // The old code ran `cmd /c start …`. `cmd` re-parses its arguments, which is its own quoting
        // horror (CVE-2024-27980) — so the fix must not reach for it either.
        expect(cmd).not.toMatch(/^(cmd(\.exe)?|sh|bash|powershell)$/i);
        expect(args.some((a) => a === "/c" || a === "-c")).toBe(false);
        // And nothing may be a *command line*: no argument may contain the shell operators that made
        // the original exploitable, EXCEPT as part of the untouched filename itself.
        for (const a of args) {
          if (a.includes(EVIL) || EVIL.includes(a)) continue; // the path, carried verbatim — fine
          expect(a).not.toMatch(/[&|;`$]/);
        }
      }
    }
  });

  it("regression: a sidecar patch cannot pollute Object.prototype", () => {
    // Symptom (CodeQL js/remote-property-injection, high): `mergeSidecar` merged a REQUEST-supplied
    // patch key-by-key into a plain object, so `{"__proto__": {"pwned": true}}` set the prototype and
    // every object in the process grew a `pwned` property. The path below is rejected before any write,
    // so this asserts the *merge* is safe regardless of where it's called from.
    mergeSidecar("lists", "../../../etc/passwd", { __proto__: { pwned: true } });
    mergeSidecar("nope", "x", { constructor: { pwned: true }, prototype: { pwned: true } });
    expect({}.pwned).toBeUndefined();
    expect(Object.prototype.pwned).toBeUndefined();
  });

  it("uses the platform's own opener, not a shell, everywhere", () => {
    expect(openFileCommand("/tmp/a.png", "darwin")).toEqual({ cmd: "open", args: ["/tmp/a.png"] });
    expect(openFileCommand("/tmp/a.png", "linux")).toEqual({
      cmd: "xdg-open",
      args: ["/tmp/a.png"],
    });
    expect(revealFileCommand("/tmp/a.png", "darwin")).toEqual({
      cmd: "open",
      args: ["-R", "/tmp/a.png"],
    });
    // Linux has no universal "reveal" — open the containing folder, which is what desktops do.
    expect(revealFileCommand("/tmp/sub/a.png", "linux").args[0]).toBe("/tmp/sub");
  });
});
