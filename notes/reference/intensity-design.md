# Reference — DPL intensity (the dial)

**Status: built.** Intensity is a per-reference "how much" dial that flows into a generator and changes
what it renders. It adds three things to [DPL](dpl-design.md): an **argument on the `{#name}` token**,
**intensity conditions** on lines (next to weights), and a **natural-language keyword** the prompt text
can interpolate. The engine also **auto-scales** probability gates and counts by intensity.

> **Two dials now.** Intensity has a sibling, **focus** (see [`focus-design.md`](focus-design.md)). Because
> the two percents look identical, the dial carries a **mandatory** **`i`** (intensity) or **`f`** (focus)
> prefix: `{#name i25% f80%}`, `[i<10%]`, `[f<40%]`. The prefix is **required** — an unprefixed `25%` / `<10%`
> is not dial syntax (a bare `[10]` is still a weight). The keyword tokens also moved off the `{…}` braces
> (which mean `{list}`) to a **`$` sigil**, and since the dial *is* a percent, `$intensity` renders `50%`
> (there is no separate `%` form) — see §4.

The guiding line is unchanged: DPL stays *data, not code*. Intensity is one number the author compares
against (`[<10%]`) or drops into text (`{intensity}`); the engine does the scaling. No variables, no state.

---

## 1. The token argument — `{#name NN%}`

A `{#name}` reference may carry an `i`-prefixed intensity percent (and/or an `f`-prefixed focus percent):

```
{#great-bridge i25%}       ; render great-bridge at 25% intensity
{#weather i80%}            ; weather at 80% intensity
{#beach i25% f80%}         ; 25% intensity AND 80% focus (order-free)
{#weather 80%}             ; NOT dial syntax — the prefix is required (left literal)
{#knight}                  ; no percent → the default, 50%
```

- The percent is **1–100**. `0%` is treated as **1%** (never zero). Values above 100 clamp to 100.
- **Default when unspecified: 50%.** A bare `{#name}` — at the top level *or* nested inside another
  generator — runs at 50%. (Intensity does **not** auto-inherit from a parent; a nested `{#weather}` with
  no percent is 50%, regardless of the parent's dial. To pass a parent's level down, write it explicitly,
  e.g. `{#weather 80%}`.) The default lives in one constant (`DEFAULT_INTENSITY`) so it is trivial to retune.
- The percent is parsed in the `{#…}` resolver (`engine/core/stages/dynamicPrompt.js`) and handed to the
  generator as the **4th argument**:
  `mod.default(settings, imageSettings, upscaleSettings, intensity, focus)` (focus is the 5th). Compiled
  `.dpl` files expose them as `ctx.intensity` / `ctx.focus`; `.js` sidecars read the 4th / 5th parameter.

---

## 2. Intensity conditions on a line — `[<10%]`, `[100|<10%]`

A line/bullet can carry an **intensity condition** in the same square-bracket slot as a weight. The line is
rendered only when the condition holds against the current intensity:

```
[i<10%] - grass             ; only when intensity < 10%
- [i>50%] dense undergrowth ; only when intensity > 50%
- [i=50%] a balanced scene  ; only at exactly 50%
```

(An `f`-prefixed condition — `[f<40%]` — reads the **focus** dial instead; see
[`focus-design.md`](focus-design.md). An unprefixed `[<10%]` is **not** a condition and is left as
payload text — the prefix is required.)

**Operators:** `<`, `<=`, `>`, `>=`, `=` (also `==`), `!=`. The value is a percent (`10%`, `12.5%`).

**Stacking weight and condition** — inside one bracket, separated by a pipe **or a space** (the space
reads more naturally), either order:

```
- [100 i<10%] sparse detail        ; weight 100 AND only when intensity < 10%
- [i<10% 100] sparse detail         ; identical (either order)
- [100 i<10% f>40%] sparse detail   ; weight + an intensity AND a focus condition
```

The bracket may sit **before or after** the bullet dash (`[<10%] - grass` and `- [<10%] grass` both work).
A condition is a **hard** include/exclude evaluated *before* any probability roll — it is deterministic, not
a gate. A bracket whose contents are not a valid weight/condition spec (e.g. `[[castle]]`, `[deemph]`,
`[a:b:0.5]`, the salt literal) is left untouched as payload, exactly as before.

---

## 3. Auto-scaling (the engine's part)

On top of the explicit conditions, intensity **scales the probabilistic machinery** so one dial thins or
thickens a whole generator:

- **Gates** — every probability gate is multiplied by `intensity/100`. A `50%` bullet at `40%` intensity
  rolls `20%`; a default `-` bullet (50%) at the default 50% intensity rolls 25%. At `100%` intensity gates
  fire exactly as authored. *Not scaled:* plain (always-on) lines, and the `otherwise` else-branch (it still
  runs whenever its paired gate failed). An explicit `otherwise NN% chance:` **is** scaled (it is a real
  probability).
