import fs from "node:fs";
import path from "node:path";

const devDir = path.join(process.cwd(), ".next", "dev");

if (fs.existsSync(devDir)) {
  fs.rmSync(devDir, { recursive: true, force: true });
  console.log("[dev] Cleared .next/dev");
}
