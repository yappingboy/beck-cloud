#!/usr/bin/env bash
# build-theme.sh — Package the BeckCloud Keycloak login theme into a tar.gz
# usage: ./build-theme.sh
set -euo pipefail

THEME_DIR="$(cd "$(dirname "$0")" && pwd)/beckcloud"
OUTPUT_DIR="$(cd "$(dirname "$0")" && pwd)/dist"

mkdir -p "$OUTPUT_DIR"

# Package the theme
cd "$THEME_DIR"
tar -czf "$OUTPUT_DIR/beckcloud.theme.tar.gz" --transform='s|^|beckcloud/|' .

echo "✓ Theme packaged: $OUTPUT_DIR/beckcloud.theme.tar.gz"

# Create the ConfigMap YAML
cat > "$OUTPUT_DIR/beckcloud-keycloak-theme.yaml" <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: beckcloud-keycloak-theme
  namespace: identity
  labels:
    app: keycloak
    theme: beckcloud
data:
  theme.properties: |
    parent=base
    templates= freemarker
    cacheEnabled=false
  login/messages/messages_en.properties: |
    loginTitle=Sign In
    loginIdpConfirmUsername=Or try a different account
    loginPasswordResetLink=Reset Password
    loginRegisterLink=Create an Account
    doLogIn=Sign In
    doRegister=Create Account
    doResetPassword=Reset Password
    doResetUsername=Recover Username
    doSubmit=Submit
    doCancel=Cancel
    rememberMe=Remember me
    username=Username or Email
    password=Password
    doLogIn=Sign In
  login/template.ftl: |
    TEMPLATE_PLACEHOLDER
  login/login.ftl: |
    TEMPLATE_PLACEHOLDER
  login/register.ftl: |
    TEMPLATE_PLACEHOLDER
  login/reset-password.ftl: |
    TEMPLATE_PLACEHOLDER
  login/forgot-username.ftl: |
    TEMPLATE_PLACEHOLDER
  login/otp-login.ftl: |
    TEMPLATE_PLACEHOLDER
  login/error.ftl: |
    TEMPLATE_PLACEHOLDER
  login/password-update.ftl: |
    TEMPLATE_PLACEHOLDER
  login/webauthn-authenticate.ftl: |
    TEMPLATE_PLACEHOLDER
  login/webauthn-register.ftl: |
    TEMPLATE_PLACEHOLDER
  login/login-username.ftl: |
    TEMPLATE_PLACEHOLDER
  login/login-oauth2.ftl: |
    TEMPLATE_PLACEHOLDER
  login/login-oauth2-grant.ftl: |
    TEMPLATE_PLACEHOLDER
  login/login-idp-link.ftl: |
    TEMPLATE_PLACEHOLDER
  login/resources/css/beckcloud.css: |
    CSS_PLACEHOLDER
  login/resources/images/beckcloud-logo.svg: |
    SVG_PLACEHOLDER
  login/resources/js/webauthn.js: |
    JS_PLACEHOLDER
EOF

echo "✓ ConfigMap manifest: $OUTPUT_DIR/beckcloud-keycloak-theme.yaml"
echo ""
echo "Deploy:"
echo "  kubectl apply -f $OUTPUT_DIR/beckcloud-keycloak-theme.yaml"
echo ""
echo "Then restart Keycloak:"
echo "  kubectl rollout restart deployment/keycloak -n identity"
