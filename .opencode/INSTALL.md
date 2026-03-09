# Installing Hyperliquid-dPro for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed
- Git installed
- Node.js installed

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/dProLabs/Hyperliquid-dPro ~/.config/opencode/hyperliquid-dpro
```

### 2. Install Dependencies

```bash
cd ~/.config/opencode/hyperliquid-dpro
npm install
```

### 3. Symlink the Skill

Create a symlink so OpenCode's native skill tool discovers this skill package:

```bash
mkdir -p ~/.config/opencode/skills
rm -rf ~/.config/opencode/skills/hyperliquid-dpro
ln -s ~/.config/opencode/hyperliquid-dpro ~/.config/opencode/skills/hyperliquid-dpro
```

### 4. Restart OpenCode

Restart OpenCode to reload discovered skills and instructions.

## Verify

```bash
ls -la ~/.config/opencode/skills/hyperliquid-dpro
test -f ~/.config/opencode/skills/hyperliquid-dpro/SKILL.md && echo "OK: SKILL.md found"
```

## Updating

```bash
cd ~/.config/opencode/hyperliquid-dpro && git pull && npm install
```

For git-clone installs, this skill also performs auto-upgrade checks on every invocation:
- Checks `origin/<current-branch>` and applies `git pull --ff-only`
- Runs `npm install --silent` after a successful pull
- Does not block your command on failure (warning only)

For clawhub-managed installs, auto-upgrade runs:
- `clawhub update <skill-slug>` on a configurable check interval (default 15 minutes)
- Does not block your command on failure (warning only)

Disable or tune auto-upgrade:

```bash
export HL_AUTO_UPGRADE=0
export HL_AUTO_UPGRADE_TIMEOUT_MS=2000
export HL_AUTO_UPGRADE_PROVIDER=auto
export HL_AUTO_UPGRADE_CHECK_INTERVAL_MS=900000
export HL_AUTO_UPGRADE_CLAWHUB_CMD=clawhub
export HL_AUTO_UPGRADE_DISABLE_NPM=1
```

## Uninstalling

```bash
rm -rf ~/.config/opencode/skills/hyperliquid-dpro
```

Optionally delete the clone:

```bash
rm -rf ~/.config/opencode/hyperliquid-dpro
```

## Troubleshooting

1. If the skill is not found, verify the symlink target:
   - `ls -l ~/.config/opencode/skills/hyperliquid-dpro`
2. Confirm root `SKILL.md` exists:
   - `ls ~/.config/opencode/hyperliquid-dpro/SKILL.md`
3. Restart OpenCode after changes.
