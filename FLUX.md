# FluxCD Auto-Deployment

## Overview
FluxCD is now managing deployments for Movie Night app on your Raspberry Pi K3s cluster.

## How It Works

1. **Flux watches GitHub:** Syncs from `https://github.com/erix/movie-night-app.git` every 1 minute
2. **Auto-applies manifests:** Any YAML in `k8s/` gets deployed automatically
3. **GitOps:** Git is the source of truth - what's in the repo is what runs in the cluster

## Deployment Workflow

```bash
# 1. Make changes to k8s manifests
vim k8s/deployment.yaml

# 2. Commit and push
git add k8s/
git commit -m "Update movie-night deployment"
git push

# 3. Wait (1 minute max) or force sync:
flux reconcile kustomization movie-night
```

## Check Status

```bash
# See all Flux resources
flux get all

# Check specific kustomization
flux get kustomizations movie-night

# View logs
flux logs --kind=Kustomization --name=movie-night

# Suspend auto-sync (for maintenance)
flux suspend kustomization movie-night

# Resume
flux resume kustomization movie-night
```

## Flux Components

Running in `flux-system` namespace:
- **source-controller** - Pulls from Git
- **kustomize-controller** - Applies manifests
- **helm-controller** - Manages Helm charts (if needed)
- **notification-controller** - Sends alerts (optional)

## Configuration Files

- `clusters/homelab/flux-system/` - Flux system config
- `clusters/homelab/movie-night-kustomization.yaml` - Watches `k8s/` directory
- `k8s/` - Your app manifests (deployment, service, etc.)

## Cleanup Old ArgoCD (Optional)

ArgoCD namespace exists but has no pods. To remove:
```bash
kubectl delete namespace argocd
```

## Resources

- Official docs: https://fluxcd.io/flux/
- RPi optimization: Flux is much lighter than ArgoCD (~150MB vs ~500MB RAM)

---

**Setup by:** CodeArch on 2026-02-15
**Cluster:** homelab-control (K3s on Raspberry Pi)
