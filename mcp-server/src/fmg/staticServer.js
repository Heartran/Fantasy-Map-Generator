import http from "node:http";
import fs from "node:fs";
import path from "node:path";

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".json":
      return "application/json; charset=utf-8";
    case ".webmanifest":
      return "application/manifest+json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".ico":
      return "image/x-icon";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export async function startStaticServer({rootDir, host = "127.0.0.1", port = 0} = {}) {
  const resolvedRoot = path.resolve(rootDir);

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", `http://${host}`);
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === "/") pathname = "/index.html";

    const filePath = path.resolve(resolvedRoot, "." + pathname);
    if (!filePath.startsWith(resolvedRoot + path.sep) && filePath !== resolvedRoot) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", contentTypeFor(filePath));
      res.setHeader("Cache-Control", "no-store");

      const stream = fs.createReadStream(filePath);
      stream.on("error", () => {
        res.statusCode = 500;
        res.end("Internal server error");
      });
      stream.pipe(res);
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  const baseUrl = `http://${host}:${actualPort}`;

  return {
    baseUrl,
    close: async () => {
      await new Promise(resolve => server.close(resolve));
    }
  };
}

