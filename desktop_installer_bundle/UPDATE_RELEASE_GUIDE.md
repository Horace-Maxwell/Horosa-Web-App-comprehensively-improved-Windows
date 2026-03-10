# Reliable Update Flow

To make every installed Horosa Desktop catch updates reliably, use this release flow every time:

1. Commit the desktop release pipeline files to `main` once:
   - `desktop_installer_bundle/`
   - `.github/workflows/desktop-release.yml`
   - `.gitattributes` with the `desktop_installer_bundle/wheelhouse/*.whl` Git LFS rule
2. Bump [version.json](/C:/Users/maxwe/OneDrive/Desktop/Horosa-Web-App-comprehensively-improved-Windows-main/desktop_installer_bundle/version.json) to a newer semantic-like version.
3. Commit the updated files to `main`.
4. Run:

```powershell
pwsh -File .\desktop_installer_bundle\publish_github_release.ps1
```

This does three things in order:
- builds `HorosaPortableWindows-<version>.zip`
- creates or reuses the matching git tag
- pushes the current `main` commit and that tag to GitHub

5. GitHub Actions automatically creates or updates the published GitHub Release for that tag and uploads:
   - `HorosaPortableWindows-<version>.zip`
   - `HorosaPortableWindows-<version>.manifest.json`

If a release ever needs to be repaired without creating a newer version, run the `Horosa Desktop Release` workflow manually and pass the existing tag as `release_tag`. The workflow now checks out that exact tag and overwrites the matching release assets in place.

Why this is reliable:
- The desktop app does not trust GitHub `/latest` anymore.
- It scans the published releases list, filters out draft/prerelease entries, and picks the highest parsed version that has a valid portable zip asset.
- The updater downloads that zip, overlays the installed app files, preserves user data stored in `%LocalAppData%\HorosaDesktop`, and relaunches the desktop app automatically.
- The release workflow fails fast if the pushed git tag does not exactly match `version.json`, so users will not miss an update because of a mismatched version string.
- The release workflow uses `softprops/action-gh-release` to upload the zip and manifest, which is more reliable for large binary assets than the earlier custom REST upload step.
- The offline desktop dependency wheels live in Git LFS, so the release workflow can fetch the same large Windows wheels that the installer expects without breaking normal Git pushes.
- The release workflow runs on Linux to avoid Windows checkout path-length failures while still producing the same portable Windows update zip.

Best practice:
- Keep tags monotonic, for example `2026.03.10.1`, `2026.03.11.1`, `2026.03.11.2`.
- Do not reuse an old tag with a different asset.
- Always update `version.json` before running the publish script.
- If you want to dry-run locally without pushing, use:

```powershell
pwsh -File .\desktop_installer_bundle\publish_github_release.ps1 -SkipPush
```
