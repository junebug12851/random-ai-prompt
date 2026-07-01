# random-ai-prompt

[![Contributors](https://img.shields.io/github/contributors/junebug12851/random-ai-prompt?style=flat-square&logo=github)](https://github.com/junebug12851/random-ai-prompt/graphs/contributors)
[![Stars](https://img.shields.io/github/stars/junebug12851/random-ai-prompt?style=flat-square&logo=github)](https://github.com/junebug12851/random-ai-prompt/stargazers)
[![Forks](https://img.shields.io/github/forks/junebug12851/random-ai-prompt?style=flat-square&logo=github)](https://github.com/junebug12851/random-ai-prompt/network/members)
![Watchers](https://img.shields.io/github/watchers/junebug12851/random-ai-prompt?style=flat-square&logo=github)
[![Last commit](https://img.shields.io/github/last-commit/junebug12851/random-ai-prompt?style=flat-square)](https://github.com/junebug12851/random-ai-prompt/commits)
![Commits](https://img.shields.io/github/commit-activity/t/junebug12851/random-ai-prompt?style=flat-square&label=commits)
[![Version](https://img.shields.io/github/package-json/v/junebug12851/random-ai-prompt?filename=engine-v3%2Fpackage.json&style=flat-square&label=version)](https://github.com/junebug12851/random-ai-prompt/releases)
![Node](https://img.shields.io/badge/node-%E2%89%A5%2024-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white)
[![CI](https://img.shields.io/github/actions/workflow/status/junebug12851/random-ai-prompt/ci.yml?branch=main&style=flat-square&logo=githubactions&logoColor=white&label=CI)](https://github.com/junebug12851/random-ai-prompt/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/codecov/c/github/junebug12851/random-ai-prompt?style=flat-square&logo=codecov&logoColor=white)](https://codecov.io/gh/junebug12851/random-ai-prompt)
[![Code quality](https://img.shields.io/codefactor/grade/github/junebug12851/random-ai-prompt?style=flat-square&logo=codefactor&logoColor=white&label=code%20quality)](https://www.codefactor.io/repository/github/junebug12851/random-ai-prompt)
[![Quality gate](https://img.shields.io/sonar/quality_gate/junebug12851_random-ai-prompt?server=https%3A%2F%2Fsonarcloud.io&style=flat-square&logo=sonarcloud&logoColor=white&label=quality%20gate)](https://sonarcloud.io/summary/new_code?id=junebug12851_random-ai-prompt)
[![Tech debt](https://img.shields.io/sonar/tech_debt/junebug12851_random-ai-prompt?server=https%3A%2F%2Fsonarcloud.io&style=flat-square&logo=sonarcloud&logoColor=white&label=tech%20debt)](https://sonarcloud.io/summary/new_code?id=junebug12851_random-ai-prompt)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/junebug12851/random-ai-prompt?style=flat-square&label=scorecard)](https://securityscorecards.dev/viewer/?uri=github.com/junebug12851/random-ai-prompt)
[![Docs](https://img.shields.io/badge/docs-fairyfox.io-4c9?style=flat-square&logo=readthedocs&logoColor=white)](https://fairyfox.io/random-ai-prompt/)
[![Netlify](https://img.shields.io/github/actions/workflow/status/junebug12851/random-ai-prompt/netlify-deploy.yml?branch=main&style=flat-square&logo=netlify&logoColor=white&label=netlify)](https://app.netlify.com/projects/prompt-fairyfox/deploys)
[![Open issues](https://img.shields.io/github/issues/junebug12851/random-ai-prompt?style=flat-square)](https://github.com/junebug12851/random-ai-prompt/issues)
![Closed issues](https://img.shields.io/github/issues-closed/junebug12851/random-ai-prompt?style=flat-square)
[![Open PRs](https://img.shields.io/github/issues-pr/junebug12851/random-ai-prompt?style=flat-square)](https://github.com/junebug12851/random-ai-prompt/pulls)
![Closed PRs](https://img.shields.io/github/issues-pr-closed/junebug12851/random-ai-prompt?style=flat-square)
[![License](https://img.shields.io/github/license/junebug12851/random-ai-prompt?style=flat-square)](LICENSE)

**An open-source generator for AI image and text prompts that automatically builds richer, more
detailed prompts than most people write by hand.**

You compose from a large library of scenes, subjects, and styles, and random-ai-prompt fills in the
depth — turning a short idea into a fully fleshed-out prompt with almost no typing — then runs the
result through **40+ models** including Midjourney, DALL·E, Gemini, FLUX, and Stable Diffusion, right
in your browser. Bring your own API key, or just generate the prompt text with no key at all.

It runs entirely in your browser and stores nothing on a server. Under the hood, prompts are built
with a small composition language (scenes, subjects, styles, randomness, intensity, and focus), so a
one-line idea can unfold into a detailed, never-the-same result. Providers span OpenAI, Anthropic
Claude, Google Gemini, Midjourney, Ideogram, Leonardo, Black Forest Labs (FLUX), Replicate, fal,
Stability, and many more. (Stable Diffusion is still supported — it's where the project started — but
it's now just one option among many, not the focus.)

## ▶ Try it now

**[prompt.fairyfox.io](https://prompt.fairyfox.io)** — the online edition runs the latest version
right in your browser. No install, no account, nothing stored on a server: open it, paste your own
API key (or just generate prompt text with no key at all), and start exploring. It's the fastest way
to see what the project is about.

|                      |                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| ▶ **Use it online**  | **[prompt.fairyfox.io](https://prompt.fairyfox.io)** — instant, always the newest build                                |
| 📖 **Documentation** | **[fairyfox.io/random-ai-prompt](https://fairyfox.io/random-ai-prompt/)** — API reference + the living developer notes |
| 🦊 **More projects** | **[fairyfox.io](https://fairyfox.io)** — the parent site and the rest of the fairyfox project family                   |

> The online edition is a focused, browser-only build. The **gallery**, **single-image view**, the
> in-app **content Manager**, the **local** Stable-Diffusion providers, and **NSFW mode** live in the
> full desktop edition you [build from source](#build--run-from-source) (18+).

## What makes it interesting

- **Prompts as a language.** Write `{#beach}` to drop in a whole generated beach scene, `{keyword}`
  to pull a random word from a list, `{#scene}` to roll a random scene, or `{#any}` for a wildcard
  from the entire catalog. Tokens nest, compose, and re-expand — a one-line prompt can unfold into a
  detailed, never-the-same scene.
- **Intensity & focus dials.** Tune any token with two independent percents: `{#beach i25%}` renders
  a light touch, `{#beach i90%}` goes all-in, and `{#beach f80%}` keeps only the essentials while
  dropping the fluff. The dials cascade into every nested generator.
- **Provider-agnostic, bring-your-own-key.** Around 40 image and text backends behind one interface —
  OpenAI, Anthropic, Gemini, Midjourney, Ideogram, Leonardo, FLUX/BFL, Replicate, fal, Stability,
  Cohere, Mistral, Groq, Together, and more. Keys live only on your device and calls go straight to
  the provider — there's no server relay.
- **Huge, curated content library.** Hundreds of hand-tuned scene, subject, fragment, and style
  generators plus large keyword lists, with smart de-duplication ("layering") so the same element
  never doubles up by accident.
- **SFW by default, NSFW when you opt in.** Adult content is automatically gated by name and locked
  off entirely in the online build; the desktop edition unlocks it behind an 18+ toggle.
- **Edit the content live (desktop).** The in-app **Manager** edits the real list and generator files
  on disk and hot-applies them instantly — no restart, no redeploy.
- **Reproducible by design.** The engine is deterministic and seedable, so the same seed reproduces
  the same prompt — handy for sharing, testing, and iterating on a result you liked.
- **Built to last.** Modern ES-module codebase on Node 24, an isomorphic engine that runs identically
  in Node and the browser, full automated tests (Vitest + Playwright), internationalized UI, and
  self-hosted fonts with no third-party tracking.

## A taste of DPL

```text
a portrait of {#person}, {#beach i30%}, {#style}, {#fx f70%}
```

One line like this expands — differently every time — into a fully fleshed-out prompt: a generated
person, a light beach setting, a random art style, and a focused set of finishing effects. Drop the
explicit tokens and just write `{#random}` for a complete, composed prompt out of nothing.

See the **[documentation](https://fairyfox.io/random-ai-prompt/)** for the full DPL guide.

## Build & run from source

The full desktop edition (gallery, Manager, local providers, NSFW) is built from source.

Requires **Node ≥ 24**.

```sh
cd engine-v3
npm install          # installs the engine and the gui/ web-app dependencies
npm run web          # dev server with hot reload
```

For a local release build that serves the built app plus the `/api` backend:

```sh
npm start            # build, then serve the local edition
```

To produce just the static production build:

```sh
npm run web:build    # outputs the built site to gui/dist/
```

> Generating _images_ requires access to a provider — either a bring-your-own-key cloud provider, or a
> local Stable Diffusion WebUI running with `--api`. Generating _prompt text_ needs no key at all.

## Project layout

This repository holds **two separate engines that share no code**:

### 🟢 `engine-v3/` — the active project

The current, maintained system: an isomorphic prompt **engine** (`src/core/`) authored in DPL, driven
by a React/Vite **web app** (`gui/`), with SFW/NSFW gating, the ~40-provider framework, and the
in-app content Manager. **All new work happens here.** The same code builds two editions from one
source — the full **local/desktop** build and the browser-only **online** build hosted at
[prompt.fairyfox.io](https://prompt.fairyfox.io).

### 🟠 `engine-v1-2/` — the original, frozen

The complete **pre-revival** system as it was in 2022–2023 (CommonJS): the yargs CLI and the
Express/Pug classic web UI. It is finished, frozen, and on its way out — kept as a self-contained,
runnable reference. It is **not** maintained, built, or released.

```sh
cd engine-v1-2
npm install
node index.js       # CLI generator
node server.js      # classic web UI (or: webui.bat)
```

## Development

Contributing? The headless verification gate is `npm test` (lint + smoke + Vitest, Node + jsdom);
end-to-end and visual-regression specs run with `npm run test:e2e`. Everything runs from `engine-v3/`.

The full developer guide lives in **[`notes/`](notes/)** (start at
[`notes/status.md`](notes/status.md)). The generated API reference and the living notes are published
at **[fairyfox.io/random-ai-prompt](https://fairyfox.io/random-ai-prompt/)**.

## Links

- ▶ **Online edition:** [prompt.fairyfox.io](https://prompt.fairyfox.io)
- 📖 **Docs & API reference:** [fairyfox.io/random-ai-prompt](https://fairyfox.io/random-ai-prompt/)
- 🦊 **Parent site:** [fairyfox.io](https://fairyfox.io)
- 📓 **Developer notes:** [`notes/`](notes/) · [`CLAUDE.md`](CLAUDE.md) (AI/context guide)

---

Open source by **junebug12851**. Licensed under **[Apache-2.0](LICENSE)**.
