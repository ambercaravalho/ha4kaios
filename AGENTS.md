# AGENTS.md

Guidance for AI agents and contributors working in this repository.

## Project

`ha4kaios` is a Home Assistant client for **KaiOS 2.5** (Gecko / Firefox 48),
shipped as a privileged packaged app. It authenticates with a long-lived access
token and uses the Home Assistant WebSocket API with a REST fallback.

## Repository layout

```
app/     Everything that ships in the package (manifest.webapp must stay here).
docs/    Wiki / deep-dive documentation.
build/   build.sh and the generated application.zip.
```

- Put all shippable app code under `app/`. Nothing else belongs in the package.
- Deep-dive or technical detail goes in `docs/`, not the README.
- Keep the root `README.md` concise; link into `docs/` for depth.

## Code conventions

- **ES5 only.** Target is Gecko 48. Do not use `async`/`await`, the `**`
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

- Build the package: `./build/build.sh` (outputs `build/application.zip` with
  `manifest.webapp` at the zip root).
- Syntax-check changed JS: `node --check <file>`.
- Validate the manifest: it must be valid JSON.

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
