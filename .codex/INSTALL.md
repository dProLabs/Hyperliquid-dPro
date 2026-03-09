# Installing Hyperliquid-dPro for Codex

Enable `hyperliquid-dpro` in Codex via native skill discovery.

## Prerequisites

- Git
- Node.js (for running this skill)

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/dProLabs/Hyperliquid-dPro ~/.codex/hyperliquid-dpro
   ```

2. **Install dependencies:**

   ```bash
   cd ~/.codex/hyperliquid-dpro
   npm install
   ```

3. **Create the skills symlink:**

   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/hyperliquid-dpro ~/.agents/skills/hyperliquid-dpro
   ```

   **Windows (PowerShell):**

   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
   cmd /c mklink /J "$env:USERPROFILE\.agents\skills\hyperliquid-dpro" "$env:USERPROFILE\.codex\hyperliquid-dpro"
   ```

4. **Restart Codex** (quit and relaunch the CLI) to discover the skill.

## Verify

```bash
ls -la ~/.agents/skills/hyperliquid-dpro
test -f ~/.agents/skills/hyperliquid-dpro/SKILL.md && echo "OK: SKILL.md found"
```

## Updating

```bash
cd ~/.codex/hyperliquid-dpro && git pull && npm install
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
rm ~/.agents/skills/hyperliquid-dpro
```

Optionally delete the clone:

```bash
rm -rf ~/.codex/hyperliquid-dpro
```
