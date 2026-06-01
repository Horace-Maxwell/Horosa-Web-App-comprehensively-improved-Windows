# windows-adaptations/ — Windows-only changes to the (gitignored) product source

This Windows repo is **build-harness-only**: the product source under
`local/workspace/Horosa-Web-*/` (astrostudyui / astropy / astrostudysrv / vendor) is **gitignored**
and is **wholesale-replaced from the Mac repo** on every sync (`re-clone Mac → copy Mac's Horosa-Web/
tree over the workspace`, see `.claude/skills/horosa-dev/SKILL.md` gotcha #16). The Mac tree does **not**
contain the Windows-specific adaptations below, so every sync drops them — and a `git reset --hard` /
workspace wipe loses them with **no git recovery** (this is exactly what happened in the v2.5.0 "disaster").

**So they live here, tracked in git.** After each wholesale-replace, run:

```bash
bash windows-adaptations/apply.sh \
  local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c \
  tmp/mac-sync-<ver>/Horosa-Web      # optional 2nd arg: Mac clone (for THIRD_PARTY_NOTICES.md)
```

then `cd desktop_installer_bundle && npm run selfcheck` — the `windows-ahead / ported-fix sentinels`
gate must be **40/40**. Every item below is guarded by a `release_selfcheck.py` sentinel, so a drop is
caught before release.

## The adaptations (7)

| # | Target (in workspace) | What / Why | How restored |
|---|---|---|---|
| 1 | `astrostudyui/scripts/umi-runner.js` | **Windows-only.** Mac's `package.json` build scripts use bash `export NODE_OPTIONS=--openssl-legacy-provider && umi build`, which **fails on Windows cmd/PowerShell**. This wrapper sets the env cross-platform and runs umi. `build-renderer.cjs` runs `npm run build:file` in this dir, so it's load-bearing. | full copy in `files/` |
| 2 | `astrostudyui/scripts/loadCryptoDeps.js` + `scripts/vendor/` | **Windows-only.** Crypto-dep shim + vendored `js-rsa`/`node-forge` used by the Windows build. | full copy in `files/` |
| 3 | `astrostudyui/package.json` (name + scripts) | Keep Mac's v2.5.0 **dependencies**, but restore the Windows **name** (`horosa-astrostudyui`) + **umi-runner-based scripts** (start/build/build:file/postinstall). | `apply.sh` merges Mac deps + `files/astrostudyui/package.name-scripts.json` |
| 4 | `astropy/requirements.txt` | **Strip `flatlib==0.2.3.post3`.** Not on PyPI (it's Mac's local flatlib-ctrad2 `setup.py` version); on Windows flatlib is provided by the **vendored flatlib-ctrad2 via sys.path injection** in the service-manager bootstrap, NOT pip. The pin makes the embedded-python `pip install -r requirements.txt` fail resolution → installs **nothing** → chart service dead. | `apply.sh`: `sed -i '/^flatlib==/d'` |
| 5 | `THIRD_PARTY_NOTICES.md` (workspace root) | Mac keeps it at the **repo root** (sibling of `Horosa-Web/`), so a Horosa-Web-only replace misses it; `stage-runtime.cjs` hard-requires it at the workspace root or `dist:win` dies in stage:runtime. | `apply.sh` copies from the Mac clone root |
| 6 | `astrostudyui/src/utils/windowSizePersistence.js` | Add `isDesktopShellWindow(win)` (Electron mirror of Mac's `isTauriWindow`, via `window.horosaDesktop`) + skip web-layer window persistence in the desktop shell — Electron self-manages window bounds; web persistence caused **startup resize jitter**. | `patches/src__utils__windowSizePersistence.js.patch` |
| 7 | `astrostudyui/src/pages/index.js` | Add `ensureField(flds,name)` defensive guard + `String()`-coerce `lat` in `changeCond` — a restored/imported chart payload may omit a field or carry a **numeric lat**, which would crash `lat.toLowerCase()`. | `patches/src__pages__index.js.patch` |

## Notes
- **#1–#5 are robust** (full copies / idempotent ops). **#6–#7 are patches** against Mac `1c463718`; if a
  future Mac change touches the same region the patch may not apply cleanly — `apply.sh` warns, and the
  exact changes are also visible in the `.patch` files (diff `--- Mac ... +++ Windows-adapted`). Re-apply by hand if so.
- The launcher mirror (service-manager.js port-retry etc.) is NOT here — it lives in the **tracked**
  `desktop_installer_bundle/electron/service-manager.js`, so it's already git-safe.
- When you ADD a new Windows adaptation in a future sync: drop the file/patch here, wire it into `apply.sh`,
  add a `release_selfcheck.py` sentinel, and note it in this table (+ SKILL.md gotcha #16).
