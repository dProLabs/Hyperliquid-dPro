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
