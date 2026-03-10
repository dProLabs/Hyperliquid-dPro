# Installing via Clawhub

Use Clawhub to install this skill package from the repository:

```bash
clawhub install github:dProLabs/Hyperliquid-dPro
```

Update:

```bash
clawhub update github:dProLabs/Hyperliquid-dPro
```

Uninstall:

```bash
clawhub uninstall dpro-hl
```

## Auto-upgrade

For clawhub-managed installs, the skill can auto-run:

```bash
clawhub update <skill-slug>
```

Controls:

```bash
export DPRO_HL_AUTO_UPGRADE_PROVIDER=auto
export DPRO_HL_AUTO_UPGRADE_CHECK_INTERVAL_MS=900000
export DPRO_HL_AUTO_UPGRADE_CLAWHUB_CMD=clawhub
```
