# ccwrapped-cli

CLI that generates **Code Wrapped** — a Spotify Wrapped–style view of your coding stats, patterns, and a personality **archetype**. It reads local **Claude Code** and **Cursor** session transcripts, aggregates metrics, sends them to the ccwrapped API, and opens your shareable page in the browser.

**Package:** [`ccwrapped-cli`](https://www.npmjs.com/package/ccwrapped-cli) on npm · **Binary:** `ccwrapped` · **Node:** 18+

## Install & run

```bash
# One-off (recommended)
npx ccwrapped-cli

# Global CLI
npm install -g ccwrapped-cli
ccwrapped
```

From a clone of this repo:

```bash
node bin/ccwrapped.mjs
```

## Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Print the JSON payload and exit (no upload, no browser) |
| `--verbose` | Log debug lines while scanning and parsing |
| `--api <url>` | API origin (default: `https://ccwrapped-phi.vercel.app`). Requests go to `<url>/api/wrapped`. |

There is no config file; flags are the only CLI configuration.

## What gets scanned

The tool looks for session **JSONL** files in your home directory:

| Source | Location | Notes |
|--------|------------|--------|
| **Claude Code** | `~/.claude/projects/**/*.jsonl` | Recursive up to depth 3. Files whose names start with `agent-` are skipped. |
| **Cursor** | `~/.cursor/projects/*/agent-transcripts/*/*.jsonl` | Skips paths under `subagents`. |

You need at least one of `~/.claude/projects` or `~/.cursor/projects` to exist, and enough **valid** sessions (see below) or the CLI exits with an error.

### When a session counts as “valid”

- **Claude:** At least two timestamped user/assistant entries; estimated duration is the sum of gaps between consecutive timestamps, with each gap capped at **2 hours**. Sessions shorter than **1 minute** total are dropped.
- **Cursor:** Transcripts often lack per-message timestamps. The CLI uses the file **mtime** as the session date and estimates duration from entry count (~**1.5 minutes** per transcript line). Sessions with fewer than **2** entries are dropped.

Parsed sessions contribute: user message counts, **tool_use** tallies (e.g. Read, Edit, Bash/Shell), inferred **git commit** counts from Bash/Shell commands containing `git commit`, and **lines changed** when git output appears in tool results (Claude path).

## What gets computed

After aggregation, the CLI builds a **version 1** payload with:

- **stats** — sessions, messages, hours, active days, commits, lines changed  
- **tools** — counts per tool name across sessions  
- **timePatterns** — hour/day distributions, peak hour, peak day  
- **projectCount** — number of distinct project directories under the Claude/Cursor project roots (only the **count** is sent, not names)  
- **goals** — rough categories from **your user message text** using keyword buckets: bug fix, feature, refactor, devops, docs, explore, test, plus `other`  
- **highlights** — e.g. busiest day, longest streak, longest session, rarest tool, first session date, top tool  
- **streaks** — current streak, longest streak, total active days  
- **archetype** — one label from the rules below  

## Archetypes

The CLI assigns one archetype from heuristic rules (examples: night-heavy usage, long average sessions, bug-fix vs feature keywords, tool diversity, Task tool usage, streaks, project count, etc.). Possible values include:

`night_owl`, `marathoner`, `sprinter`, `bug_hunter`, `builder`, `tool_master`, `delegator`, `streak_master`, `polyglot`, `deep_diver`, `explorer`, `pair_programmer`

(Exact mapping is implemented in `bin/ccwrapped.mjs` → `determineArchetype`.)

## Upload & browser

1. `POST {API}/api/wrapped` with the JSON body.  
2. On success, the response includes a **`slug`**; the CLI opens `{API}/w/{slug}` with `open` / `start` / `xdg-open` depending on OS.  
3. If upload fails, the CLI prints the error, shows **`{API}/submit`** for manual paste, and prints the same JSON payload.

## Privacy

Only **aggregated** metrics are uploaded: counts (sessions, messages, tools, goals by category, etc.), distributions, and derived highlights. Goal categories are computed **locally** from your user message text using keyword rules; the payload contains **counts per category only**, not the messages themselves. The CLI does not send your source code or repository file paths.

## Troubleshooting

| Symptom | What to try |
|---------|----------------|
| No session data | Use Claude Code and/or Cursor so `~/.claude/projects` or `~/.cursor/projects` is populated. |
| No valid sessions | Longer chats; Claude sessions need enough messages and duration; Cursor needs enough transcript lines. |
| Upload failed | Use `--dry-run` to inspect JSON; paste at `{API}/submit` if the service is up but the CLI request failed (network, TLS, etc.). |
| Wrong API | `--api http://localhost:3000` (or your deployment) for local/dev servers. |

## License

MIT
