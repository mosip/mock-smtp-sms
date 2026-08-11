# AGENTS.md — smtp/

Parent guide: [`../AGENTS.md`](../AGENTS.md)

## Purpose

The entire application: a single Node.js process (`app.js`) that runs an
SMTP server, an HTTP server, and a WebSocket server together, plus the
static browser UI (`index.html`) served over that HTTP server. There is
no separate frontend build — `index.html` is served as-is.

## Layout

```text
smtp/
├── app.js            # SMTP + HTTP (Express) + WebSocket server, all in one file
├── index.html        # Static browser UI; loads React 17 + Tailwind from CDNs
├── package.json       # npm deps + `start`/`test` scripts
├── package-lock.json
├── Dockerfile          # Multi-stage build: npm ci in a builder stage, then a slim runtime image
├── .dockerignore        # Excludes node_modules, npm-debug.log from the build context
└── .gitignore
```

## `app.js` structure

One file, three servers, no framework beyond Express for the HTTP side:

1. **SMTP server** (`smtp-server` package) — listens on `SMTP_SERVER_PORT`
   (default `8025`). `disabledCommands: ['AUTH', 'STARTTLS']` means it only
   accepts plain, unauthenticated SMTP — this is intentional, not a bug to
   "fix". Incoming mail is parsed with `mailparser`'s `simpleParser`,
   logged to stdout via `console.log(parsed)`, and broadcast to WebSocket
   clients via `broadCast()`.
2. **HTTP server** (Express, `SERVER_PORT`, default `8080`) — three routes:
   - `GET /` serves `index.html`.
   - `GET /config` returns the WebSocket connection info
     (`wsProtocol`/`wsPort`/`basePath`) the UI needs to connect, sourced
     from `WS_EX_*` env vars — this is how the UI works behind a
     reverse proxy without hardcoding the WS URL into `index.html`.
   - `GET /sendsms` accepts `mobiles`/`sender`/`message` query params,
     builds a synthetic message object, logs it, and broadcasts it the
     same way as parsed email.
3. **WebSocket server** (`ws` package, `WS_SERVER_PORT`, default `8081`) —
   broadcasts every parsed email/SMS to all connected browser clients via
   `broadCast()`. Includes ping/pong heartbeat handling (30s interval) to
   detect and terminate dead connections.

There is no routing/module split beyond this — if you add a new mock
"channel" (e.g. mock push notifications), follow the same pattern: a new
route or listener in `app.js` that logs and calls `broadCast()`.

## Build & Test Commands

```bash
npm install
npm start
```

`npm start` runs `node app.js` directly — there is no build/bundle step
(`main: index.js` in `package.json` is stale/unused; the actual entry
point run by `npm start` is `app.js`, not `index.js`, and no `index.js`
file exists in this directory).

`npm test` is a stub (`echo "Error: no test specified" && exit 1`) — do
not wire it into CI expecting real coverage.

Docker build (multi-stage: `npm ci --omit=dev` in a `node:20-alpine`
builder stage, then copies only `node_modules`/`app.js`/`index.html` into
a fresh `node:20-alpine` runtime stage, running as a non-root `appuser`):

```bash
docker build . -t mosipdev/mock-smtp:v1 --network host
```

## Configuration

All configuration is environment variables read directly in `app.js` —
there is no config file. See the root `AGENTS.md`'s Configuration table
for the full list. Two that aren't in that table but exist in the code:
`WS_PROTOCOL` (internal WS listen protocol, unused by anything external)
and `HTTP_PROTOCOL` (declared but not actually referenced anywhere in
`app.js` — do not assume changing it has any effect).

## Agent rules

### Do

1. Keep changes to the SMTP/HTTP/WebSocket logic inside `app.js` — there
   is no other server-side file to split code into.
2. Verify any new HTTP route or SMTP behavior manually (see root
   `AGENTS.md`'s Development Workflow) — there is no test suite.
3. Keep `index.html` a single static file with CDN-loaded dependencies;
   don't introduce a bundler/build step without discussing it first, since
   the Dockerfile and `npm start` both assume there isn't one.

### Do not

1. Do not enable `AUTH`/`STARTTLS` in the SMTP server config — this mock
   is intentionally auth-less and plaintext, matching its dev/test-only
   purpose (see root `AGENTS.md`).
2. Do not log real user data through `console.log(parsed)` /
   `console.log(message)` — these exist for local debugging of synthetic
   test data only.
3. Do not add production dependencies for features unrelated to
   accepting/parsing/broadcasting mock mail and SMS.
