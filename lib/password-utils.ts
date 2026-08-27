/** Client/server-safe temporary password generator for onboarding emails. */

function pickChar(chars: string): string {
  return chars[Math.floor(Math.random() * chars.length)] ?? "x";
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!];
  }
  return next;
}

export function generateTemporaryPassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;

  const required = [
    pickChar(upper),
    pickChar(lower),
    pickChar(digits),
    pickChar(symbols),
  ];

  while (required.length < length) {
    required.push(pickChar(all));
  }

  return shuffle(required).join("");
}
