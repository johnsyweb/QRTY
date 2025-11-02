const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = 8000;
const BASE_PATH = "/QRTY";
const SRC_DIR = path.join(__dirname, "..", "src");

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const mimeType = getMimeType(filePath);
    res.writeHead(200, { "Content-Type": mimeType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];

  if (urlPath === BASE_PATH || urlPath === `${BASE_PATH}/`) {
    urlPath = `${BASE_PATH}/index.html`;
  }

  if (urlPath.startsWith(BASE_PATH)) {
    const filePath = path.join(
      SRC_DIR,
      urlPath.slice(BASE_PATH.length) || "index.html"
    );

    serveFile(filePath, res);
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}${BASE_PATH}/`);
  console.log(`Press Ctrl+C to stop`);
});

process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  server.close(() => {
    process.exit(0);
  });
});
