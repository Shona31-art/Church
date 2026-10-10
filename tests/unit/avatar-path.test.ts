import { describe, expect, test } from "vitest";
import { avatarPath, isOwnAvatarPath } from "@/lib/avatar-path";
import { initials } from "@/lib/initials";

const CHURCH = "00000000-0000-0000-0000-00000000000a";
const USER = "10000000-0000-0000-0000-000000000003";
const FILE = "5936802b-970c-4a71-a4ef-e9af5a46ee26";

describe("avatar paths", () => {
  test("a path built for you is accepted", () => {
    expect(isOwnAvatarPath(avatarPath(CHURCH, USER, FILE, "webp"), CHURCH, USER)).toBe(true);
    expect(isOwnAvatarPath(avatarPath(CHURCH, USER, FILE, "jpg"), CHURCH, USER)).toBe(true);
  });

  test("someone else's folder, path tricks or odd file types are rejected", () => {
    const other = "10000000-0000-0000-0000-000000000004";
    expect(isOwnAvatarPath(avatarPath(CHURCH, other, FILE, "webp"), CHURCH, USER)).toBe(false);
    expect(isOwnAvatarPath(`${CHURCH}/${USER}/../${other}/${FILE}.webp`, CHURCH, USER)).toBe(false);
    expect(isOwnAvatarPath(`${CHURCH}/${USER}/${FILE}.svg`, CHURCH, USER)).toBe(false);
    expect(isOwnAvatarPath(`${CHURCH}/${USER}/photo.webp`, CHURCH, USER)).toBe(false);
  });
});

describe("initials", () => {
  test("first and last word, skipping small joining words", () => {
    expect(initials("Grace Church of Kami")).toBe("GK");
    expect(initials("Vishona")).toBe("VI");
    expect(initials("  ")).toBe("?");
  });
});
