#!/usr/bin/env bash
# Standalone synthetic demo. Node 20+ and npm are the only prerequisites.
set -euo pipefail
cd "$(dirname "$0")/frontend"
command -v node >/dev/null || { echo "Install Node.js 20+ to run the demo."; exit 1; }
command -v npm >/dev/null || { echo "Install npm to run the demo."; exit 1; }
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) { console.error("Node.js 20+ is required."); process.exit(1); }'
if [[ ! -d node_modules ]]; then npm ci --no-audit --no-fund; fi
echo "Starting CrimeNet synthetic demo. No databases, API keys or Docker required."
exec npm run demo -- "$@"
