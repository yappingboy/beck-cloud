#!/usr/bin/env bash
# deploy.sh — Deploy admin panel static files to Kubernetes via nginx configmap
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ADMIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
KUBE_NAMESPACE="webapps"
CONFIGMAP_NAME="admin-panel-content"

echo "🚀 Deploying BeckCloud Admin Panel..."

# Validate required files exist
if [ ! -f "$ADMIN_DIR/index.html" ]; then
  echo "❌ index.html not found at $ADMIN_DIR"
  exit 1
fi

# Create a temp directory for the kustomize overlay
TMP_DIR=$(mktemp -d)
trap "rm -rf '$TMP_DIR'" EXIT

# Copy admin files to temp dir
cp -r "$ADMIN_DIR"/* "$TMP_DIR/"

# Build tarball of admin content
cd "$TMP_DIR"
tar czf /tmp/admin-panel-content.tar.gz \
  --exclude='deploy.sh' \
  --exclude='*.md' \
  .

# Encode as base64 for the configmap
CONTENT_B64=$(base64 -w0 /tmp/admin-panel-content.tar.gz)

# Generate kubectl apply command
cat > "$TMP_DIR/apply.sh" << 'APPLY_EOF'
#!/usr/bin/env bash
# This script applies the admin panel to the cluster
# Usage: ./apply.sh
set -euo pipefail

KUBE_NAMESPACE="webapps"
CONFIGMAP_NAME="admin-panel-content"
ADMIN_DIR="$1"

# Copy all admin files to a temp staging area
STAGING=$(mktemp -d)
trap "rm -rf '$STAGING'" EXIT

cp -r "$ADMIN_DIR"/* "$STAGING/"

# Apply configmap from the staging directory
kubectl create configmap "$CONFIGMAP_NAME" \
  -n "$KUBE_NAMESPACE" \
  --from-file="$STAGING" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✅ Admin panel configmap updated."

# Restart the deployment to pick up new content
kubectl rollout restart deployment/admin-panel -n "$KUBE_NAMESPACE"
echo "🔄 Admin panel deployment restarted."
APPLY_EOF
chmod +x "$TMP_DIR/apply.sh"

echo "📦 Ready to deploy. Run:"
echo "   ./deploy-apply.sh $ADMIN_DIR"
echo ""
echo "Or use kubectl directly:"
echo "   kubectl create configmap $CONFIGMAP_NAME -n $KUBE_NAMESPACE --from-file=$ADMIN_DIR --dry-run=client -o yaml | kubectl apply -f -"
echo "   kubectl rollout restart deployment/admin-panel -n $KUBE_NAMESPACE"