- **Counts** — `repeat N times`, `repeat A to B times`, `one of`, and `N of` scale their counts by
  `round(count × intensity/100)`. `repeat 3 times` → 2 copies at 50%, 3 at 100%. `one of` survives at the
  default (round(1×0.5)=1) but can resolve to **nothing** at low intensity (round(1×0.3)=0) — intended:
  low intensity means less of everything. Counts never go negative or exceed the option pool.

Auto-scaling is **multiplicative with the conditions and weights**, not a replacement: a line can be
weighted, conditioned, *and* scaled at once.

> **Note on the default.** Because the default intensity is 50% and gates auto-scale, an un-dialed
> generator renders lighter than a hypothetical "100% = as-authored" default would. This is deliberate
> (50% = a neutral middle the author can dial up or down). If a different feel is wanted, retune
> `DEFAULT_INTENSITY`.

---

## 4. The keyword tokens — `$intensity` (note the `$` sigil)

So the *text* can react too (not just the structure), intensity is interpolable inline in any `.dpl`
payload. The tokens use a **`$` sigil** (not `{…}`, which means `{list}`):

| Token | Expands to | Example at 50% |
|-------|------------|----------------|
| `$intensity` | the **percent** (the dial is inherently a percent) | `50%` |
| `$intensity-word` | the magnitude **word** | `normal` |

(There is no `$intensity%` — the dial is already a percent, so the bare `$intensity` carries the `%`.)

```
$intensity-word amount of grass    ; "normal amount of grass" at 50%, "ultra-tiny" at 20%, "immense" at 85
a $intensity-word cluster of clouds
detail level $intensity            ; "detail level 50%"
```

The matching `$focus`, `$focus-word` tokens read the focus dial (see
[`focus-design.md`](focus-design.md)).

**The word scale.** `$intensity-word` is a **100-step scale — one word per percent**, least → most,
centred on **50 ≈ `normal`**. It runs `barely-there` / `near-zero` / `speck` at the bottom, through the
`tiny` family and `normal` in the middle, up to `huge` / `colossal` / `mega` / `beyond measure` at the
top (curated to size / amount / scale / proportion terms). The full list is the `INTENSITY_WORDS` array
in `engine/core/dpl/dpl.js` — edit it there to retune a word.

These tokens are resolved in the DPL inline renderer (where intensity is known), so they only carry meaning
inside a generator — not in the raw prompt box, which has no single intensity.

---

## 4a. Relative / derived intensity — ` ±NN%`

A generator often wants to base a value **off the intensity it was handed**, not just echo the one number.
Any intensity reference may carry a signed modifier — a **percent _of_ the value** (`+25` → ×1.25, `-25`
→ ×0.75 — "25% more / less of the intensity"), clamped to 1–100:

```
$intensity-word +25%            ; the word for 25% more intensity (62→large at base 50)
$intensity -10%                 ; the percent, 10% less (45% at base 50)
$intensity +50%                 ; the percent, 50% more (75% at base 50)
{#weather i+25%}                ; render weather at 25% MORE than this generator's intensity
{#clouds i-40%}                 ; clouds at 40% less
{#clouds f+25%}                 ; relative on the FOCUS dial
```

Relative **refs** (`{#name i+25%}` / `{#name f-25%}`) are converted to an absolute, **prefixed**
`{#name iNN% fNN%}` inside the DPL renderer (which knows the base), so the flat downstream resolver only ever
sees absolute, prefixed percents. An absolute `{#name i80%}` (no sign) passes straight through. Relative
modifiers are a DPL-authoring feature; they have no meaning in the raw prompt box.

---

## 5. Coverage / edge cases

- `{#name}` with no percent, top-level or nested → **50%**.
- `0%` → **1%**; `>100%` → **100%**.
- A condition that fails removes the line deterministically (before the gate).
- `[[castle]]`, `[deemph]`, `[a:b:0.5]`, `[1234567890]` (salt) → unchanged payload (not weight/condition).
- JS sidecars (`script:`, `{js:}`, `insert js:`) receive intensity / focus as the 4th / 5th argument.

## See also

- [`focus-design.md`](focus-design.md) — the **sibling dial** (`f`-prefix, `[f<NN%]`, `$focus`).
- [`layering-design.md`](layering-design.md) — global single-layer auto-merge / dedup + the `stacking` flag.
- [`dpl-design.md`](dpl-design.md) — the base language this extends.
- `engine/core/dpl/dpl.js` — renderer (conditions, scaling, `$intensity` / `$focus` tokens).
- `engine/core/stages/dynamicPrompt.js` — `{#name iNN% fNN%}` parsing + threading + dedup.
