# CLAUDE.md - Movie Night App

This document explains the development, testing, and deployment workflow for the Movie Night family voting app.

## Overview

Movie Night is a family movie voting app with a Stremio addon integration. The family nominates movies, votes on them, and the app tracks watch history.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Local Dev      │────▶│  GitHub Actions  │────▶│  K8s (FluxCD)   │
│  192.168.1.100  │     │  Version Bump    │     │  Production     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Development Workflow

### 1. Local Testing

**Start local dev server:**
```bash
cd ~/Projects/movie-night
node server.js
```

**Test URLs:**
- Web UI: http://192.168.1.100:3000
- Manifest: http://192.168.1.100:3000/manifest.json
- Catalog: http://192.168.1.100:3000/catalog/movie/nominations.json
- Metadata: http://192.168.1.100:3000/meta/movie/tmdb:12345.json

**Install in Stremio (local):**
```
http://192.168.1.100:3000/manifest.json
```

### 2. Environment Setup

Local `.env` file (not committed):
```
PORT=3000
TMDB_API_KEY=<from 1Password: op://ClawdBot/TMDB API Key/credential>
MDBLIST_API_KEY=<from 1Password: op://ClawdBot/MDBList API Key/credential>
MDBLIST_LIST_ID=erix/movie-night
```

**Get secrets from 1Password:**
```bash
op read "op://ClawdBot/TMDB API Key/credential"
op read "op://ClawdBot/MDBList API Key/credential"
```

### 3. Data Files

- **Local:** `~/Projects/movie-night/data.json`
- **Production (K8s):** `/data/data.json` (PersistentVolume)

**Copy K8s data to local for testing:**
```bash
kubectl exec $(kubectl get pod -l app=movie-night -o jsonpath='{.items[0].metadata.name}') -- cat /data/data.json > data.json
```

## Deployment

### GitOps Pipeline

1. **Edit code** → Make changes locally
2. **Test locally** → `node server.js` on 192.168.1.100:3000
3. **Commit & push** → `git add . && git commit -m "..." && git push`
4. **GitHub Actions** → Auto-bumps version in `k8s/deployment.yaml`
5. **FluxCD** → Detects change, deploys to K8s (1-minute sync)
6. **Production live** → https://movies.erix-homelab.site

### Manual Flux Reconciliation

```bash
# Force immediate deployment
flux reconcile kustomization movie-night --with-source

# Check status
flux get kustomization movie-night
```

### Check Deployment Status

```bash
# Pods
kubectl get pods -l app=movie-night

# Logs
kubectl logs -l app=movie-night --tail=50

# Test endpoint inside cluster
kubectl exec <pod> -- wget -qO- http://localhost:3000/manifest.json
```

## Production URLs

- **Web UI:** https://movies.erix-homelab.site
- **Stremio Addon:** https://movies.erix-homelab.site/manifest.json

## Stremio Addon Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /manifest.json` | Addon manifest |
| `GET /catalog/movie/nominations.json` | This week's nominations |
| `GET /catalog/movie/winners.json` | Past winners |
| `GET /catalog/movie/watched.json` | All watched movies |
| `GET /meta/movie/tmdb:<id>.json` | Movie metadata with voting info |

## Kubernetes Resources

```
k8s/
├── deployment.yaml      # Main deployment (git-clone init container)
├── service.yaml         # ClusterIP service on port 3000
├── ingress.yaml         # Traefik ingress (movies.erix-homelab.site)
├── pvc.yaml             # PersistentVolumeClaim for data.json
├── sealed-secret.yaml   # Encrypted secrets (TMDB, MDBList keys)
└── kustomization.yaml   # Kustomize config
```

## Secrets Management

**NEVER commit plain secrets!** Use sealed secrets:

```bash
# Create sealed secret
kubectl create secret generic movie-night-secrets \
  --from-literal=tmdb-api-key=<key> \
  --from-literal=mdblist-api-key=<key> \
  --from-literal=mdblist-list-id=erix/movie-night \
  --dry-run=client -o yaml | kubeseal --format yaml > k8s/sealed-secret.yaml
```

## Troubleshooting

### Service not accessible

1. Check Traefik:
   ```bash
   kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik
   ```
   
2. Restart if needed:
   ```bash
   kubectl rollout restart deployment traefik -n kube-system
   ```

### Stremio catalog empty

1. Check data.json has nominations
2. Verify week number matches (checkAndUpdatePhase resets on new week)
3. Check pod logs for errors

### Metadata not loading

1. Verify TMDB_API_KEY is set and valid
2. Test TMDB API directly:
   ```bash
   curl "https://api.themoviedb.org/3/movie/550?api_key=<key>"
   ```

## Key Files

| File | Purpose |
|------|---------|
| `server.js` | Express server with all endpoints |
| `public/index.html` | Web UI (single-page app) |
| `data.json` | Local data storage |
| `.env` | Local environment variables |
| `.env.example` | Template for .env |

## Related Documentation

- [FLUX.md](./FLUX.md) - FluxCD setup details
- [SECURITY-INCIDENT.md](./SECURITY-INCIDENT.md) - API key rotation history
- [k8s/README-SEALED-SECRETS.md](./k8s/README-SEALED-SECRETS.md) - Sealed secrets guide
