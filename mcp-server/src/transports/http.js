import express from "express";
import {SSEServerTransport} from "@modelcontextprotocol/sdk/server/sse.js";

export async function runHttpTransport({host = "127.0.0.1", port = 3333, serverFactory}) {
  const app = express();
  app.use(express.json({limit: "50mb"}));

  const transports = new Map();

  app.get("/mcp/sse", async (req, res) => {
    const transport = new SSEServerTransport("/mcp/message", res);
    transports.set(transport.sessionId, transport);
    res.on("close", () => transports.delete(transport.sessionId));

    const server = serverFactory();
    await server.connect(transport);
  });

  app.post("/mcp/message", async (req, res) => {
    const sessionId = String(req.query.sessionId || "");
    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).send("Unknown sessionId");
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  await new Promise(resolve => {
    app.listen(port, host, () => resolve());
  });
  console.error(`FMG MCP HTTP server listening on http://${host}:${port}/mcp/sse`);
}

