import type { WrappedPayload } from "@/lib/types";

export function getNumbersRoast(payload: WrappedPayload): string {
  const { sessions, messages, hours, commits } = payload.stats;

  if (commits === 0) return "// zero commits... you let the AI handle git too?";
  if (hours > 500) return "// that's more hours than some people work in a year";
  if (hours > 200) return "// at this point, Claude should be paying you rent";
  if (messages > 10000) return "// you and Claude need couples therapy";
  if (messages > 5000) return "// Claude knows you better than your friends do";
  if (sessions > 500) return "// you open Claude Code more than your fridge";
  if (sessions > 200) return "// Claude is basically your co-founder at this point";
  if (hours < 1) return "// just getting started — the addiction comes later";
  if (messages / Math.max(sessions, 1) > 100) return "// those are some marathon conversations";
  return `// ${sessions} sessions and counting`;
}

export function getToolsRoast(payload: WrappedPayload): string {
  const tools = payload.tools;
  const totalTools = Object.keys(tools).length;
  const sorted = Object.entries(tools).sort((a, b) => b[1] - a[1]);
  const topTool = sorted[0]?.[0];
  const topCount = sorted[0]?.[1] ?? 0;

  if (topTool === "Read" && topCount > 500) return "// you read more files than a librarian";
  if (topTool === "Shell" && topCount > 300) return "// shell access is a dangerous power";
  if (topTool === "Bash" && topCount > 300) return "// bash goes brrr";
  if (topTool === "Edit" || topTool === "StrReplace") return "// the rewrite machine";
  if (topTool === "Write") return "// creation is your middle name";
  if (topTool === "WebSearch") return "// Claude Googles so you don't have to";
  if (totalTools > 20) return "// you've used tools that most people don't know exist";
  if (totalTools > 10) return "// a true tool connoisseur";
  if (totalTools <= 3) return "// minimalist. respect.";
  return "// there's a tool for that";
}

export function getStreakRoast(payload: WrappedPayload): string {
  const { longest, current } = payload.streaks;
  const longestSession = payload.highlights.longestSessionMinutes;

  if (longestSession > 600) return "// that session was longer than most movies... combined";
  if (longestSession > 300) return "// did you forget to sleep?";
  if (longestSession > 120) return "// deep work energy";
  if (longest >= 30) return "// 30+ days? that's not a streak, that's a lifestyle";
  if (longest >= 14) return "// two weeks straight — your keyboard filed for overtime";
  if (longest >= 7) return "// a full week — your chair has a permanent imprint";
  if (current > 0 && current >= longest) return "// your current streak IS the record. keep going.";
  if (current === 0) return "// streak broken. time to start a new one today.";
  return "// consistency is the superpower";
}

export function getWinsRoast(payload: WrappedPayload): string {
  const { goals } = payload;
  const total = Object.values(goals).reduce((a, b) => a + b, 0) || 1;
  const bugPct = (goals.bug_fix / total) * 100;
  const featurePct = (goals.feature / total) * 100;
  const testPct = (goals.test / total) * 100;

  if (testPct === 0) return "// zero tests. living on the edge.";
  if (bugPct > 50) return "// more bugs than a rainforest";
  if (bugPct > 30) return "// bug squasher extraordinaire";
  if (featurePct > 50) return "// shipping machine activated";
  if (featurePct > 30) return "// building the future, one feature at a time";
  if (goals.explore > goals.feature) return "// more exploring than building — the curious type";
  if (goals.refactor > 0 && goals.refactor > goals.feature) return "// refactoring more than building? perfectionist detected.";
  return `// ${total} goals classified`;
}

export function getHighlightsRoast(payload: WrappedPayload): string {
  const { highlights } = payload;

  if (highlights.busiestDayMessages > 500) return "// that busiest day was a full-on siege";
  if (highlights.busiestDayMessages > 200) return "// your busiest day had more messages than most people's month";
  if (highlights.busiestDayMessages > 100) return "// that was an intense day";
  if (highlights.rarestTool === "Task") return "// delegating to sub-agents — management material";
  return "// the highlight reel";
}

export function getHeatmapRoast(payload: WrappedPayload): string {
  const { peakHour } = payload.timePatterns;

  if (peakHour >= 0 && peakHour <= 4) return "// coding at this hour should be illegal";
  if (peakHour >= 22 || peakHour === 23) return "// the night shift hits different";
  if (peakHour >= 5 && peakHour <= 7) return "// early bird catches the bug";
  if (peakHour >= 9 && peakHour <= 11) return "// morning productivity? how responsible.";
  if (peakHour >= 12 && peakHour <= 14) return "// lunch break? what lunch break?";
  if (peakHour >= 15 && peakHour <= 17) return "// peak afternoon energy";
  return "// everyone has their hour";
}
