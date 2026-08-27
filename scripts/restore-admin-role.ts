import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDb } from "../lib/mongodb";
import { ensureAdminRoleFullAccess } from "../lib/roles-data";

function loadEnvLocal() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 0) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local is optional when env vars are already set.
  }
}

loadEnvLocal();

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("MongoDB is not configured.");
    process.exit(1);
  }

  const restored = await ensureAdminRoleFullAccess(db, { force: true });
  console.log(
    restored ? "Admin role restored to full access." : "Admin role already has full access.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
