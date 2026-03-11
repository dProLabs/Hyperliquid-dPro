# Hyperliquid-dPro

An agent skill for **Hyperliquid DEX** and **dPro onchain analytics**.

One skill surface covering market reads, account management, spot/perp/HIP-3 trading, and dPro onchain analytics — built for AI agent environments like **Claude Code**, **OpenClaw**, **Codex**, and **OpenCode**.

---

## Get Started — Tutorials First

If you're new here, **start with the tutorials**. They are designed to take you from zero to productive in four steps, using natural language the whole way.

### [docs/tutorials.md](docs/tutorials.md)

| # | Tutorial | What you'll learn |
|---|----------|-------------------|
| 1 | [Market Radar](docs/tutorial-01-market-radar.md) | Check prices, order books, candles, and top movers with natural language |
| 2 | [Account Radar](docs/tutorial-02-account-radar.md) | Add read-only accounts, monitor positions, balances, orders, and trades |
| 3 | [Onchain Reads](docs/tutorial-03-onchain-reads.md) | Query holder distribution, liquidation heatmaps, and leaderboards |
| 4 | [Trading Desk](docs/tutorial-04-trading-desk.md) | Set up API accounts, transfer funds, and place perp/spot/HIP-3 orders |

> Read tutorials 1–3 before jumping into trading. Building up context first makes the trading flow much easier.

---

## Quick Install

### Clawhub (recommended)

```bash
clawhub install github:dProLabs/Hyperliquid-dPro
```

### Claude Code

```bash
/plugin marketplace add dProLabs/Hyperliquid-dPro
/plugin install dpro-hl
```

Or manually:

```bash
git clone https://github.com/dProLabs/Hyperliquid-dPro.git .claude/skills/dpro-hl
cd .claude/skills/dpro-hl && npm install
```

Then add to your agent config:

```markdown
Skills: .claude/skills/dpro-hl/SKILL.md
```

### Other Environments

| Environment | Config |
|-------------|--------|
| Cursor | `.cursor-plugin/plugin.json` |
| Codex | `.codex/INSTALL.md` |
| OpenCode | `.opencode/INSTALL.md` |

### Local Development

```bash
git clone https://github.com/dProLabs/Hyperliquid-dPro.git
cd Hyperliquid-dPro
npm install
```

---

## What It Can Do

- **Market data** — quotes, books, candles, movers, overview, market listing
- **Account management** — encrypted multi-account storage, balances, positions, orders, fills
- **Trading** — explicit `spot`, `perp`, and `hip3` order namespaces with risk controls
- **Fund transfers** — spot/perp transfer using master-wallet signing
- **Onchain analytics** — mids, holder distribution, liquidation maps, leaderboard (via dPro API)
- **Flexible invocation** — canonical commands, slash-style input, or natural language
- **Programmatic API** — `runHyperliquidSkill(...)` entry point for automation

---

## Usage Examples

```text
dpro-hl quote BTC
dpro-hl book ETH --levels 5
dpro-hl movers --top 5
dpro-hl positions
dpro-hl perp order limit buy 0.01 BTC 50000
dpro-hl transfer 10 --to perp
dpro-hl onchain mids
```

### Programmatic

```js
import { runHyperliquidSkill } from './scripts/entry.mjs';

const quote = await runHyperliquidSkill('dpro-hl quote BTC');
console.log(quote);
```

---

## Reference Docs

| Document | Description |
|----------|-------------|
| [`SKILL.md`](SKILL.md) | Routing, execution, and safety policies |
| [`references/commands.md`](references/commands.md) | Full command surface — all commands, flags, and argument shapes |
| [`references/onchain.md`](references/onchain.md) | Onchain endpoint behavior and normalization |
| [`references/troubleshooting.md`](references/troubleshooting.md) | Symptom-to-fix diagnostic guide |

---

## Safety Highlights

- Live writes require an explicit market namespace: `spot`, `perp`, or `hip3`
- Transfers use the top-level command: `dpro-hl transfer <usd> [--to perp|spot]`
- Private keys are AES-encrypted at rest — never stored in plain text
- Prefer runtime password input over inline password flags
- Onchain reads are read-only (dPro API at `https://api.d.pro/`)

---

## Project Structure

```text
docs/                           # Tutorials — start here
references/                     # Full command + onchain + troubleshooting docs
scripts/
├── entry.mjs                   # Single entry point: runHyperliquidSkill()
├── auto-upgrade.mjs            # Per-invocation auto-upgrade checks
├── parser.mjs                  # Input parsing (command + natural language)
├── router.mjs                  # AST -> command handler dispatch
├── format.mjs                  # Structured result -> text output
├── clients/                    # info / exchange / onchain API clients
├── resolvers/                  # Asset, account, market resolution
├── commands/                   # market / account / trade / transfer / onchain
└── tests/                      # Unit tests (node:test)
```

---

## Referral

Join Hyperliquid: https://app.hyperliquid.xyz/join/DPRO1

## License

MIT
