import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const JEV_PATH = "/typesafe/v1/systemone";
const JEV_UPSTREAM = "https://api.typesafe.ai/v1/systemone";
const MAX_REQUEST_BYTES = 1_000_000;
const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
});

export function createPreviewServer({
  root = "dist",
  jevUpstream = JEV_UPSTREAM,
  fetchImpl = fetch,
  logger = console,
} = {}) {
  const staticRoot = path.resolve(root);

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://preview.local");
      if (url.pathname === JEV_PATH) {
        await relayJev(request, response, jevUpstream, fetchImpl);
        return;
      }
      await serveStatic(request, response, staticRoot, url.pathname);
    } catch (_error) {
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      }
      response.end("Internal server error");
      logger.error("Preview request failed");
    }
  });
}

async function relayJev(request, response, upstream, fetchImpl) {
  if (request.method !== "POST") {
    response.writeHead(405, { allow: "POST" });
    response.end();
    return;
  }

  const body = await readBoundedBody(request);
  if (body === null) {
    response.writeHead(413, { "content-type": "text/plain; charset=utf-8" });
    response.end("Request too large");
    return;
  }

  const headers = {};
  for (const name of [
    "accept",
    "content-type",
    "x-typesafe-organization-id",
    "x-typesafe-retry-count",
    "x-typesafe-runtime",
    "x-typesafe-sdk",
  ]) {
    const value = request.headers[name];
    if (typeof value === "string") headers[name] = value;
  }
  const apiKey = request.headers["x-chipcafe-jev-key"];
  if (typeof apiKey === "string" && apiKey.length > 0) {
    headers.authorization = `Bearer ${apiKey}`;
  }
  headers["content-type"] ||= "application/json";

  const upstreamResponse = await fetchImpl(upstream, {
    method: "POST",
    headers,
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  const responseHeaders = {
    "cache-control": "no-store",
    "content-type": upstreamResponse.headers.get("content-type") || "application/json",
  };
  for (const name of ["retry-after", "x-typesafe-request-id"]) {
    const value = upstreamResponse.headers.get(name);
    if (value) responseHeaders[name] = value;
  }
  response.writeHead(upstreamResponse.status, responseHeaders);
  response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
}

async function readBoundedBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function serveStatic(request, response, staticRoot, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD" });
    response.end();
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch (_error) {
    response.writeHead(400);
    response.end();
    return;
  }
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.resolve(staticRoot, relativePath);
  if (filePath !== staticRoot && !filePath.startsWith(`${staticRoot}${path.sep}`)) {
    response.writeHead(404);
    response.end();
    return;
  }

  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch (_error) {
    response.writeHead(404);
    response.end();
    return;
  }
  if (!fileStats.isFile()) {
    response.writeHead(404);
    response.end();
    return;
  }

  const headers = {
    "cache-control": path.basename(filePath) === "config.js" ? "no-store" : "no-cache",
    "content-length": fileStats.size,
    "content-type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
  };
  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}

function startFromCommandLine() {
  const root = process.argv[2] || "dist";
  const port = Number.parseInt(process.argv[3] || process.env.PORT || "8000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Preview port must be an integer between 1 and 65535");
  }
  const server = createPreviewServer({ root });
  server.listen(port, "0.0.0.0", () => {
    console.log(`8bit.cafe preview listening on port ${port}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startFromCommandLine();
}
