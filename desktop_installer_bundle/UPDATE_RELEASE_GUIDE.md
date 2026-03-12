# Reliable Update Flow

To make every installed Horosa Desktop catch updates reliably, use this release flow every time:

1. Commit the desktop release pipeline files to `main` once:
   - `desktop_installer_bundle/`
   - `.github/workflows/desktop-release.yml`
2. Bump [version.json](/C:/Users/maxwe/OneDrive/Desktop/Horosa-Web-App-comprehensively-improved-Windows-main/desktop_installer_bundle/version.json) to a newer semantic-like version.
3. Commit the updated files to `main`.
4. Run:

```powershell
pwsh -File .\desktop_installer_bundle\publish_github_release.ps1
```

This does three things in order:
- builds `XingqueSetup.exe`
- builds `HorosaPortableWindows-<version>.zip`
- builds `HorosaRuntimeWindows-<version>.zip`
- creates or reuses the matching git tag
- pushes the current `main` commit and that tag to GitHub

5. GitHub Actions automatically creates or updates the published GitHub Release for that tag and uploads:
   - `XingqueSetup.exe`
   - `HorosaPortableWindows-<version>.zip`
   - `HorosaRuntimeWindows-<version>.zip`
   - `HorosaRuntimeWindows-<version>.manifest.json`

If a release ever needs to be repaired without creating a newer version, run the `Horosa Desktop Release` workflow manually and pass the existing tag as `release_tag`. The workflow now checks out that exact tag and overwrites the matching release assets in place.

Why this is reliable:
- The desktop app does not trust GitHub `/latest` anymore.
- It scans the published releases list, filters out draft/prerelease entries, and picks the highest parsed version that has a valid portable zip asset.
- Ordinary users download `XingqueSetup.exe`, while the installer downloads the larger `HorosaRuntimeWindows-<version>.zip` on demand during first install or runtime refresh.
- The portable zip stays on the release as an internal support asset for the updater chain.
- The updater downloads that zip, overlays the installed app files, preserves user data stored in `%LocalAppData%\HorosaDesktop`, and relaunches the desktop app automatically.
- The release workflow fails fast if the pushed git tag does not exactly match `version.json`, so users will not miss an update because of a mismatched version string.
- The release workflow uses `softprops/action-gh-release` to upload the zip and manifest, which is more reliable for large binary assets than the earlier custom REST upload step.
- The offline dependency wheels and runtime jar are prepared during the release build, so normal repo clone/pull traffic no longer burns Git LFS bandwidth.

Best practice:
- Keep tags monotonic, for example `2026.03.10.1`, `2026.03.11.1`, `2026.03.11.2`.
- Do not reuse an old tag with a different asset.
- Always update `version.json` before running the publish script.
- If you want to dry-run locally without pushing, use:

```powershell
pwsh -File .\desktop_installer_bundle\publish_github_release.ps1 -SkipPush
```
