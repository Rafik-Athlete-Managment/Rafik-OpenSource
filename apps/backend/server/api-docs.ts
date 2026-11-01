import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const resolve = createRequire(import.meta.url).resolve;
const assets: Record<string, { path: string; type: string }> = {
  "swagger-ui.css": {
    path: resolve("swagger-ui-dist/swagger-ui.css"),
    type: "text/css",
  },
  "swagger-ui-bundle.js": {
    path: resolve("swagger-ui-dist/swagger-ui-bundle.js"),
    type: "application/javascript",
  },
};

/** Builds the local Swagger UI script, optionally enabling its interactive controls. */
export function swaggerInitializer(interactive: boolean) {
  return `"use strict";
(() => {
  const prefix = window.location.pathname.split('/v1/docs')[0];
  fetch(prefix + '/v1/openapi.json', { credentials: 'omit' })
    .then(response => { if (!response.ok) throw new Error('Could not load the API contract.'); return response.json(); })
    .then(spec => {
      spec.servers = [{ url: prefix || '/', description: 'This Rafik instance' }];
      window.ui = SwaggerUIBundle({
        spec, dom_id: '#swagger-ui', deepLinking: true,
        queryConfigEnabled: false, validatorUrl: null, persistAuthorization: false,
        withCredentials: false, supportedSubmitMethods: ${JSON.stringify(interactive ? ["get", "post"] : [])},
        requestInterceptor: request => {
          if (new URL(request.url, window.location.href).origin !== window.location.origin)
            throw new Error('Use this instance for API requests.');
          request.headers = { ...request.headers, 'X-Rafik-Client': 'android' };
          request.credentials = 'omit';
          return request;
        }
      });
    }).catch(error => { document.getElementById('swagger-ui').textContent = error.message; });
})();`;
}

/** Public documentation only. The underlying API still enforces current identity and authorization. */
export async function serveApiDocs(
  req: IncomingMessage,
  res: ServerResponse,
  interactive = process.env.NODE_ENV !== "production",
) {
  const pathname = new URL(req.url || "/", "http://rafik.invalid").pathname;
  const prefix = pathname.startsWith("/api/") ? "/api" : "";
  const path = pathname.slice(prefix.length);
  if (
    path !== "/v1/openapi.json" &&
    path !== "/v1/docs" &&
    !path.startsWith("/v1/docs/")
  )
    return false;
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { ...headers, Allow: "GET, HEAD" });
    res.end();
    return true;
  }
  let body: string | Buffer;
  let type: string;
  if (path === "/v1/openapi.json") {
    body = await readFile(new URL("../openapi.json", import.meta.url));
    type = "application/vnd.oai.openapi+json";
  } else if (path === "/v1/docs" || path === "/v1/docs/") {
    type = "text/html";
    body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rafik API · Swagger UI</title><link rel="stylesheet" href="${prefix}/v1/docs/assets/swagger-ui.css"></head><body><header><h1>Rafik API</h1><p>${interactive ? "Local development: requests run against this instance. Use synthetic data." : "Production reference: interactive requests are disabled."} This is the supported coach field API subset.</p><p>For local requests: execute mobile login, copy access_token into Authorize, then use the coach endpoints. Authorization is cleared on refresh.</p></header><div id="swagger-ui"></div><script src="${prefix}/v1/docs/assets/swagger-ui-bundle.js"></script><script src="${prefix}/v1/docs/assets/initializer.js"></script></body></html>`;
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
  } else if (path === "/v1/docs/assets/initializer.js") {
    type = "application/javascript";
    body = swaggerInitializer(interactive);
  } else {
    const name = path.replace("/v1/docs/assets/", "");
    const asset = Object.hasOwn(assets, name) ? assets[name] : null;
    if (!path.startsWith("/v1/docs/assets/") || !asset) {
      res.writeHead(404, headers);
      res.end();
      return true;
    }
    type = asset.type;
    body = await readFile(asset.path);
  }
  res.writeHead(200, { ...headers, "Content-Type": `${type}; charset=utf-8` });
  res.end(req.method === "HEAD" ? undefined : body);
  return true;
}
