#!/usr/bin/env bash
# Re-apply the Windows-only adaptations onto a freshly wholesale-replaced product source.
#
# WHY THIS EXISTS: the Windows product source (local/workspace/Horosa-Web-*/) is gitignored
# (build-harness-only repo) + is wholesale-replaced from the Mac repo on every sync. The Mac
# tree LACKS these Windows adaptations, so each sync drops them. A `git reset --hard` / wipe
# also loses them. They were once lost with no recovery (the v2.5.0 "disaster"), so they now
# live HERE, tracked in git, and this script restores them deterministically.
#
# USAGE (from repo root, after wholesale-replacing the product source from the Mac clone):
#   bash windows-adaptations/apply.sh <workspace-product-dir> [mac-clone-Horosa-Web-dir]
# e.g.
#   bash windows-adaptations/apply.sh \
#     local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c \
#     tmp/mac-sync-2.5.0/Horosa-Web
set -uo pipefail
OV="$(cd "$(dirname "$0")" && pwd)"
WS="${1:?usage: apply.sh <workspace-product-dir> [mac-clone-Horosa-Web-dir]}"
MAC="${2:-}"
[ -d "$WS/astrostudyui" ] || { echo "ERR: $WS is not a product dir (no astrostudyui/)"; exit 1; }
ok(){ echo "  [ok] $*"; } ; warn(){ echo "  [!!] $*"; }

echo "== 1. Windows-only files (umi-runner.js / loadCryptoDeps.js / scripts/vendor) =="
cp "$OV/files/astrostudyui/scripts/umi-runner.js"     "$WS/astrostudyui/scripts/umi-runner.js"     && ok umi-runner.js
cp "$OV/files/astrostudyui/scripts/loadCryptoDeps.js" "$WS/astrostudyui/scripts/loadCryptoDeps.js" && ok loadCryptoDeps.js
rm -rf "$WS/astrostudyui/scripts/vendor"
cp -r "$OV/files/astrostudyui/scripts/vendor" "$WS/astrostudyui/scripts/vendor" && ok "scripts/vendor/ ($(find "$WS/astrostudyui/scripts/vendor" -type f | wc -l) files)"

echo "== 2. astropy/requirements.txt — strip the unresolvable flatlib pin (flatlib is vendored via sys.path) =="
if grep -q '^flatlib==' "$WS/astropy/requirements.txt" 2>/dev/null; then
  sed -i '/^flatlib==/d' "$WS/astropy/requirements.txt"; ok "flatlib pin removed"
else ok "flatlib pin already absent"; fi

echo "== 3. astrostudyui/package.json — keep Mac deps, restore Windows name + umi-runner scripts =="
node -e '
const fs=require("fs");
const pkgP=process.argv[1], winP=process.argv[2];
const pkg=JSON.parse(fs.readFileSync(pkgP,"utf8")), win=JSON.parse(fs.readFileSync(winP,"utf8"));
pkg.name=win.name; pkg.scripts=win.scripts;
fs.writeFileSync(pkgP, JSON.stringify(pkg,null,"\t")+"\n");
console.log("  [ok] name="+pkg.name+"; scripts="+Object.keys(pkg.scripts).join(","));
' "$WS/astrostudyui/package.json" "$OV/files/astrostudyui/package.name-scripts.json"

echo "== 4. THIRD_PARTY_NOTICES.md — Mac keeps it at REPO ROOT; Windows needs it in the workspace root =="
if [ -n "$MAC" ] && [ -f "$MAC/../THIRD_PARTY_NOTICES.md" ]; then
  cp "$MAC/../THIRD_PARTY_NOTICES.md" "$WS/THIRD_PARTY_NOTICES.md"; ok "copied from $MAC/../THIRD_PARTY_NOTICES.md"
elif [ -n "$MAC" ] && [ -f "$MAC/THIRD_PARTY_NOTICES.md" ]; then
  cp "$MAC/THIRD_PARTY_NOTICES.md" "$WS/THIRD_PARTY_NOTICES.md"; ok "copied from $MAC/THIRD_PARTY_NOTICES.md"
else warn "Mac clone not given/found — copy THIRD_PARTY_NOTICES.md from the Mac repo root into $WS/ manually"; fi

echo "== 5. source patches (isDesktopShellWindow + ensureField) — applied only if the marker is missing =="
apply_patch(){ # $1=marker $2=target-rel $3=patchfile
  if grep -q "$1" "$WS/$2" 2>/dev/null; then ok "$2 already has $1"; return; fi
  if git apply -p1 --directory="$WS" "$OV/patches/$3" 2>/dev/null || (cd "$WS" && patch -p1 --silent < "$OV/patches/$3" 2>/dev/null); then
    ok "patched $2 ($1)";
  else warn "auto-patch FAILED for $2 — apply the $1 change by hand per windows-adaptations/README.md"; fi
}
apply_patch isDesktopShellWindow astrostudyui/src/utils/windowSizePersistence.js src__utils__windowSizePersistence.js.patch
apply_patch ensureField           astrostudyui/src/pages/index.js                 src__pages__index.js.patch

echo "== 6. backend patch (boundless #14: loopback NEVER via the system proxy) — REQUIRES a jar rebuild =="
apply_patch isLoopbackTarget     astrostudysrv/boundless/src/main/java/boundless/net/http/HttpUriRequestHystrixCommand.java boundless__HttpUriRequestHystrixCommand.java.patch
echo "   ^^ boundless is BACKEND Java. After this patch you MUST rebuild astrostudyboot.jar (SKILL gotcha #5):"
echo "      boundless install -> astrostudy install -> astrostudycn install -> astrostudyboot clean package,"
echo "      then copy target/astrostudyboot.jar to local/workspace/runtime/windows/bundle/. apply.sh does NOT rebuild it,"
echo "      and prepare:runtime's auto-build pulls boundless from .m2 (stale) — so the manual rebuild is mandatory."

echo "== done. Verify: npm run selfcheck (windows-ahead sentinels must be 40/40). =="
