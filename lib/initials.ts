/** "Grace Church of Kami" → "GK"; "Vishona" → "VI". Used for monograms and avatars without a photo. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w) && !/^(of|the|and)$/i.test(w));
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}
