# Contributing

Thank you for contributing to Horosa for Windows.

## Before you open an issue

- Use [GitHub Discussions](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/discussions) for general usage questions
- Use GitHub Issues for confirmed bugs, regressions, or scoped feature requests
- Include the module, platform, version, and reproduction steps whenever possible

## Pull request workflow

1. Sync from `main`
2. Create a focused branch, preferably `codex/<topic>` or `feature/<topic>`
3. Keep the scope limited and explain affected modules clearly
4. Run the minimum local checks before opening the PR
5. Update docs when behavior, contracts, or release-facing flows change

## Minimum checks before submitting

Frontend workspace:

```bash
cd local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui
npm ci
npm test -- --runInBand src/utils/__tests__/aiAnalysisContext.test.js src/utils/__tests__/aiAnalysisRetrieval.test.js src/utils/__tests__/aiAnalysisStore.test.js src/utils/__tests__/aiProviderAdapters.test.js
npm run build:file
```

Desktop bundle:

```bash
cd desktop_installer_bundle
npm ci
npm run pack:win
```

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

## Security

Do not open public issues for security-sensitive findings. Follow [SECURITY.md](SECURITY.md) instead.
