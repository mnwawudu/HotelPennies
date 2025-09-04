// polyfills/fetch.js
// Fetch + browser-like globals for Node < 18 (no Undici).
// Order matters: set globals early so downstream libs (gaxios/google-auth) see them.

const fetch = require('node-fetch');            // v2.x CommonJS build
const { FormData, Blob, File } = require('formdata-node');
const AbortController = require('abort-controller');

// 1) Core fetch API
if (!globalThis.fetch)    globalThis.fetch = fetch;
if (!globalThis.Headers)  globalThis.Headers = fetch.Headers;
if (!globalThis.Request)  globalThis.Request = fetch.Request;
if (!globalThis.Response) globalThis.Response = fetch.Response;

// 2) AbortController
if (!globalThis.AbortController) globalThis.AbortController = AbortController;

// 3) FormData / Blob / File for browser-like behavior
if (!globalThis.FormData) globalThis.FormData = FormData;
if (!globalThis.Blob)     globalThis.Blob = Blob;
if (!globalThis.File)     globalThis.File = File;

// 4) WHATWG Streams (ReadableStream, etc.)
//    Prefer Node's built-in 'stream/web' if present (Node 16.5+), otherwise
//    fall back to web-streams-polyfill's *polyfill* (which patches globals).
(() => {
  let RS, WS, TS;
  try {
    // Try built-in (available on many Node 16.x builds)
    ({ ReadableStream: RS, WritableStream: WS, TransformStream: TS } = require('stream/web'));
  } catch {
    try {
      // Fallback: patch globals via polyfill (this defines globalThis.ReadableStream, etc.)
      require('web-streams-polyfill/polyfill');
      RS = globalThis.ReadableStream;
      WS = globalThis.WritableStream;
      TS = globalThis.TransformStream;
    } catch (e) {
      // If neither is available, leave undefined; most libs only check presence.
    }
  }
  if (RS && !globalThis.ReadableStream)  globalThis.ReadableStream  = RS;
  if (WS && !globalThis.WritableStream)  globalThis.WritableStream  = WS;
  if (TS && !globalThis.TransformStream) globalThis.TransformStream = TS;
})();

// 5) Optional: TextEncoder/TextDecoder (older Node)
try {
  const { TextEncoder, TextDecoder } = require('util');
  if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
  if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder;
} catch { /* noop */ }
