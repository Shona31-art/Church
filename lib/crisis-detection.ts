// Plain helper module (no "use server") — a "use server" file requires
// every export to be an async function, so the synchronous detector and
// the plain-string constant had to live outside actions.ts.

const CRISIS_PATTERNS: RegExp[] = [
  /\b(kill|end) (myself|my life)\b/i,
  /\bsuicid/i,
  /\bwant to die\b/i,
  /\bno reason to (live|go on)\b/i,
  /\bhurt(ing)? myself\b/i,
  /\bself[- ]?harm/i,
  /\bbeing (abused|hurt) by\b/i,
  /\bhe hits me\b|\bshe hits me\b/i,
];

export function detectCrisisSignal(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => p.test(text));
}

// Sourced July 2026 — SADAG (South African Depression and Anxiety Group).
// Worth re-verifying periodically; helpline numbers do change.
export const SA_CRISIS_RESOURCES = `If you're in immediate danger, please contact:
• SADAG Suicide Crisis Line: 0800 567 567 (24/7) or SMS 31393
• SADAG Mental Health Line: 0800 21 22 23
• Childline South Africa (under 18): 0800 055 555
• Emergency services: 10111 (police) or 10177 (ambulance)`;
