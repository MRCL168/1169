/* ============================================================
   serve.js — Server statis sederhana untuk pratinjau lokal
   Jalankan:  npm run serve   (setelah npm run build)
   Lalu buka: http://localhost:4321
   Mendukung basePath agar identik dengan GitHub Pages.
   ============================================================ */

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "_site");
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const basePath = (config.basePath || "").replace(/\/+$/, "");
const PORT = 4321;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);

  // Lepas basePath bila ada
  if (basePath && urlPath.startsWith(basePath)) {
    urlPath = urlPath.slice(basePath.length) || "/";
  }

  let filePath = path.join(OUT, urlPath);

  // Direktori → index.html
  if (urlPath.endsWith("/") || !path.extname(urlPath)) {
    filePath = path.join(OUT, urlPath, "index.html");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fallback ke 404.html
      fs.readFile(path.join(OUT, "404.html"), (e2, notFound) => {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(notFound || "404 Not Found");
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}${basePath || ""}/`;
  console.log(`\n  Pratinjau blog berjalan di:\n  → ${url}\n  → ${url}admin/  (panel CMS)\n\n  Tekan Ctrl+C untuk berhenti.\n`);
});
