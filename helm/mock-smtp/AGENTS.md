# AGENTS.md — helm/mock-smtp/

Parent guide: [`../../AGENTS.md`](../../AGENTS.md)

## Purpose

Helm chart that deploys the `smtp/` Docker image to a MOSIP Kubernetes
cluster, fronted by Istio. Depends on the Bitnami `common` library chart
(`charts.bitnami.com/bitnami`, tag `bitnami-common`) for its templates
(`common.names.fullname`, `common.labels.standard`, etc.) — this chart
has almost no logic of its own beyond wiring `values.yaml` into that
shared library's helpers.

## Layout

```text
helm/mock-smtp/
├── Chart.yaml               # name "mock-smtp", version 0.0.1-develop, depends on bitnami common
├── values.yaml               # all configurable values — see below
├── README.md                  # auto-generated-style chart doc (image/service tables)
├── .helmignore
└── templates/
    ├── _helpers.tpl            # chart-local template helpers (image pull secrets, pod annotations, service account name)
    ├── configmaps.yaml          # renders .Values.configmaps into a ConfigMap (SERVER_HOST, WS_EX_* etc.)
    ├── deployment.yaml           # the Deployment — one container running the smtp/ image
    ├── service.yaml                # ClusterIP Service, ports driven by .Values.services (http/tcp-smtp/http-websocket)
    ├── service-account.yaml         # ServiceAccount, created if .Values.serviceAccount.create
    ├── servicemonitor.yaml           # Prometheus ServiceMonitor, only if .Values.metrics.enabled
    ├── gateway.yaml                    # Istio Gateway, only if istio.enabled && istio.gateways is set
    ├── virtualservice.yaml              # Istio VirtualService, only if istio.enabled
    ├── extra-list.yaml                    # renders .Values.extraDeploy (arbitrary extra manifests)
    └── NOTES.txt                           # post-install helm notes
```

## Key `values.yaml` sections

- `services` defines **three** named service ports (`http` 8080,
  `tcp-smtp` 8025, `http-websocket` 8081) — all three must stay in sync
  with the ports `smtp/app.js` actually listens on and with
  `smtp/Dockerfile`'s `EXPOSE` lines if you ever change them. `service`
  (singular) is a separate, mostly-unused top-level block inherited from
  the Bitnami chart template pattern — don't confuse the two.
- `image.repository`/`image.tag` default to `mosipqa/mock-smtp:0.0.2`,
  which is **not** the same tag as the `mosipdev/mock-smtp:v1` used in
  the root `AGENTS.md`'s local Docker example — see that file's
  Repository-Specific Considerations for why, and don't "fix" this
  mismatch without confirming which tag is actually meant to be current.
- `configmaps` (plural) is rendered directly into the ConfigMap by
  `templates/configmaps.yaml` and sets `SERVER_HOST=0.0.0.0`,
  `WS_EX_PROTOCOL=wss`, `WS_EX_SERVER_PORT=443`,
  `WS_EX_BASE_PATH=/mocksmtp/websocket` — these are the values the
  container actually gets at runtime via `extraEnvVarsCM: [mock-smtp]`.
- `istio.hosts` defaults to `['smtp.sandbox.mosip.net']` and is
  overridden at install time by `deploy/install.sh` via
  `--set istio.hosts[0]=$SMTP_HOST`, not by editing this file directly.
- `istio.gateways` is empty by default, so `templates/gateway.yaml`
  renders nothing unless a caller explicitly sets it — the chart expects
  to reuse an existing gateway (`istio.ingressController` selects
  `ingressgateway-internal`) in the common MOSIP sandbox setup.

## Build & Test Commands

```bash
helm dependency update .
helm lint .
helm template mock-smtp . --set istio.hosts[0]=smtp.example.mosip.net
```

`helm dependency update .` is required before `lint`/`template` locally
— the Bitnami `common` dependency is not vendored (`charts/` doesn't
exist in the tree) and there's no committed `Chart.lock` either, so
`lint`/`template` fail without it. Use `helm dependency build .`
instead if a `Chart.lock` is ever committed to this chart.

## Agent rules

### Do

1. Keep `services` in `values.yaml`, `smtp/Dockerfile`'s `EXPOSE` lines,
   and `smtp/app.js`'s port env vars in sync — changing one without the
   others silently breaks the deployment.
2. Use `common.*` template helpers (from the Bitnami `common` dependency)
   for new templates rather than hand-rolling label/name logic — that's
   the existing convention throughout this chart.
3. Run `helm lint .` before proposing a chart change.

### Do not

1. Do not hardcode `istio.hosts` to a real domain in this file — it's
   meant to be set at install time via `--set` (see
   `../../deploy/AGENTS.md`).
2. Do not remove the Bitnami `common` dependency or reimplement its
   helpers locally — every template here relies on it.
