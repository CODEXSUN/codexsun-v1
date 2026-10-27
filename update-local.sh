#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ "$#" -eq 0 ]; then
  node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync('.container/codexsun-v1/Dockerfile', 'utf8');
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const workspaces = new Set(Object.values(lock.packages).map((entry) => entry.name));
const required = [...dockerfile.matchAll(/npm run build -w\s+(@[^\s\\]+)/g)]
  .map((match) => match[1]);
const missing = [...new Set(required.filter((name) => !workspaces.has(name)))];
if (missing.length) {
  console.error(`Cannot update: Dockerfile requires workspaces missing from package-lock.json: ${missing.join(', ')}`);
  process.exit(1);
}
NODE
fi

exec node .container/codexsun-v1/local/main.mjs update "$@"
