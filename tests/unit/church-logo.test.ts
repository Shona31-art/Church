import { describe, expect, test } from "vitest";
import { churchLogoPath, churchLogoPathFromUrl, isOwnChurchLogoPath } from "@/lib/church-logo";

const CHURCH = "00000000-0000-0000-0000-00000000000a";
const OTHER = "00000000-0000-0000-0000-00000000000b";
const FILE = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

describe("church logo paths", () => {
  test("uploads go into the church's own folder with a random name", () => {
    const path = churchLogoPath(CHURCH, FILE, "webp");
    expect(path).toBe(`${CHURCH}/${FILE}.webp`);
    expect(isOwnChurchLogoPath(path, CHURCH)).toBe(true);
  });

  test("another church's folder, made-up names and tricks are refused", () => {
    expect(isOwnChurchLogoPath(churchLogoPath(OTHER, FILE, "png"), CHURCH)).toBe(false);
    expect(isOwnChurchLogoPath(`${CHURCH}/logo.png`, CHURCH)).toBe(false);
    expect(isOwnChurchLogoPath(`${CHURCH}/../${OTHER}/${FILE}.png`, CHURCH)).toBe(false);
    expect(isOwnChurchLogoPath(`${CHURCH}/${FILE}.svg`, CHURCH)).toBe(false);
  });

  test("finds the stored file from a saved public link, ignores other links", () => {
    const url = `https://abc.supabase.co/storage/v1/object/public/church-logos/${CHURCH}/${FILE}.webp`;
    expect(churchLogoPathFromUrl(url)).toBe(`${CHURCH}/${FILE}.webp`);
    expect(churchLogoPathFromUrl("https://example.com/logo.png")).toBeNull();
    expect(churchLogoPathFromUrl(null)).toBeNull();
  });
});
