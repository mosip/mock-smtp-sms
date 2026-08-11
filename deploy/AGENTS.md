# AGENTS.md — deploy/

Parent guide: [`../AGENTS.md`](../AGENTS.md)

## Purpose

Shell scripts that wrap `helm install`/`delete`/`rollout restart` for the
`../helm/mock-smtp` chart against a MOSIP sandbox Kubernetes cluster.
These are operational scripts, not application code — they assume a
specific cluster shape (a `global` ConfigMap already exists, `mosip`
Helm repo is already added) and are not meant to be run against an
arbitrary cluster (see root `AGENTS.md`'s Repository-Specific
Considerations).

## Layout

```text
deploy/
├── README.md      # install instructions + required kernel-default.properties settings
├── install.sh      # first-time install: create namespace, copy configmaps, helm install
├── copy_cm.sh        # fetches copy_cm_func.sh from mosip-infra, copies the `global` configmap in
├── restart.sh          # kubectl rollout restart for all deployments in the mock-smtp namespace
└── delete.sh              # interactive helm uninstall (prompts Y/n)
```

## Script details

- **`install.sh`** — usage: `./install.sh [kubeconfig]`. Creates the
  `mock-smtp` namespace, labels it for Istio sidecar injection, runs
  `copy_cm.sh` to pull the `global` ConfigMap in from another namespace,
  reads the SMTP host from that ConfigMap
  (`kubectl get cm global -o jsonpath={.data.mosip-smtp-host}`), then
  `helm install`s the chart pinned to `CHART_VERSION=0.0.1-develop`,
  passing that host as `--set istio.hosts[0]=$SMTP_HOST`. All `set -e` /
  `set -o nounset` / `set -o pipefail` — any missing var or failed step
  aborts the script.
- **`copy_cm.sh`** — downloads `copy_cm_func.sh` from the `mosip-infra`
  repo at a **hardcoded `master`-branch raw URL**
  (`raw.githubusercontent.com/mosip/mosip-infra/master/...`), then uses
  it to copy the `global` ConfigMap from the `default` namespace into
  `mock-smtp`. This script has a network dependency on GitHub at runtime
  — if that URL 404s or `mosip-infra`'s script signature changes, this
  (and therefore `install.sh`) breaks.
- **`restart.sh`** — usage: `./restart.sh [kubeconfig]`. Runs
  `kubectl rollout restart deploy` across the whole `mock-smtp`
  namespace, then waits for rollout status on every Deployment found
  there.
- **`delete.sh`** — interactive-only (no non-interactive/CI-safe flag);
  prompts before running `helm -n mock-smtp delete mock-smtp`.

## Configuration

- `deploy/README.md` documents the `kernel-default.properties` settings
  (in the separate `mosip-config` repo) that point a MOSIP deployment's
  mail/SMS config at this mock service — e.g.
  `mosip.kernel.sms.api:http://mock-smtp.mock-smtp:8080/sendsms`. These
  are not files in this repo; don't look for them here.
- None of these scripts read a `.env` or secrets file — the only
  variable input is the optional `[kubeconfig]` positional argument and
  whatever `copy_cm_func.sh` reads from the cluster.

## Agent rules

### Do

1. Treat these scripts as sandbox-cluster tooling — flag any request to
   generalize them for an arbitrary/non-MOSIP cluster rather than doing
   it silently.
2. Keep `CHART_VERSION` in `install.sh` in sync with
   `../helm/mock-smtp/Chart.yaml`'s `version` if you bump the chart.
3. Preserve the `set -e`/`set -o nounset`/`set -o pipefail` header in any
   script you add or modify — these scripts intentionally fail loudly.

### Do not

1. Do not assume the `global` ConfigMap or `mosip` Helm repo already
   exist when reasoning about failures — `copy_cm.sh`/`install.sh`
   depend on both being present already.
2. Do not remove the interactive confirmation in `delete.sh` without
   flagging it — it's the only guard against an accidental production
   delete.
