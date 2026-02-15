# GitHub Actions Workflows

## update-version.yml

Automatically updates the k8s deployment version annotation when app code changes.

**Triggers on changes to:**
- `server.js`
- `public/**`
- `package.json`
- `.env.example`
- `Dockerfile`

**What it does:**
1. Detects code changes on push to master
2. Updates `version: "..."` annotation in `k8s/deployment.yaml` with commit SHA + timestamp
3. Commits and pushes the change (with `[skip-version]` to prevent loops)
4. FluxCD detects the deployment.yaml change and triggers a rolling restart
5. Pod restarts, git-clone init container pulls fresh code, app updated!

**Skip auto-update:**
Add `[skip-version]` to your commit message to skip the workflow.

**Manual trigger:**
You can also manually restart: `kubectl rollout restart deployment movie-night`
