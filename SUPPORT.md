# Support

## Bugs

Open an issue with the **Bug report** template. Include the environment table
(browser + version, OS, `file://` vs HTTPS) and any DevTools console errors —
most reports without console output can't be acted on.

## Questions and ideas

Open an issue with the **Feature request** template, or add the `question`
label to any issue. There is no chat/Discord; GitHub issues are the single
support channel so answers stay searchable.

## Security vulnerabilities

Do **not** open public issues. Follow [SECURITY.md](SECURITY.md) instead.

## Supported versions

| Version                        | Supported                                     |
| ------------------------------ | --------------------------------------------- |
| latest `main` / latest release | ✅                                            |
| older releases                 | Best-effort; please reproduce on latest first |

Supported browsers: recent 2 major versions of Chrome, Firefox, Safari, Edge.
The local browser engine additionally needs WebGPU (Chrome/Edge 113+) and a
served origin — it does not work on `file://`.
