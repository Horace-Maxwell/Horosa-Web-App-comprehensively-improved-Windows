# Contributing

Thank you for contributing to Horosa for Windows.

## Before you open an issue

- Use [GitHub Discussions](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/discussions) for general usage questions
- Use GitHub Issues for confirmed bugs, regressions, or scoped feature requests
- Include the module, platform, version, and reproduction steps whenever possible

## Pull request workflow

1. Sync from `main`
2. Create a focused branch, preferably `fix/<topic>` or `feature/<topic>`
3. Keep the scope limited and explain affected modules clearly
4. Run the minimum local checks before opening the PR
5. Update docs when behavior, contracts, or release-facing flows change

## Minimum checks before submitting

The full product source ships under `local/workspace/Horosa-Web-…/`. For a frontend change, build + test from its workspace:

```bash
cd local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui
npm ci
npm run build:file
```

The backend is a multi-module Maven project driven by the aggregator pom (`astrostudysrv/pom.xml`); its `<modules>` list is the only module list. Always build and test through the aggregator:

```bash
cd local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c
# Build every module from source in dependency order and produce astrostudyboot/target/astrostudyboot.jar
# (this one command is all a clean machine needs)
mvn -f astrostudysrv/pom.xml -DskipTests clean install
# Run the unit tests of selected modules (-am compiles the sibling modules they depend on in the same build)
mvn -f astrostudysrv/pom.xml test -pl boundless,astrostudy -am
```

Do not `cd` into a module and install modules one by one: on a clean machine the local repository has neither the parent pom nor the sibling modules, so the second module fails to resolve; on an existing machine it silently links stale copies from `~/.m2`.

For docs / governance / [`prepareruntime/`](prepareruntime/) / [`windows-adaptations/`](windows-adaptations/) changes, verify links and relative paths still resolve. (The desktop packaging project — Electron + NSIS — is maintained privately and is not part of this repo.)

## Required doc sync

If your change touches any of the following, update the matching docs in the same PR:

- README / onboarding / release-facing behavior
- License or repository governance files
- API contracts or provider compatibility notes
- AIAnalysis data model, backup format, workspace migration, or export format

## AIAnalysis-specific rules

If a change affects `AIAnalysis`, you must also update:

- the README feature description
- release notes or release body draft
- any relevant migration or compatibility note

If a change affects provider behavior, storage schema, or backup / restore format, call out:

- migration risk
- compatibility impact on existing workspaces
- whether exported backups remain forward / backward compatible

## Commit style

Small, reviewable commits are preferred. Use imperative commit subjects, for example:

- `Add Windows AIAnalysis backup zip support`
- `Fix AIAnalysis layout gap under default scale`


## Licensing Note

Horosa is now on an explicit AGPL-3.0 open-source release track. The repository-level license is [AGPL-3.0](LICENSE). This change is aligned with the public release stack that integrates Swiss Ephemeris / `pyswisseph`. Third-party subdirectories may continue to carry their own original upstream notices, so do not overwrite those files when preparing contributions.

## Security

Do not open public issues for security-sensitive findings. Follow [SECURITY.md](SECURITY.md) instead.
