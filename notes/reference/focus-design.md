# Reference — DPL focus (the second dial)

**Status: built.** Focus is a per-reference dial that is a **sibling of [intensity](intensity-design.md)**.
Where intensity is *how much* ("a tiny vs massive amount of grass"), **focus is how pure / how narrow** the
render is — how strictly it sticks to the subject versus how much extra, atmospheric, or unrelated detail it
admits to fill the image out.

The guiding line is the same as the rest of [DPL](dpl-design.md): **data, not code.** Focus is one number a
line compares against (`[f<30%]`) or drops into text (`$focus`); the author decides, per line, what counts as
fluff at what focus. There is no automatic "fluff detector" — that is the point (see §3).

---

## 1. The idea — low focus fills the image, high focus keeps only the essential

Think of a `cave` generator. Sorted from "always belongs" to "barely belongs":

- **High focus (strict):** cave walls, stalagmites, stalactites, the cavern itself — the things that *are* a
  cave. These stay at every focus.
- **Mid focus:** an underground pool, bioluminescent glow, a bit of crystal — real extra depth, still cave-y.
- **Low focus:** a distant settlement, a camping site at the entrance, a large body of water, an extra artist
  flourish — fluff / over-the-top / unrelated detail that fills the frame but isn't *the cave*.

So a **city** appearing in a cave scene needs a **very low focus** to ever show up; a camping site a bit
higher; a bigger body of water (more depth) higher still; and the strict cave essentials are always present.
Raising the focus peels the outer rings away until only the subject remains. This is exactly the lever the old
"fluff" keywords needed — and a high-focus generator, being pure, also **stacks as a global layer** more
cleanly (see [`layering-design.md`](layering-design.md)).

---

## 2. Syntax — mirrors intensity with an `f` prefix and a `$focus` keyword

Because intensity and focus are both 1–100 percents and look identical, the dial is **prefixed**: `i` for
intensity, `f` for focus. The prefix is the standard (an unprefixed percent is legacy intensity).

**Token argument** — `{#name fNN%}` (combine with intensity in any order):

```
{#cave f80%}        ; render cave at 80% focus → strict, only the essentials
{#cave f10%}        ; 10% focus → admits distant cities, camp sites, extra depth
{#cave i30% f80%}   ; 30% intensity AND 80% focus
{#cave}             ; no dial → the default, 50%
```

`1–100`; `0` → `1`; `>100` → `100`; unspecified → **50**. Focus does **not** auto-inherit from a parent — a
nested `{#weather}` with no `f` is 50% focus regardless of the parent (pass it down explicitly with
`{#weather f80%}` or a relative `{#weather f+0%}`).

**Line conditions** — `[f<NN%]`, with the full operator set (`<`, `<=`, `>`, `>=`, `=`/`==`, `!=`). A line is
kept only when the condition holds. This is how the author tags each line's fluff threshold:

```
cave, cave walls            ; plain line → always (the essence)
- subterranean interior     ; bullet → a normal 50% optional clause
[f<60%] underground pool    ; only when focus < 60% (real extra depth)
[f<30%] distant settlement  ; only when focus < 30% (fluff)
[f<10%] a nearby city       ; only when focus < 10% (over-the-top)
[f>75%] $focus-word, minimal, only the cave   ; only at very high focus
```

An intensity and a focus condition may sit in one bracket, with a weight, in any order:
`- [100 i<20% f<40%] sparse far detail`. Both conditions must pass to keep the line.

**Keyword tokens** (the `$` sigil keeps them out of `{list}` space):

| Token | Expands to | Example at 50% |
|-------|------------|----------------|
| `$focus` | the **percent** (the dial is inherently a percent) | `50%` |
| `$focus-word` | the **word** (loose → topic-only) | `normal` |

(There is no `$focus%` — the dial is already a percent, so the bare `$focus` carries the `%`.)

`$focus-word` is a **100-step scale — one word per percent** on the *relevance* axis (how much non-topic
detail is allowed), centred on **50 ≈ `normal`**. It runs `anything-goes` / `loose` / `broad` at the low
end, through `related` → `relevant` → `normal` → `on-topic` in the middle, up to `specific` → `exact` →
`strict` → `singular` → `pure` → `topic-only` at the high end. The full list is the `FOCUS_WORDS` array in
`engine/core/dpl/dpl.js`; the clean single-word subset is also the `look/focus` list.

A relative ` ±NN%` modifier works on any focus reference, taken *of the value* (`$focus-word +25%`,
`{#weather f-40%}`), clamped 1–100 — same math as intensity.

---

## 3. Why focus does NOT auto-scale (and intensity does)

Intensity auto-scales the probabilistic machinery (gates × intensity/100, counts × intensity/100), because
"how much" is a uniform magnitude knob. **Focus deliberately does not.** The engine cannot tell, on its own,
that a *city* is fluff in a cave but core in a `city` scene — that judgment is content-specific and needs an
author (a human or an AI like the one maintaining this repo) looking at the topic and description. So focus is
expressed **only** through the explicit `[f<NN%]` conditions the author places per line, plus the `$focus`
keyword. This keeps the mechanism honest (no mystery thinning), data-not-code, and orthogonal to intensity: a
line can be weighted, intensity-conditioned, focus-conditioned, *and* probability-gated all at once.

> If a baseline auto-thinning of bullets by focus is ever wanted, it would be a separate, opt-in engine knob;
> it is intentionally absent today.

---

## 4. Coverage / edge cases

- `{#name}` with no `f`, top-level or nested → **50%** focus.
- `f0%` → **1%**; `f>100%` → **100%**.
- A failed focus condition removes the line deterministically (before any probability gate), and is **not** a
  "failed gate" for an `otherwise` else-branch — same rule as intensity conditions.
- Mixed in one bracket: `[100 i<20% f<40%]` — weight 100, an intensity AND a focus condition.
- JS sidecars receive focus as the **5th** argument:
  `export default (settings, imageSettings, upscaleSettings, intensity, focus) => …`.

## See also

- [`intensity-design.md`](intensity-design.md) — the sibling dial (`i`-prefix, auto-scaling, `$intensity`).
- [`layering-design.md`](layering-design.md) — why pure (high-focus) generators stack cleanly as layers.
- [`dpl-design.md`](dpl-design.md) — the base language.
- `engine/core/dpl/dpl.js` — renderer (`[f<…]` conditions, `$focus` tokens, `ctx.focus`).
- `engine/core/stages/dynamicPrompt.js` — `{#name fNN%}` parsing + threading (focus = 5th generator arg).
