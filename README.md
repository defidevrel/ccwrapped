# ccwrapped

Your year in code, visualized. A Spotify Wrapped-style experience for Claude Code users.

[![License](https://img.shields.io/github/license/defidevrel/ccwrapped?v=2)](LICENSE)
[![Stars](https://img.shields.io/github/stars/defidevrel/ccwrapped?v=2)](https://github.com/defidevrel/ccwrapped/stargazers)

![Claude Code Wrapped Preview](og-preview.png)

## Quick Start

Run this in your terminal (requires Node.js 18+):

```bash
npx ccwrapped-cli
```

That's it. The CLI scans your local Claude Code sessions, computes your stats, and opens your wrapped page in the browser.

### Options

```bash
npx ccwrapped-cli --dry-run    # Preview the JSON payload without uploading
npx ccwrapped-cli --verbose     # Show debug output
```

### Manual Paste

If you prefer, run `npx ccwrapped-cli --dry-run` and paste the output JSON at [ccwrapped-phi.vercel.app/submit](https://ccwrapped-phi.vercel.app/submit).

---

## What is Claude Code Wrapped?

Claude Code Wrapped analyzes your local session data and generates a shareable visualization of your coding stats, patterns, and personality archetype.

| What You Get | What It Shows |
|--------------|---------------|
| **Stats overview** | Sessions, messages, hours, commits, lines changed |
| **Tool usage** | Which tools you use most (Read, Edit, Bash, etc.) |
| **Time patterns** | When you code - peak hours, busiest days |
| **Coding archetype** | Your personality type based on usage patterns |
| **Highlights** | Streaks, busiest day, longest session |

### The 12 Archetypes

| Archetype | Description |
|-----------|-------------|
| Night Owl | Burns the midnight oil |
| Marathoner | Long, focused sessions |
| Sprinter | Quick, efficient bursts |
| Bug Hunter | Finds and fixes issues |
| Builder | Creates new features |
| Tool Master | Uses the full toolkit |
| Delegator | Leverages agents effectively |
| Streak Master | Consistent daily coding |
| Polyglot | Works across many projects |
| Deep Diver | Thorough, methodical work |
| Explorer | Investigates and discovers |
| Pair Programmer | High-volume collaboration |

---

## Privacy

**Only aggregate stats are shared:**
- Session counts, message counts, hours spent
- Tool usage counts
- Time patterns (hours/days)
- Streaks and highlight dates

**Never shared:**
- Your actual code
- Prompts or conversations
- File paths or project names
- Any content from your sessions

Your wrapped page is shareable - it contains only anonymous statistics.

---

## Tech Stack

The web app at [ccwrapped-phi.vercel.app](https://ccwrapped-phi.vercel.app) is built with:

- **Framework:** Next.js 16 with App Router
- **UI:** React 19, Tailwind CSS v4, Radix UI
- **Animation:** Motion library
- **Storage:** Vercel KV
- **Image Generation:** Sharp for OG images

---

## Development

```bash
# Install dependencies
bun install

# Run dev server
bun dev

# Build for production
bun run build
```

---

## License

MIT - see [LICENSE](LICENSE)

---

<p align="center">
  <sub>Not affiliated with Anthropic</sub>
</p>
