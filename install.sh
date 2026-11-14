#!/bin/sh
# install p.xel as a self-contained pi skill into ~/.pi/agent/skills/p-xel
# usage: ./install.sh            (override with PI_AGENT_DIR=/path ./install.sh)
set -eu

src=$(cd "$(dirname "$0")" && pwd)
agent=${PI_AGENT_DIR:-$HOME/.pi/agent}
dest=$agent/skills/p-xel

command -v node >/dev/null 2>&1 || { echo "error: node is required" >&2; exit 1; }

# fresh copy: skill instructions, compiler and everything an agent reads
rm -rf "$dest"
mkdir -p "$dest"
for item in SKILL.md xel.js package.json README.md src ai docs knowledge examples; do
  cp -R "$src/$item" "$dest/"
done
chmod +x "$dest/xel.js"

# smoke test: the installed compiler must run
node "$dest/xel.js" "$dest/ai/templates/sprite.xel" --quiet --stats >/dev/null

echo "installed p.xel skill to $dest (run /reload in pi)"
