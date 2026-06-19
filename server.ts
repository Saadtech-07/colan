import fs from "node:fs";
import path from "node:path";
import { parse as parseUrl } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createServer } from "node:http";
import next from "next";
import { initSocketServer } from "./lib/socket-server";

loadEnvConfig(process.cwd());

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = Number(process.env.PORT ?? 3000);

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isMissingManifestError(err: unknown) {
  if (!(err instanceof Error)) return false;
  const errno = err as NodeJS.ErrnoException;
  return errno.code === "ENOENT" && errno.path?.includes("required-server-files.json");
}

/** Dev cache under `.next/dev` must not be reused when incomplete or from another bundler. */
function resetDevOutput() {
  if (!dev) return;

  const distDir = path.join(process.cwd(), ".next");
  const devDir = path.join(distDir, "dev");

  if (!fs.existsSync(devDir)) return;

  const hasDevManifest =
    fs.existsSync(path.join(devDir, "routes-manifest.json")) ||
    fs.existsSync(path.join(devDir, "required-server-files.json"));

  if (hasDevManifest) {
    for (const folder of ["cache"]) {
      const target = path.join(devDir, folder);
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
    return;
  }

  console.warn("[dev] Removing incomplete .next/dev output before startup…");
  fs.rmSync(devDir, { recursive: true, force: true });
}

async function warmUpDevServer(baseUrl: string) {
  const warmPaths = ["/login", "/"];

  for (const pathname of warmPaths) {
    let warmed = false;

    for (let attempt = 0; attempt < 120; attempt += 1) {
      try {
        const response = await fetch(`${baseUrl}${pathname}`, {
          redirect: "manual",
          signal: AbortSignal.timeout(120_000),
        });

        if (response.status < 500) {
          warmed = true;
          break;
        }
      } catch {
        // Retry while the dev compiler is still bootstrapping.
      }

      await sleep(500);
    }

    if (!warmed) {
      throw new Error(`Timed out warming up ${pathname}`);
    }
  }
}

resetDevOutput();

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(async () => {
    let acceptingTraffic = !dev;

    const httpServer = createServer(async (req, res) => {
      if (!acceptingTraffic) {
        res.statusCode = 503;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Retry-After", "1");
        res.end("Next.js is compiling. Retry in a moment.");
        return;
      }

      try {
        const parsedUrl = parseUrl(req.url ?? "", true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        if (isMissingManifestError(err)) {
          res.statusCode = 503;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Retry-After", "1");
          res.end("Next.js is still initializing. Retry in a moment.");
          return;
        }

        console.error("Request handler error:", err);
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });

    initSocketServer(httpServer);

    httpServer.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `\nPort ${port} is already in use. Stop the other dev server or run:\n` +
            `  $env:PORT=3001; npm run dev\n` +
            `On Windows, find the process: netstat -ano | findstr :${port}\n` +
            `Then stop it: taskkill /PID <pid> /F\n`,
        );
        process.exit(1);
      }
      throw err;
    });

    await new Promise<void>((resolve, reject) => {
      httpServer.listen(port, () => resolve());
      httpServer.once("error", reject);
    });

    if (dev) {
      console.log("> Compiling initial routes…");
      acceptingTraffic = true;
      const baseUrl = `http://${hostname}:${port}`;
      await warmUpDevServer(baseUrl);
    }

    acceptingTraffic = true;
    console.log(`> Ready on http://${hostname}:${port} (Next.js + Socket.IO)`);
  })
  .catch((err) => {
    console.error("Failed to prepare Next.js:", err);
    process.exit(1);
  });
