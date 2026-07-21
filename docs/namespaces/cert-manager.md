# cert-manager

**Purpose:** Automated TLS certificate provisioning and management.

**What it does:** Implements the Kubernetes Certificate API, allowing users to request certificates via `Certificate` custom resources. Automatically provisions certificates from ACME providers (typically Let's Encrypt), handles renewal, OCSP stapling, and integrates with Traefik via Issuer/ClusterIssuer resources. Includes the webhook for certificate validation and the CA injector for sidecar injection of custom CA roots into pods.

**Key components:** cert-manager controller, cert-manager-cainjector, cert-manager-webhook.
