#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import { exec } from "child_process";
import { request } from "https";
import { request as httpRequest } from "http";

const API_URL =
  process.argv.includes("--api") ?
    process.argv[process.argv.indexOf("--api") + 1] :
    "https://ccwrapped.defidevrel.xyz";

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");

const GAP_CAP_MS = 120 * 60 * 1000; // 2 hours in ms
const MIN_SESSION_ENTRIES = 2;
const MIN_SESSION_DURATION_MS = 60 * 1000; // 1 minute

const GOAL_KEYWORDS = {
  bug_fix: ["fix", "bug", "error", "issue", "broken", "crash", "fail"],
  feature: ["add", "implement", "create", "build", "new", "feature"],
  refactor: ["refactor", "clean", "improve", "reorganize", "simplify"],
  devops: ["deploy", "ci", "docker", "pipeline", "kubernetes", "infra"],
  docs: ["document", "readme", "comment", "jsdoc", "explain"],
  explore: ["find", "search", "where", "how", "what", "understand"],
  test: ["test", "spec", "coverage", "jest", "pytest", "assertion"],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`  ${msg}`);
}

function verbose(msg) {
  if (VERBOSE) console.log(`  [debug] ${msg}`);
}

function bold(s) { return `\x1b[1m${s}\x1b[0m`; }
function purple(s) { return `\x1b[35m${s}\x1b[0m`; }
function dim(s) { return `\x1b[2m${s}\x1b[0m`; }
function green(s) { return `\x1b[32m${s}\x1b[0m`; }

function toDateStr(ts) {
  return new Date(ts).toISOString().split("T")[0];
}

const AVG_MINUTES_PER_MESSAGE = 1.5;

// ── Step 1: Discover session files ───────────────────────────────────────────

function discoverSessionFiles() {
  const claudeDir = join(homedir(), ".claude", "projects");
  const cursorDir = join(homedir(), ".cursor", "projects");
  const claudeExists = existsSync(claudeDir);
  const cursorExists = existsSync(cursorDir);

  if (!claudeExists && !cursorExists) {
    console.error(`\n  ✗ Could not find session data.`);
    console.error(`    Checked: ~/.claude/projects and ~/.cursor/projects`);
    console.error(`    Make sure you have Claude Code or Cursor installed and have used it at least once.\n`);
    process.exit(1);
  }

  const files = [];

  // Claude Code: ~/.claude/projects/**/*.jsonl (excluding agent-*)
  if (claudeExists) {
    function walkClaude(dir, depth) {
      if (depth > 3) return;
      let entries;
      try { entries = readdirSync(dir, { withFileTypes: true }); }
      catch { return; }

      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walkClaude(full, depth + 1);
        } else if (
          entry.name.endsWith(".jsonl") &&
          !entry.name.startsWith("agent-")
        ) {
          files.push({ path: full, source: "claude" });
        }
      }
    }
    walkClaude(claudeDir, 0);
  }

  // Cursor: ~/.cursor/projects/*/agent-transcripts/*/*.jsonl (excluding subagents)
  if (cursorExists) {
    try {
      const projectDirs = readdirSync(cursorDir, { withFileTypes: true })
        .filter((e) => e.isDirectory());

      for (const proj of projectDirs) {
        const transcriptsDir = join(cursorDir, proj.name, "agent-transcripts");
        if (!existsSync(transcriptsDir)) continue;

        let sessions;
        try { sessions = readdirSync(transcriptsDir, { withFileTypes: true }); }
        catch { continue; }

        for (const sess of sessions) {
          if (!sess.isDirectory()) continue;
          const sessDir = join(transcriptsDir, sess.name);
          if (sessDir.includes("subagents")) continue;

          let jsonlFiles;
          try { jsonlFiles = readdirSync(sessDir); }
          catch { continue; }

          for (const fn of jsonlFiles) {
            if (fn.endsWith(".jsonl")) {
              files.push({ path: join(sessDir, fn), source: "cursor" });
            }
          }
        }
      }
    } catch { /* ignore */ }
  }

  return files;
}

