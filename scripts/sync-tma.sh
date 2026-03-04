#!/bin/bash
# Sync tma/src/index.html → tma.html (master copy)
set -e

MASTER="/workspace/tma/src/index.html"
TARGET="/workspace/tma.html"

echo "Syncing $MASTER → $TARGET"
cp "$MASTER" "$TARGET"

echo "Committing..."
cd /workspace
git add tma.html tma/src/index.html
git commit -m "sync: update tma.html from master tma/src/index.html" || echo "Nothing to commit"
echo "Done!"
