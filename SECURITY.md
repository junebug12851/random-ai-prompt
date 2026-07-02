# Security Policy

## Supported versions

`random-ai-prompt` is an actively developed, single-maintainer open-source project.
Security fixes are made against the latest release on `main`; older tagged releases are
not separately patched. Always run the newest version (or the online edition at
[prompt.fairyfox.io](https://prompt.fairyfox.io), which always serves the latest build).

| Version                | Supported          |
| ---------------------- | ------------------ |
| Latest release (`main`) | :white_check_mark: |
| Older tags             | :x:                |

## Reporting a vulnerability

Please report suspected security issues **privately** — do not open a public issue for a
vulnerability.

- **Preferred:** use GitHub's private vulnerability reporting for this repository
  (**Security → Report a vulnerability**), which opens a private advisory thread.
- **Email:** `fairy@fairyfox.io`.

Please include enough detail to reproduce: affected version/commit, a description of the
issue, reproduction steps or a proof of concept, and the potential impact.

### What to expect

- **Acknowledgement:** within about 7 days.
- **Assessment & fix:** we'll investigate, keep you updated, and aim to ship a fix as
  quickly as the severity warrants. Because this is a solo-maintained project, timelines
  are best-effort rather than contractual.
- **Disclosure:** please keep the report private until a fix is released. We're happy to
  credit you in the release notes / advisory unless you'd prefer to remain anonymous.

## Scope

This project runs **entirely on the user's device** — the web app stores settings and
bring-your-own API keys only in local browser storage (`rap.store.*`) or local files, and
sends prompts and keys **directly** from the device to the AI provider the user chose;
there is **no server relay** and no account system. The most relevant classes of report
are therefore: cross-site scripting or prompt-injection paths in the SPA, leakage or
mishandling of locally stored API keys, dependency/supply-chain issues, and CI/release
pipeline weaknesses.

The pre-revival CLI + classic Express/Pug server (the 2022–2023 system) has been removed from
the tree and is **out of scope** — it survives only in git history and as a reference clone
under `assets/references/`, and is not built, released, or deployed.
