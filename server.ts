import { loadEnvConfig } from "@next/env";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initSocketServer } from "./lib/socket-server";

loadEnvConfig(process.cwd());

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port, webpack: true });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const httpServer = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url ?? "", true);
        await handle(req, res, parsedUrl);
      } catch (err) {
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

    httpServer.listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port} (Next.js + Socket.IO)`);
    });
  })
  .catch((err) => {
    console.error("Failed to prepare Next.js:", err);
    process.exit(1);
  });
