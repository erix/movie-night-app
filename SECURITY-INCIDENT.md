# Security Incident - TMDB API Key Exposure

## ⚠️ INCIDENT SUMMARY

**Date:** 2026-02-15  
**Severity:** Medium  
**Status:** Remediated (key rotation required)

The TMDB API key was accidentally committed to the public GitHub repository in `k8s/secret.yaml`.

**Exposed key (base64):** `YTZlODkxYzMxMTA2Zjc0OGVhNzlkMTBkZDJmMTNhZGU=`  
**Decoded:** `a6e891c3106f748ea79d10dd2f13ade`

## REMEDIATION COMPLETED

✅ Removed `k8s/secret.yaml` from git  
✅ Created sealed secret in `k8s/sealed-secret.yaml`  
✅ Cleaned git history (removed secret from all commits)  
✅ Ready to force push to GitHub

## NEXT STEPS (REQUIRED)

### 1. Rotate TMDB API Key

Go to: https://www.themoviedb.org/settings/api

1. Revoke/delete the current API key
2. Generate a new API key
3. Update the sealed secret:

```bash
# Create new secret with new key
kubectl create secret generic movie-night-secrets \
  --from-literal=tmdb-api-key=YOUR_NEW_KEY \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > k8s/sealed-secret.yaml

# Commit and push
git add k8s/sealed-secret.yaml
git commit -m "Rotate TMDB API key after exposure"
git push
```

### 2. Force Push to GitHub (Already prepared)

This will overwrite GitHub history to remove the leaked key:

```bash
cd ~/Projects/movie-night
git push --force-with-lease origin master
```

⚠️ **Warning:** This rewrites public history. Anyone who has cloned the repo should `git pull --rebase` after this.

### 3. Monitor for Abuse

Check TMDB API usage for unusual activity:  
https://www.themoviedb.org/settings/api

## WHY SEALED SECRETS?

Sealed Secrets encrypt sensitive data using your cluster's public key. Only the sealed-secrets controller in your cluster can decrypt them.

- ✅ Safe to commit to public repos
- ✅ GitOps-friendly
- ✅ Audit trail in git
- ✅ Disaster recovery (encrypted secrets backed up in git)

## LESSONS LEARNED

1. Never commit plain secrets to git
2. Use sealed secrets for all K8s secrets
3. Scan repos for secrets before making public
4. Regular security audits

---

**Prepared by:** CodeArch  
**Date:** 2026-02-15
