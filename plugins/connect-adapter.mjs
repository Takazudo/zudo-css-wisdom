// @ts-check
// Adapter from Connect-style middleware (`(req, res, next) => void`) to
// the request-response shape zfb's `devMiddleware` lifecycle hook
// expects (`(req: ZfbDevMiddlewareRequest) => Promise<ZfbDevMiddlewareResponse | undefined>`).
//
// zfb's plugin host runs in a separate Node subprocess and only sees a
// JSON envelope of the request — `{ method, url, headers, body? }` —
// not real Node IPC. The adapter mocks just enough of `IncomingMessage`
// and `ServerResponse` for the v2 integration middlewares (which were
// written against Node's `http` types) to think they are talking to a
// regular HTTP server, then captures the response status / headers /
// body and returns them in the shape the host expects.
//
// The adapter is shared by every plugin module under this directory so
// any future Connect-style middleware can be wired into zfb's
// devMiddleware hook without rewriting it. Lives at the host repo —
// the v2 integration package keeps its Connect-style API surface so
// non-zfb embedders (Astro, plain Vite, a unit test) continue to work.

/** @import { ZfbDevMiddlewareRequest, ZfbDevMiddlewareResponse } from "@takazudo/zfb/plugins" */

import { Buffer } from "node:buffer";

/**
 * Connect-style middleware: `(req, res, next) => void`.
 * The req/res parameters are typed as `any` here because this adapter
 * intentionally passes a plain-object shim that structurally satisfies the
 * subset of `IncomingMessage` / `ServerResponse` that the v2 integration
 * middlewares actually access — not the full Node.js types.
 * @typedef {(req: any, res: any, next: (err?: unknown) => void) => void} ConnectMiddleware
 */

/**
 * Convert a Connect-style middleware to a zfb devMiddleware handler.
 * The returned async function takes a `ZfbDevMiddlewareRequest` and
 * returns either `undefined` (passthrough — zfb falls through to its
 * built-in routes) or a `ZfbDevMiddlewareResponse` envelope.
 *
 * Behaviour:
 *
 *   - `next()` from the middleware → resolves with `undefined`
 *     (passthrough).
 *   - `res.end(body)` → resolves with `{ status, headers, body }`.
 *     `status` defaults to 200 if the middleware didn't set one,
 *     mirroring Node's `ServerResponse` default.
 *   - `next(err)` or a thrown error → rejects so the host surfaces a
 *     500 with the error message the same way it does for any other
 *     plugin throw.
 *   - Binary bodies (Buffer / Uint8Array) → encoded as base64 and
 *     flagged `bodyEncoding: "base64"` so the JSON envelope round-trip
 *     stays loss-less.
 *
 * @param {ConnectMiddleware} middleware
 * @returns {(zfbReq: ZfbDevMiddlewareRequest) => Promise<ZfbDevMiddlewareResponse | undefined>}
 */
export function connectToZfbHandler(middleware) {
  return (zfbReq) => {
    return new Promise((resolveResponse, rejectResponse) => {
      // Build a minimal `IncomingMessage` shim. Only the fields the v2
      // integration middlewares actually read are populated — `method`,
      // `url`, and `headers`. Body parsing is not used by any of the
      // three middlewares (they're all GET routes), so we leave the
      // stream surface unimplemented.
      const req = {
        method: zfbReq.method,
        url: zfbReq.url,
        headers: zfbReq.headers ?? {},
      };

      // Build a `ServerResponse` shim that captures status, headers,
      // and body. We expose the API surface the v2 middlewares touch
      // today (`statusCode`, `setHeader`, `getHeader`, `end`) — extend
      // here if a future middleware needs more.
      let statusCode = 200;
      /** @type {Record<string, string>} */
      const headers = {};
      let settled = false;

      /**
       * @param {string | Buffer | Uint8Array | null | undefined} body
       * @returns {void}
       */
      const finish = (body) => {
        if (settled) return;
        settled = true;
        // Lower-case header names so the host's response shape matches
        // axum's expectation (`Record<string, string>` of arbitrary
        // case). Last-wins on collision; with `setHeader` callers this
        // shouldn't happen.
        /** @type {Record<string, string>} */
        const normalisedHeaders = {};
        for (const [k, v] of Object.entries(headers)) {
          normalisedHeaders[k.toLowerCase()] = String(v);
        }

        if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
          resolveResponse({
            status: statusCode,
            headers: normalisedHeaders,
            body: Buffer.from(body).toString("base64"),
            bodyEncoding: "base64",
          });
          return;
        }
        resolveResponse({
          status: statusCode,
          headers: normalisedHeaders,
          body: body == null ? "" : String(body),
          bodyEncoding: "utf8",
        });
      };

      const res = {
        get statusCode() {
          return statusCode;
        },
        /** @param {number} v */
        set statusCode(v) {
          statusCode = v;
        },
        /**
         * @param {string} name
         * @param {string | number | readonly string[]} value
         */
        setHeader(name, value) {
          // Store under lowercased key to avoid duplicate-case collisions
          // when finish() merges headers — last-wins is then unambiguous.
          headers[name.toLowerCase()] = String(value);
        },
        /** @param {string} name */
        getHeader(name) {
          // Keys are always stored lowercased (see setHeader), so a direct
          // lowercased lookup is sufficient and avoids an O(n) scan.
          return headers[name.toLowerCase()];
        },
        get headersSent() {
          return settled;
        },
        /** @param {string | Buffer | Uint8Array | null | undefined} [body] */
        end(body) {
          finish(body);
        },
      };

      /** @param {unknown} [err] */
      const next = (err) => {
        if (settled) return;
        if (err) {
          settled = true;
          rejectResponse(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        // Connect's `next()` with no error means "I did not handle
        // this request". Resolve with `undefined` so zfb's host
        // surfaces a passthrough.
        settled = true;
        resolveResponse(undefined);
      };

      try {
        middleware(req, res, next);
      } catch (err) {
        if (settled) return;
        settled = true;
        rejectResponse(err instanceof Error ? err : new Error(String(err)));
      }
    });
  };
}
