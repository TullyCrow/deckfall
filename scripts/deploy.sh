#!/usr/bin/env bash
# Publishes the built game (dist/) to the gh-pages branch, which GitHub Pages serves.
# Run through `npm run deploy`, which tests and builds first.
set -euo pipefail
cd "$(dirname "$0")/.."

remote=$(git remote get-url origin)
commit=$(git rev-parse --short HEAD)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

cp -r dist/. "$work"
touch "$work/.nojekyll" # serve files as they are, with no site-generator pass
cd "$work"
git init -q -b gh-pages
git config user.name "$(git -C "$OLDPWD" config user.name)"
git config user.email "$(git -C "$OLDPWD" config user.email)"
git add -A
git commit -q -m "Deploy $commit"
git push -q --force "$remote" gh-pages
echo "Published $commit to gh-pages"
