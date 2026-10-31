/** A friendly random password: easy to read out (no 0/O, 1/l/I), letters and numbers. */
export function generatePassword() {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const pick = (set: string, n: number) => {
    const buf = new Uint32Array(n);
    crypto.getRandomValues(buf);
    return Array.from(buf, (x) => set[x % set.length]).join("");
  };
  return `${pick(letters, 4)}-${pick(digits, 4)}-${pick(letters, 4)}`;
}
