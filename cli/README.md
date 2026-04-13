# @defidevrel/ccwrapped

CLI tool that generates your Claude Code Wrapped — a Spotify Wrapped-style visualization of your coding stats, patterns, and personality archetype.

## Usage

```bash
npx @defidevrel/ccwrapped
```

The CLI scans your local `~/.claude/projects` session files, computes aggregate stats, uploads them, and opens your wrapped page in the browser.

## Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview the JSON payload without uploading |
| `--verbose` | Show debug output during scanning |
| `--api <url>` | Use a custom API URL (defaults to `https://ccwrapped.com`) |

## What it does

1. Discovers all session JSONL files in `~/.claude/projects`
2. Parses each session for timing, message counts, tool usage, and git activity
3. Aggregates stats across all sessions
4. Determines your coding archetype (one of 12 types)
5. Submits the payload to the ccwrapped API
6. Opens your personalized wrapped page in the browser

## Privacy

Only aggregate stats are collected and uploaded:

- Session counts, message counts, hours spent
- Tool usage counts (Read, Edit, Bash, etc.)
- Time patterns (peak hours and days)
- Streaks and highlight dates

**Never collected:** your code, prompts, file paths, or project names.

## Requirements

- Node.js 18+
- Claude Code installed with at least one session in `~/.claude/projects`

## License

MIT
