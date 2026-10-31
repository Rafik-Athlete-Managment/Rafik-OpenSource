import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { runInNewContext } from "node:vm";
import { serveApiDocs, swaggerInitializer } from "../server/api-docs.ts";

test("Swagger serves local assets, prefixed routes and the canonical contract without a database", async () => {
  const server = createServer((req, res) => {
    void serveApiDocs(req, res, true)
      .then((served) => {
        if (!served) {
          res.writeHead(404);
          res.end();
        }
      })
      .catch((error) => {
        res.writeHead(500);
        res.end(String(error));
      });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const prefix of ["", "/api"]) {
      const page = await fetch(`${base}${prefix}/v1/docs`);
      assert.equal(page.status, 200);
      assert.match(
        page.headers.get("content-security-policy") || "",
        /connect-src 'self'/,
      );
      assert.match(page.headers.get("cache-control") || "", /no-store/);
      const html = await page.text();
      assert.match(html, /Rafik API/);
      for (const asset of [
        "swagger-ui.css",
        "swagger-ui-bundle.js",
        "initializer.js",
      ]) {
        assert.ok(html.includes(`${prefix}/v1/docs/assets/${asset}`));
        const response = await fetch(
          `${base}${prefix}/v1/docs/assets/${asset}`,
        );
        assert.equal(response.status, 200);
        assert.ok((await response.text()).length > 100);
      }
      const spec = await fetch(`${base}${prefix}/v1/openapi.json`).then((r) =>
        r.json(),
      );
      assert.equal(spec.openapi, "3.1.0");
      assert.deepEqual(spec.components.schemas.Context.properties.role.enum, [
        "admin",
        "trainer",
        "trainee",
      ]);
      assert.match(
        spec.components.schemas.Context.properties.path.description,
        /dashboard/,
      );
      assert.ok(spec.paths["/v1/mobile/auth/login"]);
      assert.ok(spec.paths["/v1/institution/calendar"]);
      assert.ok(!spec.paths["/v1/workspaces/{workspace}/calendar"]);
    }
    assert.equal((await fetch(`${base}/v1/docs/assets/__proto__`)).status, 404);
    assert.equal(
      (await fetch(`${base}/v1/docs/assets/package.json`)).status,
      404,
    );
    assert.equal(
      (await fetch(`${base}/v1/docs`, { method: "HEAD" })).status,
      200,
    );
    assert.equal(
      (await fetch(`${base}/v1/docs`, { method: "POST" })).status,
      405,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("Swagger config uses this instance, adds the native marker, omits cookies and disables production execution", async () => {
  for (const prefix of ["", "/api"])
    for (const interactive of [true, false]) {
      let configuration: Record<string, any> | undefined;
      const fetches: string[] = [];
      const window = {
        location: {
          pathname: `${prefix}/v1/docs/`,
          href: `http://127.0.0.1:55331${prefix}/v1/docs/`,
          origin: "http://127.0.0.1:55331",
        },
        ui: null,
      };
      runInNewContext(swaggerInitializer(interactive), {
        window,
        URL,
        document: { getElementById: () => ({ textContent: "" }) },
        fetch: async (url: string) => {
          fetches.push(url);
          return {
            ok: true,
            json: async () => ({ servers: [{ url: "https://wrong.example" }] }),
          };
        },
        SwaggerUIBundle: (config: Record<string, any>) => {
          configuration = config;
        },
      });
      await new Promise((resolve) => setImmediate(resolve));
      assert.ok(configuration);
      assert.equal(fetches[0], `${prefix}/v1/openapi.json`);
      assert.equal(configuration.spec.servers[0].url, prefix || "/");
      assert.equal(configuration.validatorUrl, null);
      assert.equal(configuration.persistAuthorization, false);
      assert.equal(configuration.queryConfigEnabled, false);
      assert.equal(
        JSON.stringify(configuration.supportedSubmitMethods),
        JSON.stringify(interactive ? ["get", "post"] : []),
      );
      const request = configuration.requestInterceptor({
        url: `${window.location.origin}${prefix}/v1/institution/context`,
        headers: {},
      });
      assert.equal(request.headers["X-Rafik-Client"], "android");
      assert.equal(request.credentials, "omit");
      assert.throws(() =>
        configuration!.requestInterceptor({
          url: "https://elsewhere.example/v1/institution/context",
          headers: {},
        }),
      );
    }
});
