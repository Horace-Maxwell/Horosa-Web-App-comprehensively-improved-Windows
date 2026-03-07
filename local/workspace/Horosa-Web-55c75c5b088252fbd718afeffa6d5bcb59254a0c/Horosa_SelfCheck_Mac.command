#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
exec "${ROOT}/scripts/mac/self_check_horosa.sh" "$@"
