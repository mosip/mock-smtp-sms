# AGENTS.md

## Repository Overview

This repository implements a **mock SMTP server and a mock SMS HTTP API**, used by other
MOSIP services during development and testing so they do not need a real email/SMS
provider.

- The mock SMTP server listens on an SMTP port and accepts incoming emails. Instead of
  actually delivering them, it parses each message and pushes it over a WebSocket to a
  browser UI (`smtp/index.html`), so a developer can see the "sent" email in a browser.
- The mock SMS feature is a simple HTTP GET endpoint (`/sendsms`) that logs the request
  and broadcasts it over the same WebSocket, so a developer can see the "sent" SMS.
- Only the happy path is implemented — SMTP auth, STARTTLS, and other protocol features
  are explicitly disabled/unhandled (see `smtp/app.js`).

**This is dev/test-only tooling.** It is not a real SMTP or SMS gateway: it never
delivers mail or text messages to a real recipient, has no authentication, and prints
message contents to its logs. Never point a production MOSIP deployment's mail/SMS
configuration at this service, and never feed it real user data.

## Technology Stack

- **Runtime:** Node.js (Docker image built from `node:20-alpine`, see `smtp/Dockerfile`).
- **Server framework:** Express (`express`), for the HTTP routes and static UI.
- **SMTP handling:** `smtp-server` to accept SMTP connections, `mailparser` to parse
  incoming messages.
- **Real-time UI updates:** `ws` (WebSocket server) to broadcast parsed
  mail/SMS to connected browser clients.
- **Front end:** `smtp/index.html` — a single static HTML page using a CDN-loaded React
  build (no bundler/build step for the UI).
- **Packaging:** Docker (multi-stage build), and a Helm chart (`helm/mock-smtp`) for
  Kubernetes deployment.
- There is no test framework configured — `package.json`'s `test` script is a stub that
  exits non-zero (`echo "Error: no test specified" && exit 1`).

## Build & Test Commands

All application code lives under `smtp/`.

```shell
cd smtp
npm install
npm start
```

`npm start` runs `node app.js` (see `smtp/package.json`). There is no separate build
step — the server serves `smtp/index.html` directly.

There is no automated test suite in this repository. Do not add a `test` script call to
CI expecting real coverage; validate changes manually as described in "Development
Workflow" below.

To build the Docker image (matches `smtp/Dockerfile`, run from the `smtp` directory):

```shell
cd smtp
docker build . -t mosipdev/mock-smtp:v1 --network host
```

To run the built image:

```shell
docker run -p 127.0.0.1:8025:8025 -p 127.0.0.1:8080:8080 -p 127.0.0.1:8081:8081 mosipdev/mock-smtp:v1
```

## Configuration

The server is configured entirely through environment variables (read in
`smtp/app.js`); there is no config file or secrets file to manage in this repo:

| Variable | Default | Purpose |
|---|---|---|
| `SMTP_SERVER_PORT` | `8025` | Port the mock SMTP server listens on |
| `SERVER_PORT` | `8080` | Port the HTTP server (UI + `/sendsms`) listens on |
| `WS_SERVER_PORT` | `8081` | Port the WebSocket server listens on |
| `SERVER_HOST` | `localhost` | Bind address; set to `0.0.0.0` when running in Docker (the Dockerfile already sets this) |
| `WS_EX_PROTOCOL` | `ws` | Protocol the browser client should use to reach the WebSocket, when behind a proxy |
| `WS_EX_SERVER_PORT` | `8081` | External WebSocket port to advertise to the browser client, when behind a proxy |
| `WS_EX_BASE_PATH` | `""` | Base path to advertise to the browser client, when behind a proxy |

In a Kubernetes/Helm deployment these are set via the chart's `configmaps` values (see
`helm/mock-smtp/values.yaml`), which sets `SERVER_HOST=0.0.0.0`,
`WS_EX_PROTOCOL=wss`, `WS_EX_SERVER_PORT=443`, and
`WS_EX_BASE_PATH=/mocksmtp/websocket` for the sandboxed/ingress-fronted case.

Downstream MOSIP services point at this mock through the `kernel-default.properties`
mail/SMS settings documented in `deploy/README.md`, for example
`mosip.kernel.sms.api:http://mock-smtp.mock-smtp:8080/sendsms`.

## Project Structure Notes

```text
smtp/              Node.js application (server + static browser UI) — see smtp/AGENTS.md
  app.js             SMTP/HTTP/WebSocket server logic
  index.html          Static browser UI (CDN React) that renders received mail/SMS
  package.json         npm dependencies and start script
  Dockerfile           Multi-stage Docker build
helm/mock-smtp/     Helm chart for deploying the mock service to Kubernetes
                    — see helm/mock-smtp/AGENTS.md
deploy/             Shell scripts wrapping helm install/uninstall/restart for a
                    MOSIP sandbox cluster, plus deploy/README.md describing usage
                    — see deploy/AGENTS.md
.github/workflows/  CI: Docker image build (push-trigger.yml) and Helm chart
                    lint/publish (chart-lint-publish.yml)
```

