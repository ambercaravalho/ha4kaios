# AGENTS.md

Guidance for AI agents and contributors working in this repository.

## Project

`ha4kaios` is a Home Assistant client for **KaiOS 2.5, 3.0, 3.1, and 4.0**,
shipped as a privileged packaged app (long-lived access token; HA WebSocket API
with a REST fallback). KaiOS 2.5 (Gecko 48) is the most constrained target, so
the code is written to its limits; newer releases run newer Gecko and are a
strict superset.

## Repository layout

```
app/     Everything that ships in the package (both manifests must stay here).
docs/    Deep-dive documentation.
build/   build.sh and the generated application-*.zip packages.
```

- Put all shippable app code under `app/`. Nothing else belongs in the package.
- Two manifests live in `app/`: `manifest.webapp` (KaiOS 2.5) and
  `manifest.webmanifest` (KaiOS 3.0/3.1/4.0, with a `b2g_features` block). Keep
  them in sync (same permissions, CSP, version, developer info).
- Deep-dive or technical detail goes in `docs/`, not the README.
- Keep the root `README.md` concise; link into `docs/` for depth.

## Code conventions

- **ES5 only.** The lowest target is Gecko 48 (KaiOS 2.5); the ES5 output also
  runs unchanged on the newer engines. Do not use `async`/`await`, the `**`
  operator, or object rest/spread `{...x}`. Use `Promise` for async work.
- **No build step, no runtime dependencies.** Third-party libraries must be
  vendored under `app/js/vendor/` and verified ES5-safe.
- **Module pattern:** each file is an IIFE that attaches a single namespaced
  object to `window` (e.g. `HAConfig`, `HAClient`, `HAViews.setup`).
- **CSP (`script-src 'self'`):** no inline `<script>`, no inline handlers
  (`onclick=`), no `eval()`. Wire events with `addEventListener`.
- **Untrusted data:** render values from Home Assistant with `textContent`,
  never `innerHTML`.
- **Security:** never log or hardcode tokens; keep the `# SECURITY-REVIEW`
  comments on token, camera, and cross-origin code paths.
- Comments explain intent/constraints, not what the code obviously does.

## Build & verify

- Build the packages: `./build/build.sh` (outputs `build/application-2.5.zip`
  for KaiOS 2.5 and `build/application-3.zip` for KaiOS 3.0/3.1/4.0, each with
  its manifest at the zip root).
- Syntax-check changed JS: `node --check <file>`.
- Validate the manifests: both `manifest.webapp` and `manifest.webmanifest` must
  be valid JSON.

## Install on a device (appscmd)

Use the official KaiOS `appscmd` tool (binary at `build/appscmd`) over the
Firefox debugger socket. It uploads the app folder itself, so pass a **local
host path** (e.g. `app`), not an on-device path, and do NOT push files to the
device manually.

```bash
adb root
adb forward tcp:6000 localfilesystem:/data/local/debugger-socket
./build/appscmd install app        # local path; uploads over the socket
./build/appscmd list               # verify: look for "ha4kaios | Enabled | Installed"
```

- Works for KaiOS 3.0/3.1/4.0. `appscmd` picks `manifest.webmanifest`, so
  installing the whole `app/` folder (with both manifests present) is fine.
- Do NOT use `--socket <path>` for a device (that form is for the
  simulator/desktop); the default connects to the forwarded `tcp:6000`.
- Only install/launch on the device when explicitly asked.

## Git & pushes

- **Only commit or push when explicitly asked.**
- **Co-author every commit** with this exact trailer:

  ```
  Co-authored-by: Cursor <cursoragent@cursor.com>
  ```

- Write concise, imperative commit subjects; explain the "why" in the body.
- **Pushing to `main` requires explicit user confirmation** each time.
- Never force-push to `main` without explicit approval. When a force-push is
  approved, use `--force-with-lease`, never a bare `--force`.
- Never modify `git config`, and never skip hooks (`--no-verify`,
  `--no-gpg-sign`, etc.).
- Avoid `git commit --amend` and interactive commands (`rebase -i`, `add -i`).
