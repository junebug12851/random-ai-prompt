# Contributing to Random AI Prompt

This document describes how to contribute changes to Random AI Prompt: the repository layout for
contributors, how to set up a local environment, and how to submit a change for review.

## Ways to contribute

- Report a bug or request a feature through the
  [issue tracker](https://github.com/junebug12851/random-ai-prompt/issues).
- Extend the content — the scenes, subjects, styles, and word lists under `data/`.
- Change the code — the engine under `src/` or the web application under `gui/`.
- Improve the documentation — the README, the `notes/` developer guide, or this document.

## Requirements

[Node.js](https://nodejs.org) 24 or newer is required; the version is pinned in `.nvmrc`. All commands
are run from the repository root.

New content must stay within the project's content policy. Adult terms are permitted but gated behind
an 18+ toggle; the content-safety filter removes slurs, any content sexualizing minors, and extreme
shock material. Contributions that add disallowed content cannot be accepted.

## Setting up a local environment

1. Fork the repository on GitHub, then clone your fork:

   ```sh
   git clone https://github.com/<your-username>/random-ai-prompt.git
   cd random-ai-prompt
   ```

2. Install dependencies (this installs both the engine and the `gui/` application):

   ```sh
   npm install
   ```

3. Start the development server with hot reload:

   ```sh
   npm run web
   ```

## Branch model

The project uses a git-flow model with two long-lived branches:

- `main` is the released code. It is protected: it does not accept direct pushes, and each commit on
  it is a tagged release made by the maintainer.
- `dev` is the integration branch, where finished work lands first.

Branch your work off `dev`, and open your pull request against `dev`. Use a short, descriptive branch
name with a `type/` prefix:

```sh
git checkout dev
git checkout -b feature/<short-description>
```

## Making changes

- Write focused commits with `type: summary` messages in the present tense, for example
  `feat: add cyberpunk-city scene`, `fix: correct intensity cascade`, or `docs: clarify build steps`.
- Stage the specific files you changed rather than using `git add .`.
- When fixing a bug, add a test that fails before the fix and passes after it. Engine tests are in
  `tests/`; web tests are in `gui/tests/` and `tests/e2e/`.

## Verifying a change

Run the same checks that CI runs, from the repository root:

```sh
npm run lint
npm run format
npm test
```

`npm test` is the headless verification gate: a documentation-link check, linting, a smoke test, and
the Node and browser unit suites. To run the end-to-end and visual-regression suites:

```sh
npm run test:e2e
```

This requires `npx playwright install chromium` once beforehand. Ensure `npm test` passes before
opening a pull request.

## Submitting a pull request

1. Push your branch to your fork:

   ```sh
   git push origin feature/<short-description>
   ```

2. Open a pull request on GitHub with `dev` as the base branch. Describe the change and its rationale,
   and link any related issue (for example, `Closes #12`).
3. CI runs automatically on the pull request. If a check fails or a reviewer leaves a comment, push
   additional commits to the same branch; the pull request updates in place. Review conversations
   should be resolved before the pull request is merged.

Once merged into `dev`, the change ships to `main` with the next release.

## Further reading

The developer guide is in the [notes](notes/) directory; start with
[notes/status.md](notes/status.md) for the current state, or [notes/systems/](notes/systems/) for how
the engine and application fit together. The generated API reference is published at
[fairyfox.io/random-ai-prompt](https://fairyfox.io/random-ai-prompt/).
