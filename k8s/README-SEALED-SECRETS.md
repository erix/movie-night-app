# Sealed Secrets - Quick Reference

## Rotate TMDB API Key

```bash
# After getting new key from https://www.themoviedb.org/settings/api

# 1. Create new sealed secret
kubectl create secret generic movie-night-secrets \
  --from-literal=tmdb-api-key=YOUR_NEW_KEY_HERE \
  --namespace=default \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > ~/Projects/movie-night/k8s/sealed-secret.yaml

# 2. Commit and push
cd ~/Projects/movie-night
git add k8s/sealed-secret.yaml
git commit -m "Rotate TMDB API key"
git push

# Flux will auto-deploy and restart the pod
```

## Add New Secrets

```bash
# Single value
kubectl create secret generic my-secret \
  --from-literal=password=mysecret \
  --namespace=default \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > k8s/my-sealed-secret.yaml

# Multiple values
kubectl create secret generic my-secret \
  --from-literal=username=admin \
  --from-literal=password=secret \
  --from-file=config.json \
  --namespace=default \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > k8s/my-sealed-secret.yaml
```

## Update Existing Secret

Just recreate the sealed secret (same commands as above) and push. Flux will update it.

## Verify Secret

```bash
# Check sealed secret exists
kubectl get sealedsecret movie-night-secrets

# Check it was unsealed (STATUS should be "True")
kubectl get sealedsecret movie-night-secrets -o yaml | grep status -A 5

# View the unsealed secret (base64 decoded)
kubectl get secret movie-night-secrets -o jsonpath='{.data.tmdb-api-key}' | base64 -d
```

## How It Works

1. **You create** a regular Kubernetes secret (with `--dry-run`, not applied)
2. **kubeseal encrypts it** using your cluster's public key
3. **You commit** the encrypted SealedSecret to git (safe!)
4. **Flux deploys** the SealedSecret to your cluster
5. **sealed-secrets controller** decrypts it into a regular Secret
6. **Your app** uses the regular Secret

✅ Only your cluster can decrypt  
✅ Safe to commit to public repos  
✅ Full GitOps workflow  

---

**Sealed Secrets Controller:** Running in `kube-system` namespace  
**Version:** Check with `kubectl get deployment -n kube-system sealed-secrets-controller -o jsonpath='{.spec.template.spec.containers[0].image}'`