// ── Step 2 & 3: Parse sessions ───────────────────────────────────────────────

function extractMessageText(msg) {
  if (!msg || !msg.content) return "";
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(" ");
  }
  return "";
}

function parseClaudeSession(filepath) {
  let content;
  try { content = readFileSync(filepath, "utf-8"); }
  catch { return null; }

  const lines = content.split("\n").filter(Boolean);
  const timestamps = [];
  let userMessages = 0;
  const toolCounts = {};
  let gitCommits = 0;
  let linesChanged = 0;
  const userMessageTexts = [];

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); }
    catch { continue; }

    const type = entry.type;

    if (type === "user" || type === "assistant") {
      if (entry.timestamp) {
        timestamps.push(new Date(entry.timestamp).getTime());
      }
    }

    if (type === "user" && !entry.isMeta) {
      userMessages++;
      const text = extractMessageText(entry.message);
      if (text) userMessageTexts.push(text.toLowerCase());
    }

    if (type === "assistant" && entry.message && Array.isArray(entry.message.content)) {
      for (const block of entry.message.content) {
        if (block.type === "tool_use") {
          const name = block.name || "unknown";
          toolCounts[name] = (toolCounts[name] || 0) + 1;

          if (name === "Bash" && block.input && typeof block.input.command === "string") {
            if (block.input.command.includes("git commit")) {
              gitCommits++;
            }
          }
        }
      }
    }

    if (type === "user" && entry.toolUseResult && entry.toolUseResult.stdout) {
      const stdout = entry.toolUseResult.stdout;
      const insertions = [...stdout.matchAll(/(\d+) insertions?\(\+\)/g)];
      const deletions = [...stdout.matchAll(/(\d+) deletions?\(-\)/g)];
      for (const m of insertions) linesChanged += parseInt(m[1], 10);
      for (const m of deletions) linesChanged += parseInt(m[1], 10);
    }
  }

  if (timestamps.length < MIN_SESSION_ENTRIES) return null;

  timestamps.sort((a, b) => a - b);

  let durationMs = 0;
  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i] - timestamps[i - 1];
    durationMs += Math.min(gap, GAP_CAP_MS);
  }

  if (durationMs < MIN_SESSION_DURATION_MS) return null;

  return {
    startTime: timestamps[0],
    endTime: timestamps[timestamps.length - 1],
    durationMinutes: durationMs / 60000,
    userMessages,
    toolCounts,
    gitCommits,
    linesChanged,
    userMessageTexts,
  };
}

function parseCursorSession(filepath) {
  let content;
  try { content = readFileSync(filepath, "utf-8"); }
  catch { return null; }

  const lines = content.split("\n").filter(Boolean);
  let userMessages = 0;
  let totalEntries = 0;
  const toolCounts = {};
  let gitCommits = 0;
  let linesChanged = 0;
  const userMessageTexts = [];

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); }
    catch { continue; }

    const role = entry.role;
    if (!role) continue;
    totalEntries++;

    if (role === "user") {
      userMessages++;
      const text = extractMessageText(entry.message);
      if (text) userMessageTexts.push(text.toLowerCase());
    }

    if (role === "assistant" && entry.message && Array.isArray(entry.message.content)) {
      for (const block of entry.message.content) {
        if (block.type === "tool_use") {
          const name = block.name || "unknown";
          toolCounts[name] = (toolCounts[name] || 0) + 1;

          if ((name === "Shell" || name === "Bash") && block.input) {
            const cmd = block.input.command || "";
            if (cmd.includes("git commit")) gitCommits++;
          }
        }
      }
    }
  }

  if (totalEntries < MIN_SESSION_ENTRIES) return null;

  // Cursor transcripts lack timestamps — use file mtime as session date
  // and estimate duration from message count
  let fileMtime;
  try { fileMtime = statSync(filepath).mtimeMs; }
  catch { return null; }

  const estimatedMinutes = totalEntries * AVG_MINUTES_PER_MESSAGE;
  if (estimatedMinutes < 1) return null;

  return {
    startTime: fileMtime,
    endTime: fileMtime,
    durationMinutes: estimatedMinutes,
    userMessages,
    toolCounts,
    gitCommits,
    linesChanged,
    userMessageTexts,
  };
}

