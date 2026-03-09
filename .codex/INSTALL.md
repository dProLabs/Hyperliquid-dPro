# Installing Hyperliquid-dPro for Codex

Enable `dpro-hl` in Codex via native skill discovery.

## Prerequisites

- Git
- Node.js (for running this skill)

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/dProLabs/Hyperliquid-dPro ~/.codex/dpro-hl
   ```

2. **Install dependencies:**

   ```bash
   cd ~/.codex/dpro-hl
   npm install
   ```

3. **Create the skills symlink:**

   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/dpro-hl ~/.agents/skills/dpro-hl
   ```

   **Windows (PowerShell):**

   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
   cmd /c mklink /J "$env:USERPROFILE\.agents\skills\dpro-hl" "$env:USERPROFILE\.codex\dpro-hl"
   ```

4. **Restart Codex** (quit and relaunch the CLI) to discover the skill.

## Verify

```bash
ls -la ~/.agents/skills/dpro-hl
test -f ~/.agents/skills/dpro-hl/SKILL.md && echo "OK: SKILL.md found"
```

## Updating

```bash
cd ~/.codex/dpro-hl && git pull && npm install
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
export DPRO_HL_AUTO_UPGRADE=0
export DPRO_HL_AUTO_UPGRADE_TIMEOUT_MS=2000
export DPRO_HL_AUTO_UPGRADE_PROVIDER=auto
export DPRO_HL_AUTO_UPGRADE_CHECK_INTERVAL_MS=900000
export DPRO_HL_AUTO_UPGRADE_CLAWHUB_CMD=clawhub
export DPRO_HL_AUTO_UPGRADE_DISABLE_NPM=1
```

## Uninstalling

```bash
rm ~/.agents/skills/dpro-hl
```

Optionally delete the clone:

```bash
rm -rf ~/.codex/dpro-hl
```
