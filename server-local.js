import "dotenv/config";
import http from "http";
import fs from "fs";
import path from "path";
import url from "url";

import collection from "./api/collection.js";
import filters from "./api/filters.js";
import release from "./api/release.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function serveStatic(req, res) {
  const u = new URL(req.url, "http://localhost");
  let p = u.pathname === "/" ? "/index.html" : u.pathname;
  const filePath = path.join(publicDir, p);

  if (!filePath.startsWith(publicDir)) return send(res, 403, "Forbidden");
  if (!fs.existsSync(filePath)) return send(res, 404, "Not found");

  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml"
  };
  const type = types[ext] || "application/octet-stream";
  send(res, 200, fs.readFileSync(filePath), type);
}

function addExpressLikeHelpers(req, res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    const body = JSON.stringify(obj);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(body);
  };
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  req.query = Object.fromEntries(u.searchParams.entries());
  addExpressLikeHelpers(req, res);

  try {
    if (u.pathname === "/api/collection") return collection(req, res);
    if (u.pathname === "/api/filters") return filters(req, res);
    if (u.pathname === "/api/release") return release(req, res);

    return serveStatic(req, res);
  } catch (e) {
    return send(res, 500, `Error: ${e.message}`);
  }
});

server.listen(3001, () => {
  console.log("Local dev: http://localhost:3001");
});
