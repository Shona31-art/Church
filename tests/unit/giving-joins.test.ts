import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

// givings has two links to app_users since migration #30 (user_id and
// confirmed_by). A bare `app_users(...)` embed on a givings query is then
// ambiguous and PostgREST refuses it (PGRST201) — which silently broke the
// giving report once. Every embed must name the link.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("givings queries", () => {
  test("never embed app_users without saying which link", () => {
    const offenders: string[] = [];
    for (const file of [...files("app"), ...files("lib")]) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/from\("givings"\)[\s\S]{0,400}?\.select\(\s*["`]([^"`]*)["`]/g)) {
        if (/app_users\s*\(/.test(match[1])) offenders.push(`${file}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
