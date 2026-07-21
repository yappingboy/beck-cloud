# Flux CD Structure Guide

**Last updated:** 2026-07-21  
**Scope:** How Flux manifests are organized in this repository

---

## Directory Layout

```
flux/
├── kustomization.yaml              # Root Kustomization (synced by gotk-sync)
├── flux-system/                    # Flux bootstrap (self-managing)
│   ├── gotk-components.yaml        # Flux controller manifests
│   ├── gotk-sync.yaml              # Self-reconciliation config
│   └── kustomization.yaml          # Bootstrap Kustomization
├── infrastructure/                 # Infrastructure namespace manifests
│   ├── kustomization.yaml          # Lists all namespace subdirectories
│   ├── flux-system.yaml            # Flux Kustomization: syncs flux-system layer
│   ├── infrastructure.yaml         # Flux Kustomizations: sources→controllers→configs→apps chain
│   ├── flux-system/                # ⚠️ Flux config resources (NOT the bootstrap dir)
│   │   ├── kustomization.yaml      # Kustomization for flux-system layer
│   │   ├── gitrepo.yaml            # GitRepository source
│   │   ├── configmap.yaml          # Variable substitution config
│   │   ├── infrastructure.yaml     # "infrastructure" Flux Kustomization
│   │   ├── apps.yaml               # "apps" Flux Kustomization
│   │   ├── cert-manager.yaml       # "cert-manager" Flux Kustomization
│   │   └── cert-manager-config.yaml # "cert-manager-config" Flux Kustomization
│   ├── <namespace>/                # Per-namespace K8s manifests
│   │   ├── namespace.yaml          # Namespace definition
│   │   ├── kustomization.yaml      # Lists resources for this namespace
│   │   └── <service>.yaml          # Service manifests
│   └── ...
└── apps/                           # User-facing apps (slower sync: 5m)
    ├── kustomization.yaml
    ├── apps.yaml                   # Flux Kustomization for apps layer
    ├── toolbox/
    └── user-invite/
```

## Important: Two `flux-system` Directories

| Path | Purpose |
|------|---------|
| `flux/flux-system/` | **Flux bootstrap** — gotk-components + gotk-sync. Self-managing. |
| `flux/infrastructure/flux-system/` | **Flux config** — GitRepository, ConfigMap, and Flux Kustomization resources. Synced by bootstrap. |

The `infrastructure/flux-system/` directory name is intentional — these are the Flux Kustomization resources that define how infrastructure is synced. They belong in the `flux-system` namespace. The name overlap with the bootstrap directory is confusing but functionally correct.

## Sync Pipeline

```
gotk-sync (flux/flux-system/)
  → flux/ (root kustomization.yaml)
    → flux/flux-system/ (bootstrap components)
    → flux/infrastructure/flux-system/ (config layer)
      → GitRepository "beck-cloud"
      → ConfigMap "beck-cloud-config"
      → Kustomization "flux-system" (path: ./flux/infrastructure/flux-system)
        → Kustomization "infrastructure" (path: ./flux/infrastructure)
          → Kustomization "infrastructure-sources" (path: ./flux/infrastructure/sources)
            → Kustomization "infrastructure-controllers" (path: ./flux/infrastructure/controllers)
              → Kustomization "infrastructure-configs" (path: ./flux/infrastructure/configs)
                → Kustomization "infrastructure-apps" (path: ./flux/infrastructure)
                  → [all namespace manifests]
      → Kustomization "apps" (path: ./flux/apps)
      → Kustomization "cert-manager" (path: ./flux/infrastructure/cert-manager)
      → Kustomization "cert-manager-config" (path: ./flux/infrastructure/cert-manager-config)
```

## Namespace Manifest Patterns

Each namespace under `flux/infrastructure/` follows this pattern:

```
<namespace>/
├── kustomization.yaml    # Required — lists all resources
├── namespace.yaml        # Required — creates the namespace
├── pvcs.yaml             # Optional — consolidated PVCs (used by media, 3dprinting)
└── <service>.yaml        # Service manifests (Deployment, Service, IngressRoute, etc.)
```

### PVC Organization

Two patterns exist in the repo:

1. **Consolidated** (`media/`, `3dprinting/`): All PVCs in a single `pvcs.yaml` file
2. **Per-service** (`webapps/`): Each service has its own `pvc.yaml` in its subdirectory

Both are valid. The consolidated pattern is preferred for namespaces with many small config PVCs. The per-service pattern is preferred when PVCs are tightly coupled to a specific service.

### YAML Organization

Two patterns exist:

1. **All-in-one**: PVCs, Deployment, Service, IngressRoute in a single YAML file
2. **Split**: Separate YAML files for each resource type

Both are valid. The split pattern is preferred for readability and independent updates.

## App Source Code

Application source code lives in `apps/`, NOT in the Flux directory:

| App | Source | Flux Manifests |
|-----|--------|---------------|
| user-invite | `apps/user-invite/` | `flux/apps/user-invite/` |
| gridspace | `apps/gridspace/` | `flux/infrastructure/gridspace/` |
| landing-page | `apps/landing-page/` | `flux/infrastructure/webapps/landing-page/` |

Build artifacts are created by Kaniko pods defined in the Flux manifests, which pull source from `apps/`.