function parseSession(filepath, source) {
  return source === "cursor"
    ? parseCursorSession(filepath)
    : parseClaudeSession(filepath);
}

// ── Step 4: Aggregate ────────────────────────────────────────────────────────

function aggregate(sessions) {
  let totalMessages = 0;
  let totalHours = 0;
  let totalCommits = 0;
  let totalLinesChanged = 0;
  const allTools = {};
  const hourDist = {};
  const dayDist = {};
  const dateCounts = {};
  const allTexts = [];
  let longestSessionMin = 0;
  let firstDate = Infinity;

  for (const s of sessions) {
    totalMessages += s.userMessages;
    totalHours += s.durationMinutes / 60;
    totalCommits += s.gitCommits;
    totalLinesChanged += s.linesChanged;
    longestSessionMin = Math.max(longestSessionMin, s.durationMinutes);

    if (s.startTime < firstDate) firstDate = s.startTime;

    for (const [tool, count] of Object.entries(s.toolCounts)) {
      allTools[tool] = (allTools[tool] || 0) + count;
    }

    const d = new Date(s.startTime);
    const hour = d.getHours();
    const day = d.getDay();
    const dateStr = toDateStr(s.startTime);

    hourDist[hour] = (hourDist[hour] || 0) + s.userMessages;
    dayDist[day] = (dayDist[day] || 0) + s.userMessages;
    dateCounts[dateStr] = (dateCounts[dateStr] || 0) + s.userMessages;

    allTexts.push(...s.userMessageTexts);
  }

  // Peak hour / day
  let peakHour = 0, peakHourCount = 0;
  for (const [h, c] of Object.entries(hourDist)) {
    if (c > peakHourCount) { peakHour = parseInt(h); peakHourCount = c; }
  }
  let peakDay = 0, peakDayCount = 0;
  for (const [d, c] of Object.entries(dayDist)) {
    if (c > peakDayCount) { peakDay = parseInt(d); peakDayCount = c; }
  }

  // Goals
  const goals = { bug_fix: 0, feature: 0, refactor: 0, devops: 0, docs: 0, explore: 0, test: 0, other: 0 };
  for (const text of allTexts) {
    let matched = false;
    for (const [category, keywords] of Object.entries(GOAL_KEYWORDS)) {
      if (keywords.some((kw) => text.includes(kw))) {
        goals[category]++;
        matched = true;
        break;
      }
    }
    if (!matched) goals.other++;
  }

  // Highlights
  let busiestDay = "", busiestDayMessages = 0;
  for (const [date, count] of Object.entries(dateCounts)) {
    if (count > busiestDayMessages) { busiestDay = date; busiestDayMessages = count; }
  }

  // Top / rarest tool
  let topToolName = "Read", topToolCount = 0;
  let rarestTool = "Unknown", rarestCount = Infinity;
  for (const [name, count] of Object.entries(allTools)) {
    if (count > topToolCount) { topToolName = name; topToolCount = count; }
    if (count < rarestCount && count >= 1) { rarestTool = name; rarestCount = count; }
  }

  // Streaks
  const activeDates = Object.keys(dateCounts).sort();
  const totalActiveDays = activeDates.length;

  let longestStreak = 0, currentStreak = 0;
  if (activeDates.length > 0) {
    let streak = 1;
    for (let i = 1; i < activeDates.length; i++) {
      const prev = new Date(activeDates[i - 1]);
      const curr = new Date(activeDates[i]);
      const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        streak++;
      } else {
        longestStreak = Math.max(longestStreak, streak);
        streak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, streak);

    // Current streak (ending today)
    const today = toDateStr(Date.now());
    if (activeDates.includes(today)) {
      currentStreak = 1;
      for (let i = activeDates.indexOf(today) - 1; i >= 0; i--) {
        const curr = new Date(activeDates[i + 1]);
        const prev = new Date(activeDates[i]);
        if ((curr - prev) / (1000 * 60 * 60 * 24) === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
  }

  // Project count (from both Claude Code and Cursor)
  const projectDirs = new Set();
  for (const base of [join(homedir(), ".claude", "projects"), join(homedir(), ".cursor", "projects")]) {
    try {
      for (const e of readdirSync(base, { withFileTypes: true })) {
        if (e.isDirectory()) projectDirs.add(e.name);
      }
    } catch { /* ignore */ }
  }
  const projectCount = projectDirs.size;

  return {
    stats: {
      sessions: sessions.length,
      messages: totalMessages,
      hours: Math.round(totalHours * 10) / 10,
      days: totalActiveDays,
      commits: totalCommits,
      linesChanged: totalLinesChanged,
    },
    tools: allTools,
    timePatterns: {
      hourDistribution: hourDist,
      dayOfWeekDistribution: dayDist,
      peakHour,
      peakDay,
    },
    projectCount,
    goals,
    highlights: {
      busiestDay: busiestDay || toDateStr(Date.now()),
      busiestDayMessages,
      longestStreak,
      longestSessionMinutes: Math.round(longestSessionMin),
      rarestTool,
      firstSessionDate: firstDate === Infinity ? toDateStr(Date.now()) : toDateStr(firstDate),
      topToolName,
      topToolCount,
    },
    streaks: {
      current: currentStreak,
      longest: longestStreak,
      totalActiveDays,
    },
    _meta: { totalHours, sessions, goals, allTools },
  };
}

// ── Step 5: Determine archetype ──────────────────────────────────────────────

function determineArchetype(data) {
  const { stats, goals, highlights, streaks, projectCount, timePatterns, _meta } = data;
  const { sessions } = _meta;
  const totalGoals = Object.values(goals).reduce((a, b) => a + b, 0) || 1;
  const totalMessages = Object.values(timePatterns.hourDistribution).reduce((a, b) => a + b, 0) || 1;
  const avgSessionMin = sessions.length > 0
    ? sessions.reduce((a, s) => a + s.durationMinutes, 0) / sessions.length
    : 0;

  // Night messages (hours 22, 23, 0, 1, 2, 3, 4)
  const nightHours = [22, 23, 0, 1, 2, 3, 4];
  let nightMessages = 0;
  for (const h of nightHours) {
    nightMessages += timePatterns.hourDistribution[h] || 0;
  }
  if (nightMessages / totalMessages > 0.5) return "night_owl";

  if (avgSessionMin > 120) return "marathoner";

  if (avgSessionMin < 15 && stats.sessions > 50) return "sprinter";

  if (goals.bug_fix / totalGoals > 0.4) return "bug_hunter";

  if (goals.feature / totalGoals > 0.4) return "builder";

  // 15+ tools with count > 10 each
  const heavyTools = Object.values(data.tools).filter((c) => c > 10).length;
  if (heavyTools >= 15) return "tool_master";

  // Task in top 3
  const toolsSorted = Object.entries(data.tools).sort((a, b) => b[1] - a[1]);
  const top3Names = toolsSorted.slice(0, 3).map(([n]) => n);
  if (top3Names.includes("Task")) return "delegator";

  if (highlights.longestStreak >= 14) return "streak_master";

  if (projectCount >= 5) return "polyglot";

  // Deep diver: avg > 60min AND < 5 sessions/week
  const weeks = Math.max(1, stats.days / 7);
  if (avgSessionMin > 60 && stats.sessions / weeks < 5) return "deep_diver";

  if (goals.explore / totalGoals > 0.4) return "explorer";

  if (stats.days > 0 && stats.messages / stats.days > 100) return "pair_programmer";

  return "builder";
}

// ── Step 7: Submit ───────────────────────────────────────────────────────────

function submitPayload(apiUrl, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const url = new URL(`${apiUrl}/api/wrapped`);
    const requester = url.protocol === "https:" ? request : httpRequest;

    const req = requester(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); }
            catch { reject(new Error(`Invalid response: ${data}`)); }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Step 8: Open browser ─────────────────────────────────────────────────────

function openBrowser(url) {
  const platform = process.platform;
  const cmd =
    platform === "darwin" ? `open "${url}"` :
    platform === "win32" ? `start "" "${url}"` :
    `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) log(dim(`Could not open browser automatically. Visit: ${url}`));
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log(purple("  ╔═══════════════════════════════════╗"));
  console.log(purple("  ║") + bold("   Code Wrapped                     ") + purple("║"));
  console.log(purple("  ╚═══════════════════════════════════╝"));
  console.log("");

  log("Scanning your coding sessions...");
  log(dim("Only aggregate stats are collected — no code, prompts, or file paths leave your machine.\n"));

  // Step 1: Discover
  const files = discoverSessionFiles();
  const claudeCount = files.filter((f) => f.source === "claude").length;
  const cursorCount = files.filter((f) => f.source === "cursor").length;

  const sources = [];
  if (claudeCount > 0) sources.push(`${claudeCount} Claude Code`);
  if (cursorCount > 0) sources.push(`${cursorCount} Cursor`);
  log(`Found ${bold(files.length.toString())} session files (${sources.join(", ")})`);

  if (files.length === 0) {
    console.error("\n  ✗ No session files found. Use Claude Code or Cursor first, then run this again.\n");
    process.exit(1);
  }

  // Step 2 & 3: Parse
  const sessions = [];
  let skipped = 0;
  for (const f of files) {
    const session = parseSession(f.path, f.source);
    if (session) {
      sessions.push(session);
    } else {
      skipped++;
    }
  }

  verbose(`Parsed ${sessions.length} valid sessions, skipped ${skipped}`);

  if (sessions.length === 0) {
    console.error("\n  ✗ No valid sessions found (all were too short or had too few messages).\n");
    process.exit(1);
  }

  // Step 4: Aggregate
  log(`Analyzing ${bold(sessions.length.toString())} sessions...\n`);
  const data = aggregate(sessions);

  // Step 5: Archetype
  const archetype = determineArchetype(data);

  // Step 6: Build payload
  const payload = {
    version: 1,
    stats: data.stats,
    tools: data.tools,
    timePatterns: data.timePatterns,
    projectCount: data.projectCount,
    goals: data.goals,
    archetype,
    highlights: data.highlights,
    streaks: data.streaks,
  };

  // Summary
  log(bold("── Your Stats ──────────────────────"));
  log(`Sessions:     ${purple(data.stats.sessions.toString())}`);
  log(`Messages:     ${purple(data.stats.messages.toString())}`);
  log(`Hours:        ${purple(data.stats.hours.toString())}`);
  log(`Active days:  ${purple(data.stats.days.toString())}`);
  log(`Commits:      ${purple(data.stats.commits.toString())}`);
  log(`Top tool:     ${purple(data.highlights.topToolName)} (${data.highlights.topToolCount} uses)`);
  log(`Archetype:    ${purple(archetype.replace(/_/g, " "))}`);
  console.log("");

  if (DRY_RUN) {
    log(dim("Dry run — printing payload:\n"));
    console.log(JSON.stringify(payload, null, 2));
    process.exit(0);
  }

  // Step 7: Submit
  log("Uploading your wrapped...");

  try {
    const result = await submitPayload(API_URL, payload);
    const slug = result.slug;
    const url = `${API_URL}/w/${slug}`;

    console.log("");
    log(green("✓ Your wrapped is ready!"));
    console.log("");
    log(bold(url));
    console.log("");
    log(dim("Share freely — only aggregate stats are included, no private data."));
    console.log("");

    openBrowser(url);
  } catch (err) {
    console.error(`\n  ✗ Upload failed: ${err.message}`);
    console.error(`\n  You can paste the JSON manually at ${API_URL}/submit`);
    console.error(`\n  Payload:\n`);
    console.log(JSON.stringify(payload, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n  ✗ Unexpected error: ${err.message}\n`);
  process.exit(1);
});
