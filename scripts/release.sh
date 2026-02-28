#!/usr/bin/env bash
# scripts/release.sh — bump version, tag, publish
# Usage: ./scripts/release.sh [version]
# Example: ./scripts/release.sh 2026.3.1
set -euo pipefail

VERSION=${1:-}

if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>  (e.g. 2026.3.1)"
  exit 1
fi

# Validate calver format
if ! [[ "$VERSION" =~ ^[0-9]{4}\.[0-9]+\.[0-9]+(-patch\.[0-9]+)?$ ]]; then
  echo "Error: version must be YYYY.M.D or YYYY.M.D-patch.N (got: $VERSION)"
  exit 1
fi

echo "→ Releasing openclaw-plugin-tokenranger@$VERSION"

# 1. Bump package.json
node - << EOF
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('  package.json version set to $VERSION');
EOF

# 2. Check CHANGELOG has an entry for this version
if ! grep -q "\[${VERSION}\]" CHANGELOG.md; then
  echo ""
  echo "⚠  No CHANGELOG.md entry found for [$VERSION]."
  echo "   Add a section before continuing:"
  echo ""
  echo "   ## [$VERSION] — $(date +%Y-%m-%d)"
  echo "   ### Changes"
  echo "   - …"
  echo ""
  read -p "Continue anyway? [y/N] " yn
  [[ "$yn" == "y" || "$yn" == "Y" ]] || exit 1
fi

# 3. Commit and tag
git add package.json CHANGELOG.md
git commit -m "release: $VERSION"
git tag "v$VERSION"

echo "→ Pushing to origin..."
git push origin main --tags

echo "→ Publishing to npm..."
npm publish --access public

echo ""
echo "✓ openclaw-plugin-tokenranger@$VERSION published."
echo "  https://www.npmjs.com/package/openclaw-plugin-tokenranger"
echo ""
echo "Next: create a GitHub release with:"
echo "  gh release create v$VERSION --title 'openclaw-plugin-tokenranger $VERSION' --generate-notes"
