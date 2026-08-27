import { ObjectId } from "mongodb";

/** Read a MongoDB ObjectId from BSON, EJSON, or hex string. */
export function readObjectIdHex(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return ObjectId.isValid(trimmed) ? trimmed : "";
  }
  if (value instanceof ObjectId) {
    return value.toHexString();
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.toHexString === "function") {
      return (record.toHexString as () => string)();
    }
    if (typeof record.$oid === "string") {
      const oid = record.$oid.trim();
      return ObjectId.isValid(oid) ? oid : "";
    }
  }
  return "";
}

export function objectIdsEqual(a: string, b: string): boolean {
  if (!ObjectId.isValid(a) || !ObjectId.isValid(b)) return a === b;
  return new ObjectId(a).equals(new ObjectId(b));
}

export function sortParticipantIdPair(userA: string, userB: string): [string, string] {
  const a = readObjectIdHex(userA);
  const b = readObjectIdHex(userB);
  if (!a || !b) throw new Error("Invalid participant id.");
  return a < b ? [a, b] : [b, a];
}
