import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

const types = {".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".webmanifest":"application/manifest+json", ".png":"image/png", ".svg":"image/svg+xml", ".webp":"image/webp", ".jpg":"image/jpeg"};

export function serveStaticFile(request, response, pathname, root) {
  function send(status, body, type = "text/plain; charset=utf-8") {
    const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
    response.writeHead(status, {"Content-Type":type, "Content-Length":bytes.length, "Cache-Control":"no-cache"});
    response.end(request.method === "HEAD" ? undefined : bytes);
  }
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return send(400, "Invalid path."); }
  const filename = resolve(root, "." + decoded);
  const distance = relative(resolve(root), filename);
  if (distance === ".." || distance.startsWith(".." + sep) || isAbsolute(distance) || decoded.includes("\0")) return send(404, "Not found.");
  const present = existsSync(filename) && statSync(filename).isFile();
  // Only navigation receives the SPA fallback, never missing artwork or scripts.
  const asset = Boolean(extname(decoded)) || /^\/(art|assets)(\/|$)/.test(decoded);
  const target = present ? filename : asset ? null : resolve(root, "index.html");
  if (!target || !existsSync(target)) return send(404, "Not found.");
  return send(200, readFileSync(target), types[extname(target)] || "application/octet-stream");
}
