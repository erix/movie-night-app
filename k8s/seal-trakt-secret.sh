#!/bin/bash
# seal-trakt-secret.sh
# Creates and seals movie-night-telegram secret (contains Telegram + Trakt credentials)
# Run this once kubectl/kubeseal can reach the cluster.
#
# The deployment.yaml references movie-night-telegram for:
#   telegram-bot-token, telegram-group-id,
#   trakt-client-id, trakt-client-secret, trakt-encryption-key

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

# ── Check tools ───────────────────────────────────────────────────────────────
for cmd in kubectl kubeseal; do
  command -v "$cmd" &>/dev/null || { echo "❌ $cmd not found"; exit 1; }
done

# ── Check cluster ─────────────────────────────────────────────────────────────
echo "🔍 Testing cluster connectivity..."
kubeseal --fetch-cert > /dev/null 2>&1 || {
  echo "❌ Cannot reach sealed-secrets controller."
  echo "   Fix kubeconfig first: kubectl config set-cluster default --server=https://<NODE_IP>:6443"
  exit 1
}
echo "✅ Cluster reachable"

# ── Load values ───────────────────────────────────────────────────────────────
[ -f "$ENV_FILE" ] || { echo "❌ .env not found at $ENV_FILE"; exit 1; }

get() { grep "^$1=" "$ENV_FILE" | cut -d= -f2-; }

TELEGRAM_BOT_TOKEN=$(get TELEGRAM_BOT_TOKEN)
TRAKT_CLIENT_ID=$(get TRAKT_CLIENT_ID)
TRAKT_CLIENT_SECRET=$(get TRAKT_CLIENT_SECRET)
TRAKT_ENCRYPTION_KEY=$(get TRAKT_ENCRYPTION_KEY)

# Telegram group ID (hardcoded since .env has it blank)
TELEGRAM_GROUP_ID="-5283005850"

for var in TELEGRAM_BOT_TOKEN TRAKT_CLIENT_ID TRAKT_CLIENT_SECRET TRAKT_ENCRYPTION_KEY; do
  [ -n "${!var}" ] || { echo "❌ $var is missing in .env"; exit 1; }
done

echo "📦 Creating and sealing movie-night-telegram..."

kubectl create secret generic movie-night-telegram \
  --from-literal=telegram-bot-token="$TELEGRAM_BOT_TOKEN" \
  --from-literal=telegram-group-id="$TELEGRAM_GROUP_ID" \
  --from-literal=trakt-client-id="$TRAKT_CLIENT_ID" \
  --from-literal=trakt-client-secret="$TRAKT_CLIENT_SECRET" \
  --from-literal=trakt-encryption-key="$TRAKT_ENCRYPTION_KEY" \
  --namespace=default \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > "$SCRIPT_DIR/sealed-secret-telegram.yaml"

grep -q "encryptedData" "$SCRIPT_DIR/sealed-secret-telegram.yaml" \
  && echo "✅ Written to k8s/sealed-secret-telegram.yaml" \
  || { echo "❌ Output looks wrong — check the file"; exit 1; }

echo ""
echo "Next steps:"
echo "  git add k8s/sealed-secret-telegram.yaml"
echo "  git commit -m 'Add sealed Telegram+Trakt secret'"
echo "  git push"
echo ""
echo "Flux will apply the SealedSecret automatically."
echo "Then restart the movie-night pod: kubectl rollout restart deployment/movie-night"
