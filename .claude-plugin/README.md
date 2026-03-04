### Plugin Manifest Notes

The `.claude-plugin/plugin.json` follows Claude Code plugin manifest requirements:

- `version` is required
- component fields such as `skills`, `agents`, and `commands` should be arrays
- `skills` accepts directory paths when declared as array entries
- no `hooks` field is declared (this repository has no hooks package)

This plugin declares only `skills` because the repository is a single-skill package rooted at `./SKILL.md`.