There are no other application modules, and no monorepo/multi-service split — this is a
single small Node.js service plus its Helm packaging. See each subfolder's own
`AGENTS.md` for module-specific detail; this root file covers what's common
across all three.

## Development Workflow

1. Make changes under `smtp/` (the only application code in this repo).
2. Run the server locally with `npm start` from `smtp/` and verify manually:
   - Open `http://localhost:8080/` in a browser to see the UI.
   - Send a test email, e.g.:

     ```shell
     sendEmail -f sender@example.test -t recipient@example.test -s localhost:8025 -u "Test send the mail" -m "Sending the email for test"
     ```

   - Send a test SMS via the HTTP API:

     ```shell
     curl 'http://localhost:8080/sendsms?mobiles=2025550100&sender=test&message=synthetic%20test%20message'
     ```

   - Confirm the message appears in the browser UI over the WebSocket connection.
3. If changing the Helm chart under `helm/mock-smtp/`, note that
   `.github/workflows/chart-lint-publish.yml` only triggers on pull requests/pushes that
   touch paths under `helm/**` — changes to `smtp/` alone will not run chart linting.
4. If changing the Docker image (`smtp/Dockerfile`, dependencies, or `smtp/app.js`),
   `.github/workflows/push-trigger.yml` builds the `mock-smtp` image via the shared
   `mosip/kattu` Docker build workflow on push/PR to `develop`, `master`, `release-1*`,
   `1.*`, `MOSIP*`, and other configured branches.
5. Never log or commit real personal data (emails, phone numbers, message bodies from
   real users) through this service — `smtp/app.js` prints parsed messages to stdout,
   and the README already flags this ("Please avoid using sensitive data").

## Pull Request Guidelines

- Target the `develop` branch, matching how this repository's CI is configured
  (`push-trigger.yml` and `chart-lint-publish.yml` both build on `develop`).
- Keep commits signed off (`git commit -s`) and reference the tracking MOSIP issue in
  the commit message and PR description.
- If the change touches `helm/mock-smtp/**`, expect the chart lint/publish workflow to
  run on the PR; if it touches `smtp/**`, expect the Docker image build workflow to run.
- Keep the PR scoped: this repo intentionally has almost no code, so prefer small,
  focused changes over broad refactors.

## Repository-Specific Considerations

- **This service is mock/test tooling only** — it has no authentication, no TLS, and no
  real delivery mechanism. Do not adapt it into a production notification channel, and
  flag any request to deploy it outside dev/test/sandbox environments.
- The mock only implements a "happy path" for SMTP; unusual clients, STARTTLS, or AUTH
  are not supported (`disabledCommands: ['AUTH', 'STARTTLS']` in `smtp/app.js`).
- `smtp/index.html` loads React from a CDN rather than using a bundled build — do not
  assume a `npm run build` step exists for the UI.
- The Helm chart's default image repository/tag in `helm/mock-smtp/values.yaml`
  (`mosipqa/mock-smtp:0.0.2`) is separate from the `mosipdev/mock-smtp:v1` tag used in
  the README's local Docker example; keep both in sync only if you intend to change the
  published image tag as part of a release.
- `deploy/copy_cm.sh` and `deploy/install.sh` assume a MOSIP sandbox Kubernetes cluster
  (they fetch a shared config-map utility from `mosip-infra` and expect a `global`
  configmap to already exist) — they are not meant to be run against an arbitrary
  cluster.

## Agent rules

### Do

1. Do treat this repository as dev/test-only tooling and say so explicitly in any
   documentation or code comments you add.
2. Do make application changes under `smtp/app.js` / `smtp/index.html` and verify them
   manually with the commands in "Development Workflow" — there is no automated test
   suite to rely on.
3. Do keep Helm chart changes under `helm/mock-smtp/` and be aware they trigger a
   separate CI workflow scoped to `helm/**`.
4. Do use language-tagged fenced code blocks and verify any command you document
   actually matches the current `package.json`, `Dockerfile`, or workflow files.
5. Do target the `develop` branch for pull requests, matching this repo's CI triggers.

### Do not

1. Do not suggest or implement using this service as a real SMTP/SMS provider, or wire
   it into a production notification path.
2. Do not log, commit, or forward real user emails/phone numbers/messages through this
   service — treat any sample data as disposable test data only.
3. Do not assume a build/bundler step exists for `smtp/index.html`; it is a plain static
   file loading React from a CDN.
4. Do not run `deploy/*.sh` against an arbitrary cluster — they assume a MOSIP sandbox
   cluster with a pre-existing `global` configmap.
5. Do not invent test commands or CI behavior — this repo has no test script beyond a
   stub, and CI workflows are scoped by path (`helm/**` for chart linting).
