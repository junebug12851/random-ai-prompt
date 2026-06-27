# Reference — DPL intensity (the dial)

**Status: built (feature/dpl-intensity).** Intensity is a per-reference "how much" dial that flows into a
generator and changes what it renders. It adds three things to [DPL](dpl-design.md): an **argument on the
`{#name}` token**, **intensity conditions** on lines (next to weights), and a **natural-language keyword**
the prompt text can interpolate. The engine also **auto-scales** probability gates and counts by intensity.

The guiding line is unchanged: DPL stays *data, not code*. Intensity is one number the author compares
against (`[<10%]`) or drops into text (`{intensity}`); the engine does the scaling. No variables, no state.

---

## 1. The token argument — `{#name NN%}`

A `{#name}` reference may carry an intensity percent:

```
{#great-bridge 25%}        ; render great-bridge at 25% intensity
{#weather 80%}             ; weather at 80%
{#knight}                  ; no percent → the default, 50%
```

- The percent is **1–100**. `0%` is treated as **1%** (never zero). Values above 100 clamp to 100.
- **Default when unspecified: 50%.** A bare `{#name}` — at the top level *or* nested inside another
  generator — runs at 50%. (Intensity does **not** auto-inherit from a parent; a nested `{#weather}` with
  no percent is 50%, regardless of the parent's dial. To pass a parent's level down, write it explicitly,
  e.g. `{#weather 80%}`.) The default lives in one constant (`DEFAULT_INTENSITY`) so it is trivial to retune.
- The percent is parsed in the `{#…}` resolver (`src/core/stages/dynamicPrompt.js`) and handed to the
  generator as a 4th argument: `mod.default(settings, imageSettings, upscaleSettings, intensity)`. Compiled
  `.dpl` files expose it as `ctx.intensity`; `.js` sidecars read the 4th parameter.

---

## 2. Intensity conditions on a line — `[<10%]`, `[100|<10%]`

A line/bullet can carry an **intensity condition** in the same square-bracket slot as a weight. The line is
rendered only when the condition holds against the current intensity:

```
[<10%] - grass             ; only when intensity < 10%
- [>50%] dense undergrowth ; only when intensity > 50%
- [=50%] a balanced scene  ; only at exactly 50%
```

**Operators:** `<`, `<=`, `>`, `>=`, `=` (also `==`), `!=`. The value is a percent (`10%`, `12.5%`).

**Stacking weight and condition** — inside one bracket, separated by a pipe **or a space** (the space
reads more naturally), either order:

```
- [100|<10%] sparse detail ; weight 100 AND only when intensity < 10%
- [100 <10%] sparse detail ; identical (space separator)
- [<10% 100] sparse detail ; identical (either order)
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

## 4. The natural-language keyword — `{intensity}`

So the *text* can react too (not just the structure), intensity is interpolable inline in any `.dpl`
payload:

| Token | Expands to | Example at 50% |
|-------|------------|----------------|
| `{intensity}` | the magnitude **word** | `normal` |
| `{intensity%}` | the percent with a sign | `50%` |
| `{intensity-num}` | the bare number | `50` |

```
{intensity} amount of grass        ; "normal amount of grass" at 50%, "tiny amount of grass" at 20%
a {intensity} cluster of clouds
```

**The word ladder** (ascending; boundaries are tunable in `dpl.js`):

| Percent | Word |
|---------|------|
| 1–24 | `tiny` |
| 25–40 | `small` |
| 41–60 | `normal` |
| 61–75 | `large` |
| 76–90 | `huge` |
| 91–100 | `massive` |

These tokens are resolved in the DPL inline renderer (where intensity is known), so they only carry meaning
inside a generator — not in the raw prompt box, which has no single intensity.

---

## 4a. Relative / derived intensity — ` ±NN%`

A generator often wants to base a value **off the intensity it was handed**, not just echo the one number.
Any intensity reference may carry a signed modifier — a **percent _of_ the value** (`+25` → ×1.25, `-25`
→ ×0.75 — "25% more / less of the intensity"), clamped to 1–100:

```
{intensity +25%}                ; the word for 25% more intensity (62→large at base 50)
{intensity% -10%}               ; the percent, 10% less (45% at base 50)
{intensity-num +50%}            ; the number, 50% more (75 at base 50)
{#weather +25%}                 ; render weather at 25% MORE than this generator's intensity
{#clouds -40%}                  ; clouds at 40% less
```

Relative **refs** (`{#name +25%}` / `{#name -25%}`) are converted to an absolute `{#name NN%}` inside the
DPL renderer (which knows the base), so the flat downstream resolver only ever sees absolute percents. An
absolute `{#name 80%}` (no sign) passes straight through unchanged. Relative modifiers are a DPL-authoring
feature; they have no meaning in the raw prompt box.

---

## 5. Coverage / edge cases

- `{#name}` with no percent, top-level or nested → **50%**.
- `0%` → **1%**; `>100%` → **100%**.
- A condition that fails removes the line deterministically (before the gate).
- `[[castle]]`, `[deemph]`, `[a:b:0.5]`, `[1234567890]` (salt) → unchanged payload (not weight/condition).
- JS sidecars (`script:`, `{js:}`, `insert js:`) receive intensity as the 4th argument and may branch on it.

## See also

- [`dpl-design.md`](dpl-design.md) — the base language this extends.
- `src/core/dpl/dpl.js` — renderer (conditions, scaling, `{intensity}` tokens).
- `src/core/stages/dynamicPrompt.js` — `{#name NN%}` parsing + threading.
