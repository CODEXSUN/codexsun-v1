#!/usr/bin/env sh
set -eu

exec node --import ./tools/register-production-package-resolution.mjs dist/apps/platform/api/server.js
