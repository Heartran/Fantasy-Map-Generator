import process from "node:process";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createMcpServer} from "./mcp/createServer.js";
import {runHttpTransport} from "./transports/http.js";
import {runStdioTransport} from "./transports/stdio.js";
import {FmgExporter} from "./fmg/exporter.js";

function parseArgs(argv) {
  const args = {_: []};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const [rawKey, rawValue] = token.split("=", 2);
    const key = rawKey.slice(2);
    const value = rawValue ?? argv[i + 1];
    if (rawValue === undefined && value !== undefined && !String(value).startsWith("--")) i++;
    args[key] = value ?? true;
  }
  return args;
}

const args = parseArgs(process.argv);
const transport = String(args.transport || "stdio");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(__dirname, "..", "..");
const repoRoot = process.env.FMG_REPO_ROOT || defaultRepoRoot;

const exporter = new FmgExporter({
  repoRoot,
  headless: process.env.FMG_HEADLESS ? process.env.FMG_HEADLESS !== "false" : true,
  timeoutMs: process.env.FMG_MCP_TIMEOUT_MS ? Number(process.env.FMG_MCP_TIMEOUT_MS) : undefined
});

async function shutdown() {
  try {
    await exporter.close();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (transport === "stdio") {
  const server = createMcpServer({exporter});
  await runStdioTransport(server);
} else if (transport === "http") {
  const host = String(args.host || process.env.HOST || "127.0.0.1");
  const port = Number(args.port || process.env.PORT || 3333);
  await runHttpTransport({host, port, serverFactory: () => createMcpServer({exporter})});
} else {
  console.error(`Unknown transport: ${transport}`);
  process.exit(2);
}
