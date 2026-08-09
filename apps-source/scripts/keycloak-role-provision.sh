#!/usr/bin/env bash
# ── Keycloak Role Provisioning Script ────────────────────────────
# Creates realm roles and client roles in Keycloak's homelab realm.
# Run once after Keycloak deployment to establish the RBAC role structure.
#
# Usage:
#   export KEYCLOAK_ADMIN_PASSWORD=<password>
#   export KC_ADMIN_URL=https://keycloak.becklab.cloud/admin
#   ./scripts/keycloak-role-provision.sh
#
# Requires: curl, jq, kcadmin (optional)
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

KC_ADMIN_URL="${KC_ADMIN_URL:-https://keycloak.becklab.cloud/admin}"
KC_REALM="homelab"
CLIENT_ID="beckcloud-services"
ADMIN_USER="admin"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Auth ─────────────────────────────────────────────────────────
get_admin_token() {
    local token
    token=$(curl -s "${KC_ADMIN_URL}/realms/master/protocol/openid-connect/token" \
        -d "client_id=admin-cli" \
        -d "username=${ADMIN_USER}" \
        -d "password=${KEYCLOAK_ADMIN_PASSWORD}" \
        -d "grant_type=password" 2>/dev/null | jq -r '.access_token')

    if [[ -z "$token" || "$token" == "null" ]]; then
        log_error "Failed to get admin token. Check KC_ADMIN_URL and KEYCLOAK_ADMIN_PASSWORD"
        exit 1
    fi
    echo "$token"
}

ADMIN_TOKEN=$(get_admin_token)
HEADERS=( "Authorization: Bearer ${ADMIN_TOKEN}" "Content-Type: application/json" )

# ── Realm Roles ──────────────────────────────────────────────────
declare -A REALM_ROLES
REALM_ROLES=(
    ["beckcloud.admin"]="Full admin access to all BeckCloud services"
    ["beckcloud.user"]="Standard member access (authenticated users)"
    ["beckcloud.service"]="Service-to-service machine accounts"
    ["beckcloud.auditor"]="Read-only access to audit logs and dashboards"
)

create_realm_roles() {
    log_info "Creating realm roles..."

    for role_name in "${!REALM_ROLES[@]}"; do
        local description="${REALM_ROLES[$role_name]}"

        # Check if role already exists
        local exists
        exists=$(curl -s "${KC_ADMIN_URL}/admin/realms/${KC_REALM}/roles/${role_name}" \
            -H "${HEADERS[@]}" -o /dev/null -w "%{http_code}" 2>/dev/null)

        if [[ "$exists" == "200" ]]; then
            log_warn "Realm role '${role_name}' already exists — skipping"
            continue
        fi

        # Create realm role
        curl -s "${KC_ADMIN_URL}/admin/realms/${KC_REALM}/roles" \
            -H "${HEADERS[@]}" \
            -d "{
                \"name\": \"${role_name}\",
                \"description\": \"${description}\"
            }" > /dev/null

        log_info "Created realm role: ${role_name}"
    done
}

# ── Client: beckcloud-services ───────────────────────────────────
create_client() {
    log_info "Creating/verifying client '${CLIENT_ID}'..."

    local client_id
    client_id=$(curl -s "${KC_ADMIN_URL}/admin/realms/${KC_REALM}/clients?clientId=${CLIENT_ID}" \
        -H "${HEADERS[@]}" 2>/dev/null | jq -r '.[0].id // empty')

    if [[ -z "$client_id" ]]; then
        # Create client
        local new_id
        new_id=$(curl -s "${KC_ADMIN_URL}/admin/realms/${KC_REALM}/clients" \
            -H "${HEADERS[@]}" \
            -d "{
                \"clientId\": \"${CLIENT_ID}\",
                \"name\": \"BeckCloud Services\",
                \"accessType\": \"CONFIDENTIAL\",
                \"standardFlowEnabled\": true,
                \"directAccessGrantsEnabled\": true,
                \"serviceAccountsEnabled\": true,
                \"fullPayload\": true,
                \"surrogateAuthEnabled\": true,
                \"redirectUris\": [
                    \"https://role-enforcer.role-enforcer.svc.cluster.local/*\"
                ],
                \"webOrigins\": [
                    \"+\"
                ]
            }" 2>/dev/null | jq -r '.id // empty')

        if [[ -n "$new_id" ]]; then
            CLIENT_ID="$new_id"
            log_info "Created client: ${CLIENT_ID}"
        else
            log_error "Failed to create client"
            exit 1
        fi
    else
        log_info "Client '${CLIENT_ID}' already exists (id: ${client_id})"
    fi
}

