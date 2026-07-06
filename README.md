# Random AI Prompt

[![Contributors](https://img.shields.io/github/contributors/junebug12851/random-ai-prompt?style=flat-square&logo=github)](https://github.com/junebug12851/random-ai-prompt/graphs/contributors)
[![Stars](https://img.shields.io/github/stars/junebug12851/random-ai-prompt?style=flat-square&logo=github)](https://github.com/junebug12851/random-ai-prompt/stargazers)
[![Forks](https://img.shields.io/github/forks/junebug12851/random-ai-prompt?style=flat-square&logo=github)](https://github.com/junebug12851/random-ai-prompt/network/members)
![Watchers](https://img.shields.io/github/watchers/junebug12851/random-ai-prompt?style=flat-square&logo=github)
[![Last commit](https://img.shields.io/github/last-commit/junebug12851/random-ai-prompt?style=flat-square)](https://github.com/junebug12851/random-ai-prompt/commits)
![Commits](https://img.shields.io/github/commit-activity/t/junebug12851/random-ai-prompt?style=flat-square&label=commits)
[![Version](https://img.shields.io/github/package-json/v/junebug12851/random-ai-prompt?style=flat-square&label=version)](https://github.com/junebug12851/random-ai-prompt/releases)
![Node](https://img.shields.io/badge/node-%E2%89%A5%2024-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white)
[![CI](https://img.shields.io/github/actions/workflow/status/junebug12851/random-ai-prompt/ci.yml?branch=main&style=flat-square&logo=githubactions&logoColor=white&label=CI)](https://github.com/junebug12851/random-ai-prompt/actions/workflows/ci.yml)
[![Engine coverage](https://img.shields.io/codecov/c/github/junebug12851/random-ai-prompt?flag=node&style=flat-square&logo=codecov&logoColor=white&label=engine%20coverage)](https://codecov.io/gh/junebug12851/random-ai-prompt?flags%5B0%5D=node)
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

![Random AI Prompt shown with a generated image, its prompt, and the DPL source](https://fairyfox.io/random-ai-prompt/screenshots/single-desktop.png?v=3)

Random AI Prompt is an open-source generator for AI image and text prompts. Instead of making
you write long, detailed prompts by hand, it lets you compose from a library of ready-made scenes,
subjects, and styles and fills in the depth automatically — turning a one-line idea into a fully
fleshed-out prompt. You can then run the result through 40+ models, including Midjourney, DALL·E,
Gemini, FLUX, and Stable Diffusion, right in your browser with your own API key — or just generate
the prompt text with no key at all. It runs entirely on your device and stores nothing on a server.

## What is this

Random AI Prompt is a tool for anyone who wants good AI-generated images or text without the chore
of writing a detailed prompt first. Most people type a short idea and get a flat result, because the
models reward long, richly detailed prompts that are tedious to write by hand. This project turns
that around: you assemble a prompt from building blocks — drop in a generated beach scene, roll a
random subject, add an art style, or reach for a wildcard from the whole catalog — and it expands
your short idea into a detailed, never-the-same prompt. When you are happy with the text, you can
send it to one of the built-in providers or simply copy it and use it elsewhere.

Under the hood, prompts are written in a small composition language (DPL) with tokens for scenes,
subjects, styles, randomness, intensity, and focus, so a one-line idea can unfold differently each
time. Everything runs in the browser and keeps your data on your device: settings and your own API
keys live only in local storage, and requests go straight from your browser to the provider you
chose, with no server in between. The project ships as two editions from one codebase: a
browser-only online edition, hosted at [prompt.fairyfox.io](https://prompt.fairyfox.io), and a full
desktop edition — available as a **pre-built download** (or build it from source) — that adds the
image gallery, single-image view, an in-app content manager, local Stable Diffusion providers, and an
18+ NSFW mode. Neither edition is "the" version: the hosted site is just one deployment of the online
edition, and you can self-host that same online build or run the desktop app locally — all from one
codebase.

## Some of the features

- **Prompts as a language.** Write `{#beach}` to drop in a generated beach scene, `{keyword}` to pull
  a random word from a list, `{#scene}` to roll a random scene, or `{#any}` for a wildcard from the
  whole catalog. Tokens nest, compose, and re-expand.
- **Intensity and focus dials.** Tune any token with two independent percentages: `{#beach i25%}` is a
  light touch, `{#beach i90%}` goes all-in, and `{#beach f80%}` keeps only the essentials. The dials
  cascade into every nested block.
- **Provider-agnostic, bring-your-own-key.** Around 40 image and text backends behind one interface,
  including OpenAI, Anthropic, Gemini, Midjourney, Ideogram, Leonardo, FLUX/BFL, Replicate, fal, and
  Stability. Keys stay on your device and calls go straight to the provider.
- **A curated content library.** Dozens of scene, subject, fragment, and style blocks plus dozens of
  word lists, with de-duplication that reduces accidental repetition of the same element.
- **Live content editing (desktop).** The in-app content manager edits the real block and list files
  on disk and applies changes without a restart.
- **Reproducible by design.** The engine is deterministic and seedable, so the same seed reproduces
  the same prompt, which helps with sharing and iterating.

![The Gallery screen, browsing generated images](https://fairyfox.io/random-ai-prompt/screenshots/gallery-desktop.png?v=3)

## How to get it

There are a few ways to run Random AI Prompt, and **none of them require you to build anything** unless
you want to.

**Online edition — nothing to install.** The hosted online edition at
[prompt.fairyfox.io](https://prompt.fairyfox.io) is always the latest build: open it, optionally paste
your own API key (or skip the key and generate prompt text only), and start composing. Nothing is
stored on a server. Want to run the online edition yourself? Every release attaches a ready-to-host
**online bundle** (`random-ai-prompt-<version>-online.zip`) on the
[Releases page](https://github.com/junebug12851/random-ai-prompt/releases) — static files you can drop
on any web host (Netlify, Cloudflare Pages, GitHub Pages, nginx, or `npx serve`). The hosted site is
just one deployment of that same bundle.

**Desktop edition — download pre-built.** The full desktop edition (image gallery, single-image view,
in-app content manager, local Stable Diffusion providers, and 18+ mode) is a pre-built download for
Windows, macOS, and Linux on the
[Releases page](https://github.com/junebug12851/random-ai-prompt/releases):

- **Windows** — an installer (`.msi` / `.exe`), or a **portable** `.zip` (unzip and run, no install).
- **macOS** — a `.dmg` you drag to Applications, or the `.app` run in place.
- **Linux** — a portable `.AppImage`, or a `.deb`.

The desktop app is self-contained — it bundles its own Node runtime and needs nothing installed
beforehand (on Windows it uses the built-in WebView2). A portable build keeps its data beside itself;
an installed build uses your per-user app-data folder, so upgrades never touch your settings or
generated images.

**Desktop edition — run from source.** Prefer to run from a checkout, for development or just by
preference? [Build it from source](#how-to-build), then start the local server, which builds the app
and serves it together with the `/api` backend:

```sh
npm start
```

It prints a local URL (for example `http://localhost:4173`); open it in your browser and press
`Ctrl+C` to stop. To serve an already-built app without rebuilding, use `npm run serve`; for
day-to-day development with hot reload, use `npm run web`.

Generating images requires access to a provider — either a bring-your-own-key cloud provider or a
local Stable Diffusion WebUI running with `--api`. Generating prompt text requires no key.

![Composing a prompt from building blocks — typing block references into the prompt box](https://fairyfox.io/random-ai-prompt/screenshots/prompt-blocks.gif?v=3)

## How to build

Building from source produces the full desktop edition (gallery, single-image view, content manager,
local providers, NSFW mode). It requires [Node.js](https://nodejs.org) 24 or newer (the version is
pinned in `.nvmrc`), and every command is run from the repository root.

```sh
git clone https://github.com/junebug12851/random-ai-prompt.git
cd random-ai-prompt
npm install
```

`npm install` installs both the engine and the `targets/web/` application. From there you can run it live with
`npm run web` or `npm start` (see [How to run](#how-to-run)), or produce a static production build:

```sh
npm run web:build
```

This outputs the built site to `targets/web/dist/`. The same source builds two editions: the full
local/desktop build, and the browser-only online build, in which the local-only features are gated off
through the `VITE_ONLINE` flag.

To run the checks and tests:

```sh
npm test
npm run test:e2e
```

`npm test` is the headless gate: a documentation-link check, linting, a smoke test, and the unit and
component suites. `npm run test:e2e` runs the end-to-end and visual-regression suites, and requires
`npx playwright install chromium` once beforehand.

## Contributing

Contributions are welcome, from a typo fix or a new building block to a bug report or a feature. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the full guide, including how to set up a local environment, the
branch workflow, the checks to run, and how to submit a pull request.

In short: fork the repository, branch your work off `dev`, run `npm test` until it passes, and open a
pull request against `dev` rather than `main`. The developer guide lives in the [notes](notes/)
directory; begin with [notes/status.md](notes/status.md).

![The content manager, editing a scene block written in DPL](https://fairyfox.io/random-ai-prompt/screenshots/manage-desktop.png?v=3)

## Credits

Random AI Prompt is created by [junebug12851](https://github.com/junebug12851), with early internal
list work by Merk. It builds on the work of others:

- **Prompt and word lists** — the artist and Danbooru tag lists from
  [stable-diffusion-webui](https://github.com/AUTOMATIC1111/stable-diffusion-webui) and
  [a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete), the
  [SCOWL](http://wordlist.aspell.net) dictionary, WordNet (Princeton University), and NovelAI
  Experiments by u/Carlyone (CC BY 4.0). All lists were cleaned up and passed through a content-safety
  filter.
- **Frameworks and tooling** — React, Vite, and Node 24; internationalization with
  [react-intl / FormatJS](https://formatjs.io); testing and screenshots with
  [Playwright](https://playwright.dev). Hosting is on Netlify (online edition) and GitHub Pages (docs).
- **AI assistance** — parts of the modernization, the internationalization pass, and the
  release-screenshot toolkit were built with Claude (Anthropic).

Full attributions and license texts are in [list-credits.md](list-credits.md).

## Links

- Online edition: [prompt.fairyfox.io](https://prompt.fairyfox.io)
- Documentation and API reference: [fairyfox.io/random-ai-prompt](https://fairyfox.io/random-ai-prompt/)
- Project family: [fairyfox.io](https://fairyfox.io)

## License

Licensed under [Apache-2.0](LICENSE).
