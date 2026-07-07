#!/usr/bin/env bash
# Build and push the user-invite Docker image.
# Run this on any machine with Docker installed.
#
# Usage: ./build-and-push.sh <registry>/<repo>:tag
# Example: ./build-and-push.sh ghcr.io/youruser/becklab-user-invite:v1

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <image-tag>"
    echo "Example: $0 ghcr.io/stephen/becklab-user-invite:v1"
    exit 1
fi

IMAGE_TAG="$1"

echo "Building ${IMAGE_TAG}..."
docker build -t "${IMAGE_TAG}" .

echo "Pushing ${IMAGE_TAG}..."
docker push "${IMAGE_TAG}"

# Update the deployment.yaml with the new image
DEPLOY_YAML="deployment.yaml"
if [ -f "$DEPLOY_YAML" ]; then
    # Update in-place (Linux/macOS sed)
    sed -i "s|image: becklab/user-invite:latest|image: ${IMAGE_TAG}|g" "$DEPLOY_YAML"
    echo "Updated deployment.yaml with image: ${IMAGE_TAG}"
fi

echo ""
echo "✅ Done! Image pushed and deployment updated."
echo "Commit the changes:"
echo "  git add flux/apps/user-invite/ apps/user-invite/"
echo "  git commit -m 'feat: deploy user-invite tool'"
echo "  git push"
