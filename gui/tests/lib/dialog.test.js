/**
 * @file Unit tests for gui/src/lib/dialog.js — the Promise-based dialog store (no React). Verifies
 * the queue, the subscribe/snapshot seam, and that `settle` resolves the pending promise with the
 * native-mirroring contract (confirm → boolean, prompt → string|null, alert → undefined).
 */
import { describe, it, expect, afterEach } from "vitest";
import { dialog, subscribe, getSnapshot, settle } from "../../src/lib/dialog.js";

// Drain anything a test left pending so the module-global queue can't leak across tests.
afterEach(() => {
  for (const d of getSnapshot()) settle(d.id, undefined);
});

describe("dialog store", () => {
  it("enqueues a request and exposes it via the snapshot", () => {
    const p = dialog.confirm({ message: "Sure?" });
    const q = getSnapshot();
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ kind: "confirm", message: "Sure?" });
    settle(q[0].id, true);
    return expect(p).resolves.toBe(true);
  });

  it("normalizes a bare string into { message }", () => {
    dialog.alert("Heads up");
    expect(getSnapshot()[0]).toMatchObject({ kind: "alert", message: "Heads up" });
  });

  it("settle removes the dialog and resolves its promise", async () => {
    const p = dialog.prompt({ message: "Name?", defaultValue: "x" });
    const { id } = getSnapshot()[0];
    settle(id, "typed");
    await expect(p).resolves.toBe("typed");
    expect(getSnapshot()).toHaveLength(0);
  });

  it("notifies subscribers on enqueue and settle", () => {
    let hits = 0;
    const unsub = subscribe(() => (hits += 1));
    const p = dialog.confirm("x");
    const { id } = getSnapshot()[0];
    settle(id, false);
    unsub();
    expect(hits).toBe(2); // one enqueue, one settle
    return expect(p).resolves.toBe(false);
  });

  it("queues multiple requests FIFO", () => {
    const a = dialog.confirm("first");
    const b = dialog.confirm("second");
    const q = getSnapshot();
    expect(q.map((d) => d.message)).toEqual(["first", "second"]);
    settle(q[0].id, true);
    settle(q[1].id, false);
    return Promise.all([expect(a).resolves.toBe(true), expect(b).resolves.toBe(false)]);
  });

  it("settle on an unknown id is a no-op", () => {
    expect(() => settle(999999, true)).not.toThrow();
  });
});
