#!/usr/bin/env bash
# Publishes the built game (dist/) to the gh-pages branch, which GitHub Pages serves.
# Run through `npm run deploy`, which tests and builds first.
set -euo pipefail
cd "$(dirname "$0")/.."

repo=$(pwd)
commit=$(git rev-parse --short HEAD)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

cp -r dist/. "$work"
touch "$work/.nojekyll" # serve files as they are, with no site-generator pass
cd "$work"
git init -q -b gh-pages
git config user.name "$(git -C "$repo" config user.name)"
git config user.email "$(git -C "$repo" config user.email)"
git add -A
git commit -q -m "Deploy $commit"
# Hand the commit to the main checkout and push from there, so its saved GitHub login is used.
cd "$repo"
git fetch -q --force "$work" gh-pages:gh-pages
if command -v gh >/dev/null; then
  # Use the GitHub CLI's login for this push, whatever git's own saved credentials are.
  git -c credential.helper= -c credential.helper='!gh auth git-credential' push -q --force origin gh-pages
else
  git push -q --force origin gh-pages
fi
echo "Published $commit to gh-pages"