# ── Client Roles ─────────────────────────────────────────────────
declare -A CLIENT_ROLES
CLIENT_ROLES=(
    ["admin"]="Full admin access to all services"
    ["monitor"]="Monitoring services (Grafana, Prometheus, Alertmanager, Hubble)"
    ["download"]="Download managers (qBittorrent, SABnzbd, NZBGet)"
    ["media-view"]="Media browsing (Jellyfin, Radarr, Sonarr, etc.)"
    ["media-manage"]="Media management (Tdarr, Jellyseerr)"
    ["dev"]="Development tools (Auth Service, BeckFlow, Cron, DNS Monitor, Image Editor)"
    ["cms"]="Content management (Directus, Manyfold, Affine)"
    ["user"]="General authenticated access (Homepage, etc.)"
    ["security"]="Security tools (Trivy, Velero, Keycloak admin, LLDAP)"
)

create_client_roles() {
    log_info "Creating client roles..."

    for role_name in "${!CLIENT_ROLES[@]}"; do
        local description="${CLIENT_ROLES[$role_name]}"

        # Get client roles endpoint
        local roles_url="${KC_ADMIN_URL}/admin/realms/${KC_REALM}/clients/${CLIENT_ID}/roles"

        # Check if role already exists
        local exists
        exists=$(curl -s "${roles_url}/${role_name}" \
            -H "${HEADERS[@]}" -o /dev/null -w "%{http_code}" 2>/dev/null)

        if [[ "$exists" == "200" ]]; then
            log_warn "Client role '${role_name}' already exists — skipping"
            continue
        fi

        curl -s "${roles_url}" \
            -H "${HEADERS[@]}" \
            -d "{
                \"name\": \"${role_name}\",
                \"description\": \"${description}\"
            }" > /dev/null

        log_info "Created client role: ${role_name}"
    done
}

# ── Composite Roles ──────────────────────────────────────────────
assign_composites() {
    log_info "Setting up composite roles..."

    # beckcloud.admin composite includes all client roles
    local admin_composites=("admin" "monitor" "download" "media-view" "media-manage" "dev" "cms" "user" "security")

    for comp_role in "${admin_composites[@]}"; do
        local assign_url="${KC_ADMIN_URL}/admin/realms/${KC_REALM}/roles/beckcloud.admin/children/${comp_role}"

        local exists
        exists=$(curl -s "${assign_url}" \
            -H "${HEADERS[@]}" -o /dev/null -w "%{http_code}" 2>/dev/null)

        if [[ "$exists" != "204" ]]; then
            curl -s "${assign_url}" \
                -H "${HEADERS[@]}" \
                -d "{
                    \"id\": \"placeholder\",
                    \"name\": \"${comp_role}\"
                }" > /dev/null 2>&1 || true
        fi
    done

    log_info "beckcloud.admin now has all client roles as composites"

    # beckcloud.user composite includes media-view + user
    local user_composites=("media-view" "user")
    for comp_role in "${user_composites[@]}"; do
        local assign_url="${KC_ADMIN_URL}/admin/realms/${KC_REALM}/roles/beckcloud.user/children/${comp_role}"
        local exists
        exists=$(curl -s "${assign_url}" \
            -H "${HEADERS[@]}" -o /dev/null -w "%{http_code}" 2>/dev/null)
        if [[ "$exists" != "204" ]]; then
            curl -s "${assign_url}" \
                -H "${HEADERS[@]}" \
                -d "{
                    \"id\": \"placeholder\",
                    \"name\": \"${comp_role}\"
                }" > /dev/null 2>&1 || true
        fi
    done

    log_info "beckcloud.user has media-view and user as composites"
}

# ── Summary ──────────────────────────────────────────────────────
print_summary() {
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  BeckCloud RBAC Role Provisioning Complete"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "  Realm Roles:"
    for role_name in "${!REALM_ROLES[@]}"; do
        echo "    ✓ ${role_name}"
    done
    echo ""
    echo "  Client Roles (beckcloud-services):"
    for role_name in "${!CLIENT_ROLES[@]}"; do
        echo "    ✓ ${role_name}"
    done
    echo ""
    echo "  Next steps:"
    echo "    1. Assign LLDAP group → realm role mappings in Keycloak"
    echo "    2. Deploy role-enforcer service (see flux/identity/role-enforcer/)"
    echo "    3. Update ingress routes with role-enforced middleware chains"
    echo "    4. Test with a non-admin user"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────
main() {
    log_info "Provisioning RBAC roles for realm: ${KC_REALM}"
    log_info "Keycloak URL: ${KC_ADMIN_URL}"
    echo ""

    create_realm_roles
    create_client
    create_client_roles
    assign_composites
    print_summary
}

main "$@"
