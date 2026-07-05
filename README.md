# Random AI Prompt

![Random AI Prompt shown with a generated image, its prompt, and the DPL source](https://fairyfox.io/random-ai-prompt/screenshots/single-tablet.png?v=2)

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
desktop edition you build from source that adds the image gallery, single-image view, an in-app
content manager, local Stable Diffusion providers, and an 18+ NSFW mode.

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

![The Gallery screen, browsing generated images](https://fairyfox.io/random-ai-prompt/screenshots/gallery-desktop.png?v=2)

## How to run

The quickest way to run the project is to install nothing at all: the online edition at
[prompt.fairyfox.io](https://prompt.fairyfox.io) is always the latest build. Open it, paste your own
API key (or skip the key and generate prompt text only), and start composing. Nothing is stored on a
server.

To run the full desktop edition locally, first [build it from source](#how-to-build), then start the
local server, which builds the app and serves it together with the `/api` backend:

```sh
npm start
```

The command prints a local URL (for example `http://localhost:3000`); open it in your browser. To
stop the server, press `Ctrl+C` in the terminal. If the app is already built and you only want to
serve it again without rebuilding:

```sh
npm run serve
```

For day-to-day development, run the development server with hot reload instead:

```sh
npm run web
```

Generating images requires access to a provider — either a bring-your-own-key cloud provider or a
local Stable Diffusion WebUI running with `--api`. Generating prompt text requires no key.

![The Generate screen, composing a prompt from building blocks](https://fairyfox.io/random-ai-prompt/screenshots/generate-desktop.png?v=2)

## How to build

Building from source produces the full desktop edition (gallery, single-image view, content manager,
local providers, NSFW mode). It requires [Node.js](https://nodejs.org) 24 or newer (the version is
pinned in `.nvmrc`), and every command is run from the repository root.

```sh
git clone https://github.com/junebug12851/random-ai-prompt.git
cd random-ai-prompt
npm install
```

`npm install` installs both the engine and the `gui/` application. From there you can run it live with
`npm run web` or `npm start` (see [How to run](#how-to-run)), or produce a static production build:

```sh
npm run web:build
```

This outputs the built site to `gui/dist/`. The same source builds two editions: the full
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

![The content manager, editing a scene block written in DPL](https://fairyfox.io/random-ai-prompt/screenshots/manage-desktop.png?v=2)

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
