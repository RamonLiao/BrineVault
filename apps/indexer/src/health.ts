import http from "node:http";
import type { CursorManager } from "./cursor-manager.js";

/**
 * Simple health check HTTP server.
 * GET /health → { status: "ok", last_event_seq, lag_seconds }
 */
export function startHealthServer(
  port: number,
  cursorManager: CursorManager,
): http.Server {
  const startTime = Date.now();

  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      try {
        const lastSeq = await cursorManager.getLastEventSeq();
        const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            last_event_seq: lastSeq.toString(),
            uptime_seconds: uptimeSeconds,
          }),
        );
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "error", error: String(err) }));
      }
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  server.listen(port, () => {
    console.log(`[health] Listening on :${port}/health`);
  });

  return server;
}
