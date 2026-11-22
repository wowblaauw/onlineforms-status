#!/bin/bash
# Abel's five-minute OnlineForms check, run by launchd on the iMac
# (~/Library/LaunchAgents/app.onlineforms.abel-check.plist). It runs check.mjs from a clone of
# this repository and pushes status.json / abel.json when they change. No secrets are used;
# the push uses a deploy key for this repository only (~/.ssh/onlineforms_status_abel).
set -u
REPO="$HOME/onlineforms-watch/repo"
NODE=/usr/local/bin/node
cd "$REPO" || exit 1
git pull -q --rebase 2>/dev/null
CHECKER=abel "$NODE" check.mjs > "$HOME/onlineforms-watch/last-run.json" 2>&1
if [ -n "$(git status --porcelain status.json abel.json)" ]; then
  git add status.json abel.json
  git -c user.name="Abel (iMac)" -c user.email="abel@onlineforms.invalid" commit -q -m "Status from Abel: $(grep -q '"ok": true' status.json && echo 'all working' || echo 'problem detected')"
  git push -q 2>/dev/null || { git pull -q --rebase && git push -q; }
fi
