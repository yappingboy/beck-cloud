#!/usr/bin/env python3
"""
sync-homepage-services.py
=========================
Scans the Flux-managed YAML files under beck-cloud/flux/ for all IngressRoute
and Ingress resources, then generates the complete Homepage (gethomepage.dev)
configuration:

  1. Kustomize strategic-merge patches that add gethomepage.dev/* annotations
     to every IngressRoute / Ingress, enabling automatic service discovery.
  2. An updated kubernetes.yaml that enables traefik IngressRoute discovery.
  3. A minimal services.yaml for services that are not exposed via IngressRoute.

The patches are written to:
    flux/infrastructure/webapps/homepage/patches/

The kustomization.yaml is updated to include the patches.

Usage:
    cd beck-cloud
    python3 scripts/sync-homepage-services.py [--dry-run]

Author: BeckCloud SRE
Created: 2026-07-20
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml


# ---------------------------------------------------------------------------
# Service metadata registry
# ---------------------------------------------------------------------------

@dataclass
class ServiceMeta:
    name: str
    description: str
    group: str
    icon: str
    widget_type: Optional[str] = None
    widget_url: Optional[str] = None
    widget_username: Optional[str] = None
    widget_password: Optional[str] = None
    pod_selector: Optional[str] = None
    weight: int = 10
    app_label: Optional[str] = None
    enabled: bool = True
    extra_annotations: Dict[str, str] = field(default_factory=dict)

    @property
    def annotations(self) -> Dict[str, str]:
        ann: Dict[str, str] = {}
        if self.enabled:
            ann["gethomepage.dev/enabled"] = "true"
        ann["gethomepage.dev/description"] = self.description
        ann["gethomepage.dev/group"] = self.group
        ann["gethomepage.dev/icon"] = self.icon
        ann["gethomepage.dev/name"] = self.name
        if self.widget_type:
            ann["gethomepage.dev/widget.type"] = self.widget_type
            if self.widget_url:
                ann["gethomepage.dev/widget.url"] = self.widget_url
            if self.widget_username:
                ann["gethomepage.dev/widget.username"] = self.widget_username
            if self.widget_password:
                ann["gethomepage.dev/widget.password"] = self.widget_password
        if self.pod_selector is not None:
            ann["gethomepage.dev/pod-selector"] = self.pod_selector
        ann["gethomepage.dev/weight"] = str(self.weight)
        if self.app_label:
            ann["gethomepage.dev/app"] = self.app_label
        ann.update(self.extra_annotations)
        return ann


# ---------------------------------------------------------------------------
# Service registry  - key = (namespace, host)
# ---------------------------------------------------------------------------
SERVICE_REGISTRY: Dict[tuple, ServiceMeta] = {
    # -- 3D Printing --
    ("3dprinting", "fdm.becklab.cloud"): ServiceMeta(
        name="FDM Monster", description="Printer monitoring",
        group="3D Printing", icon="si-bambulab",
        widget_type="customapi", widget_url="https://fdm.becklab.cloud/api/printer",
        weight=1,
    ),
    ("3dprinting", "manyfold.becklab.cloud"): ServiceMeta(
        name="Manyfold", description="Model library",
        group="3D Printing", icon="mdi-printer-3d",
        weight=2,
    ),
    ("3dprinting", "spoolman.becklab.cloud"): ServiceMeta(
        name="Spoolman", description="Filament tracker",
        group="3D Printing", icon="mdi-spool",
        widget_type="spoolman", widget_url="https://spoolman.becklab.cloud",
        weight=3,
    ),
    ("3dprinting", "slicer.becklab.cloud"): ServiceMeta(
        name="Orca Slicer", description="3D slicing web UI",
        group="3D Printing", icon="si-bambulab",
        weight=4,
    ),
    ("3dprinting", "bump.becklab.cloud"): ServiceMeta(
        name="Bumpmesh", description="Mesh analysis",
        group="3D Printing", icon="mdi-cube-scan",
        weight=5,
    ),

    # -- Gridspace --
    ("gridspace", "kiri.becklab.cloud"): ServiceMeta(
        name="Kiri:Moto", description="3D slicer",
        group="Apps", icon="mdi-printer-3d", weight=1,
    ),
    ("gridspace", "mesh.becklab.cloud"): ServiceMeta(
        name="Mesh:Tool", description="Mesh repair",
        group="Apps", icon="mdi-cube-outline", weight=2,
    ),
    ("gridspace", "void.becklab.cloud"): ServiceMeta(
        name="Void:Form", description="Generative design",
        group="Apps", icon="mdi-cube-unfolded", weight=3,
    ),

    # -- Identity --
    ("identity", "keycloak.becklab.cloud"): ServiceMeta(
        name="Keycloak", description="SSO / Identity",
        group="Identity", icon="keycloak.png",
        widget_type="keycloak", widget_url="https://keycloak.becklab.cloud",
        weight=1,
    ),
    ("identity", "lldap.becklab.cloud"): ServiceMeta(
        name="LDAP", description="LDAP directory",
        group="Identity", icon="mdi-account-group",
        weight=2,
    ),
    ("identity", "logout.becklab.cloud"): ServiceMeta(
        name="SSO Logout", description="Sign out",
        group="Identity", icon="mdi-logout-variant",
        weight=99,
    ),
    ("identity", "admin.becklab.cloud"): ServiceMeta(
        name="User Invite", description="User provisioning",
        group="Identity", icon="mdi-account-plus",
        weight=4,
    ),

    # -- Monitoring --
    ("monitoring", "grafana.becklab.cloud"): ServiceMeta(
        name="Grafana", description="Dashboards",
        group="Monitoring", icon="si-grafana",
        widget_type="grafana", widget_url="https://grafana.becklab.cloud",
        weight=1,
    ),
    ("monitoring", "hubble.becklab.cloud"): ServiceMeta(
        name="Hubble", description="CNI observability",
        group="Monitoring", icon="mdi-network",
        weight=2,
    ),

    # -- Media (ClusterIP Ingresses, internal-only) --
    ("media", "jellyfin.becklab.cloud"): ServiceMeta(
        name="Jellyfin", description="Media streaming",
        group="Media", icon="si-jellyfin",
        widget_type="jellyfin", widget_url="https://jellyfin.becklab.cloud",
        weight=1,
    ),
    ("media", "sonarr.becklab.cloud"): ServiceMeta(
        name="Sonarr", description="TV show manager",
        group="Media", icon="si-sonarr",
        widget_type="sonarr", widget_url="https://sonarr.becklab.cloud",
        weight=2,
    ),
    ("media", "radarr.becklab.cloud"): ServiceMeta(
        name="Radarr", description="Movie manager",
        group="Media", icon="si-radarr",
        widget_type="radarr", widget_url="https://radarr.becklab.cloud",
        weight=3,
    ),
    ("media", "bazarr.becklab.cloud"): ServiceMeta(
        name="Bazarr", description="Subtitle manager",
        group="Media", icon="bazarr",
        widget_type="bazarr", widget_url="https://bazarr.becklab.cloud",
        weight=4,
    ),
    ("media", "prowlarr.becklab.cloud"): ServiceMeta(
        name="Prowlarr", description="Indexer manager",
        group="Media", icon="mdi-rss",
        widget_type="prowlarr", widget_url="https://prowlarr.becklab.cloud",
        weight=5,
    ),
    ("media", "sabnzbd.becklab.cloud"): ServiceMeta(
        name="SABnzbd", description="NZB downloader",
        group="Media", icon="mdi-download",
        widget_type="sabnzbd", widget_url="https://sabnzbd.becklab.cloud",
        weight=6,
    ),
    ("media", "nzbget.becklab.cloud"): ServiceMeta(
        name="NZBGet", description="NZB downloader",
        group="Media", icon="mdi-download-circle",
        widget_type="nzbget", widget_url="https://nzbget.becklab.cloud",
        weight=7,
    ),
    ("media", "qbit.becklab.cloud"): ServiceMeta(
        name="qBittorrent", description="Torrent downloads",
        group="Media", icon="si-qbittorrent",
        widget_type="qbittorrent", widget_url="https://qbit.becklab.cloud",
        weight=8,
    ),
    ("media", "tdarr.becklab.cloud"): ServiceMeta(
        name="Tdarr", description="Media transcoding",
        group="Media", icon="mdi-filmstrip-box",
        widget_type="tdarr", widget_url="https://tdarr.becklab.cloud",
        weight=9,
    ),
    ("media", "requests.becklab.cloud"): ServiceMeta(
        name="Jellyseerr", description="Media requests",
        group="Media", icon="mdi-television-box",
        widget_type="seerr", widget_url="https://requests.becklab.cloud",
        weight=10,
    ),
    ("media", "homebox.becklab.cloud"): ServiceMeta(
        name="Homebox", description="Home inventory",
        group="Apps", icon="mdi-box",
        widget_type="homebox", widget_url="https://homebox.becklab.cloud",
        weight=11,
    ),
    ("media", "spotweb.becklab.cloud"): ServiceMeta(
        name="Spotweb", description="NZB search",
        group="Media", icon="mdi-web",
        weight=12,
    ),

    # -- Webapps --
    ("webapps", "affine.becklab.cloud"): ServiceMeta(
        name="Affine", description="Collaborative wiki",
        group="Apps", icon="si-affine", weight=1,
    ),
    ("webapps", "bw.becklab.cloud"): ServiceMeta(
        name="Bitwarden BSM", description="Secrets manager",
        group="Identity", icon="si-bitwarden",
        weight=3,
    ),
    ("webapps", "cms.becklab.cloud"): ServiceMeta(
        name="Directus", description="Headless CMS",
        group="Apps", icon="si-directus",
        weight=2,
    ),
    ("webapps", "ha.becklab.cloud"): ServiceMeta(
        name="Home Assistant", description="Smart home",
        group="Apps", icon="si-homeassistant",
        widget_type="homeassistant", widget_url="https://ha.becklab.cloud",
        weight=3,
    ),
    ("webapps", "silex.becklab.cloud"): ServiceMeta(
        name="Silex", description="Design tool",
        group="Apps", icon="mdi-pencil-ruler",
        weight=4,
    ),
    ("webapps", "nova.becklab.cloud"): ServiceMeta(
        name="OpenClaw", description="AI assistant",
        group="Apps", icon="mdi-robot",
        weight=5,
    ),

    # -- OpenNebula --
    ("opennebula", "one.becklab.cloud"): ServiceMeta(
        name="OpenNebula", description="VM Management",
        group="Infrastructure", icon="si-opennebula",
        weight=1,
    ),

    # -- Traefik --
    ("traefik", "traefik.becklab.cloud"): ServiceMeta(
        name="Traefik", description="Ingress dashboard",
        group="Infrastructure", icon="mdi-server",
        weight=2,
    ),

    # -- Gaming --
    ("gaming", "crafty.becklab.cloud"): ServiceMeta(
        name="Crafty Controller", description="Minecraft server",
        group="Gaming", icon="crafty-controller",
        widget_type="minecraft", widget_url="https://crafty.becklab.cloud",
        weight=1,
    ),

    # -- Landing (disabled - not a service) --
    ("webapps", "becklab.cloud"): ServiceMeta(
        name="BeckCloud", description="Landing page",
        group="Infrastructure", icon="mdi-domain",
        weight=10,
        enabled=False,
    ),
}


# -- Host-to-registry mapping for quick lookup --
HOST_TO_META: Dict[str, ServiceMeta] = {}
for (ns, host), meta in SERVICE_REGISTRY.items():
    if host not in HOST_TO_META:
        HOST_TO_META[host] = meta


# -- Ingress name -> (namespace, host) fallback mapping --
INGRESS_NAME_MAP: Dict[str, tuple] = {
    "jellyfin": ("media", "jellyfin.becklab.cloud"),
    "sonarr": ("media", "sonarr.becklab.cloud"),
    "radarr": ("media", "radarr.becklab.cloud"),
    "bazarr": ("media", "bazarr.becklab.cloud"),
    "prowlarr": ("media", "prowlarr.becklab.cloud"),
    "sabnzbd": ("media", "sabnzbd.becklab.cloud"),
    "nzbget": ("media", "nzbget.becklab.cloud"),
    "qbit-gluetun": ("media", "qbit.becklab.cloud"),
    "tdarr": ("media", "tdarr.becklab.cloud"),
    "jellyseerr": ("media", "requests.becklab.cloud"),
    "homebox": ("media", "homebox.becklab.cloud"),
    "spotweb": ("media", "spotweb.becklab.cloud"),
    "fdmmonster": ("3dprinting", "fdm.becklab.cloud"),
    "manyfold": ("3dprinting", "manyfold.becklab.cloud"),
    "spoolman": ("3dprinting", "spoolman.becklab.cloud"),
    "orcaslicer": ("3dprinting", "slicer.becklab.cloud"),
    "bumpmesh": ("3dprinting", "bump.becklab.cloud"),
    "keycloak": ("identity", "keycloak.becklab.cloud"),
    "lldap": ("identity", "lldap.becklab.cloud"),
    "logout-page": ("identity", "logout.becklab.cloud"),
    "traefik-dashboard-https": ("traefik", "traefik.becklab.cloud"),
    "sunstone": ("opennebula", "one.becklab.cloud"),
    "crafty": ("gaming", "crafty.becklab.cloud"),
}

# -- Services to skip entirely --
SKIP_NAMES = {
    "homepage",
    "sso-redirect",
    "sso-error",
}


# ---------------------------------------------------------------------------
# YAML parsing
# ---------------------------------------------------------------------------

def parse_yaml_documents(filepath: Path) -> List[Dict[str, Any]]:
    """Parse a YAML file that may contain multiple documents."""
    docs: List[Dict[str, Any]] = []
    try:
        with open(filepath, "r") as f:
            for doc in yaml.safe_load_all(f):
                if doc:
                    docs.append(doc)
    except Exception as e:
        print(f"  Warning: Failed to parse {filepath}: {e}")
    return docs


def extract_host_from_ingress(doc: Dict[str, Any]) -> Optional[str]:
    """Extract the host from a Kubernetes Ingress resource."""
    spec = doc.get("spec", {})
    rules = spec.get("rules", [])
    for rule in rules:
        host = rule.get("host")
        if host:
            return host
    return None


def extract_host_from_ingressroute(doc: Dict[str, Any]) -> Optional[str]:
    """Extract the host from a Traefik IngressRoute resource."""
    spec = doc.get("spec", {})
    routes = spec.get("routes", [])
    for route in routes:
        match = route.get("match", "")
        m = re.search(r"Host\(`([^`]+)`\)", match)
        if m:
            return m.group(1)
    ann = doc.get("metadata", {}).get("annotations", {})
    href = ann.get("gethomepage.dev/href", "")
    if href:
        return re.sub(r"^https?://", "", href).split("/")[0]
    return None


def find_ingress_resources(root: Path) -> List[Dict[str, Any]]:
    """Walk the flux directory and find all IngressRoute and Ingress resources."""
    resources: List[Dict[str, Any]] = []
    flux_dir = root / "flux"
    # Paths to skip (generated patches, not source of truth)
    skip_dirs = {
        str(root / "flux" / "infrastructure" / "webapps" / "homepage"),
    }
    for filepath in sorted(flux_dir.rglob("*.yaml")):
        # Skip files under the homepage directory (patches are generated, not source)
        if any(str(filepath).startswith(skip) for skip in skip_dirs):
            continue
        for doc in parse_yaml_documents(filepath):
            kind = doc.get("kind", "")
            if kind in ("IngressRoute", "Ingress"):
                metadata = doc.get("metadata", {})
                name = metadata.get("name", "")
                namespace = metadata.get("namespace", "")
                if name in SKIP_NAMES:
                    continue
                resources.append({
                    "doc": doc,
                    "filepath": str(filepath),
                    "name": name,
                    "namespace": namespace,
                    "kind": kind,
                })
    return resources


# ---------------------------------------------------------------------------
# Annotation resolution
# ---------------------------------------------------------------------------

def resolve_host(res: Dict[str, Any]) -> Optional[str]:
    """Try to determine the host for a resource."""
    doc = res["doc"]
    kind = res["kind"]
    name = res["name"]
    namespace = res["namespace"]

    if kind == "IngressRoute":
        host = extract_host_from_ingressroute(doc)
        if host:
            return host

    if kind == "Ingress":
        host = extract_host_from_ingress(doc)
        if host:
            return host

    # Fallback: ingress name map
    key = (namespace, name)
    if key in INGRESS_NAME_MAP:
        _, host = INGRESS_NAME_MAP[key]
        return host

    # Try name lookup without namespace
    for ns, h in INGRESS_NAME_MAP.items():
        if name == ns:
            return h[1]

    return None


def resolve_meta(res: Dict[str, Any], host: str) -> Optional[ServiceMeta]:
    """Look up service metadata for a resolved host."""
    return HOST_TO_META.get(host)


# ---------------------------------------------------------------------------
# Patch generation
# ---------------------------------------------------------------------------

def generate_patch(res: Dict[str, Any], meta: ServiceMeta, host: str) -> Dict[str, Any]:
    """Generate a strategic-merge patch for an IngressRoute or Ingress."""
    doc = res["doc"]
    metadata = doc.get("metadata", {})
    annotations = dict(meta.annotations)
    # For IngressRoutes, add the href annotation
    if res["kind"] == "IngressRoute":
        annotations["gethomepage.dev/href"] = f"https://{host}"

    patch = {
        "apiVersion": doc.get("apiVersion", "traefik.io/v1alpha1"),
        "kind": res["kind"],
        "metadata": {
            "name": metadata["name"],
            "namespace": metadata.get("namespace", ""),
            "annotations": annotations,
        },
    }
    return patch


def yaml_dump(doc: Dict[str, Any]) -> str:
    """Dump a dict to YAML."""
    return yaml.dump(doc, default_flow_style=False, sort_keys=False)


# ---------------------------------------------------------------------------
# Homepage config generation
# ---------------------------------------------------------------------------

def generate_kubernetes_yaml() -> str:
    """Generate kubernetes.yaml for Homepage."""
    return yaml.dump({
        "mode": "cluster",
        "ingress": True,
        "traefik": True,
    }, default_flow_style=False, sort_keys=False)


def generate_settings_yaml() -> str:
    """Generate a minimal settings.yaml."""
    return yaml.dump({
        "title": "Becklab",
        "theme": "dark",
        "color": "auto",
        "headerStyle": "clean",
        "background": {
            "image": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=2000&q=80",
            "blur": True,
            "brightness": 0.5,
            "opacity": 0.4,
        },
        "layout": {
            "Media": {"style": "row", "columns": 4},
            "3D Printing": {"style": "row", "columns": 4},
            "Apps": {"style": "row", "columns": 4},
            "Security": {"style": "row", "columns": 3},
            "Monitoring": {"style": "row", "columns": 4},
            "Identity": {"style": "row", "columns": 4},
            "Infrastructure": {"style": "row", "columns": 4},
            "Gaming": {"style": "row", "columns": 2},
        },
    }, default_flow_style=False, sort_keys=False)


def generate_widgets_yaml() -> str:
    """Generate widgets.yaml for Homepage."""
    return yaml.dump({
        "resources": {
            "cpu": True,
            "memory": True,
            "label": "Cluster",
        },
        "datetime": {
            "text_size": "xl",
            "format": {
                "timeStyle": "short",
                "dateStyle": "short",
            },
        },
        "search": {
            "provider": "duckduckgo",
            "target": "_blank",
        },
    }, default_flow_style=False, sort_keys=False)


# ---------------------------------------------------------------------------
# HelmRelease update
# ---------------------------------------------------------------------------

def update_helm_release(root: Path):
    """Update the Homepage HelmRelease to use the new config approach."""
    hr_path = root / "flux" / "infrastructure" / "webapps" / "homepage" / "helmrelease.yaml"
    with open(hr_path, "r") as f:
        hr = yaml.safe_load(f)

    spec = hr.get("spec", {})

    # Build the new ConfigMap patch content
    new_config_patch = {
        "apiVersion": "v1",
        "kind": "ConfigMap",
        "metadata": {"name": "homepage"},
        "data": {
            "settings.yaml": generate_settings_yaml(),
            "widgets.yaml": generate_widgets_yaml(),
            "services.yaml": "",  # Empty - all discovered via annotations
            "bookmarks.yaml": yaml.dump([]),
            "kubernetes.yaml": generate_kubernetes_yaml(),
            "docker.yaml": yaml.dump({}),
        },
    }

    patch_text = yaml_dump(new_config_patch)

    # Update or create the post-renderer
    if "postRenderers" not in spec:
        spec["postRenderers"] = []

    post_renderers = spec["postRenderers"]
    updated = False
    for i, pr in enumerate(post_renderers):
        if "kustomize" in pr:
            kustomize = pr["kustomize"]
            if "patches" in kustomize:
                for j, p in enumerate(kustomize["patches"]):
                    target = p.get("target", {})
                    if target.get("kind") == "ConfigMap" and target.get("name") == "homepage":
                        kustomize["patches"][j]["patch"] = patch_text
                        updated = True
                        break

    if not updated:
        spec["postRenderers"].append({
            "kustomize": {
                "patches": [{
                    "target": {
                        "version": "v1",
                        "kind": "ConfigMap",
                        "name": "homepage",
                    },
                    "patch": patch_text,
                }],
            },
        })

    with open(hr_path, "w") as f:
        yaml.dump(hr, f, default_flow_style=False, sort_keys=False)
        f.write("\n")

    print(f"  Updated HelmRelease: {hr_path}")

    # Update kustomization.yaml to include patches directory
    kustomize_path = root / "flux" / "infrastructure" / "webapps" / "homepage" / "kustomization.yaml"
    with open(kustomize_path, "r") as f:
        kustom = yaml.safe_load(f)

    resources = kustom.get("resources", [])
    patches_dir = "patches"
    if patches_dir not in resources:
        resources.append(patches_dir)
        kustom["resources"] = resources

    with open(kustomize_path, "w") as f:
        yaml.dump(kustom, f, default_flow_style=False, sort_keys=False)
        f.write("\n")

    print(f"  Updated Kustomization: {kustomize_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Sync Homepage services from Flux YAML")
    parser.add_argument("--dry-run", action="store_true", help="Show what would change without writing")
    parser.add_argument("--root", default=".", help="Root of the beck-cloud repo")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    print(f"Scanning Flux YAML under: {root}")

    # 1. Find all IngressRoute/Ingress resources
    resources = find_ingress_resources(root)
    print(f"   Found {len(resources)} IngressRoute/Ingress resources\n")

    # 2. Resolve hosts and metadata
    patches = []
    unmatched = []
    for res in resources:
        host = resolve_host(res)
        if not host:
            unmatched.append((res, None, "no host found"))
            continue
        meta = resolve_meta(res, host)
        if not meta:
            unmatched.append((res, host, "no metadata for host"))
            continue
        patch = generate_patch(res, meta, host)
        patches.append((res, patch, meta, host))
        print(f"   OK {res['namespace']}/{res['name']} -> {host} [{meta.group}]")

    if unmatched:
        print(f"\n   Warning: {len(unmatched)} resources had no matching metadata:")
        for res, host, reason in unmatched:
            print(f"      - {res['namespace']}/{res['name']} (host={host or 'unknown'}) [{reason}]")

    print(f"\n   Generated {len(patches)} patches")

    # 3. Write patches
    patches_dir = root / "flux" / "infrastructure" / "webapps" / "homepage" / "patches"
    if not args.dry_run:
        patches_dir.mkdir(parents=True, exist_ok=True)

        # Clean up old patches to avoid stale references
        import shutil
        for old_file in patches_dir.glob("*.yaml"):
            if old_file.name != "kustomization.yaml":
                old_file.unlink()

        patch_files = []
        seen = set()
        for res, patch, meta, host in patches:
            safe_name = re.sub(r"[^a-z0-9-]", "-", res["name"].lower())
            filename = f"{safe_name}.yaml"
            # Handle duplicates (same name in different files)
            if filename in seen:
                idx = len([x for x in seen if x.startswith(safe_name)]) + 1
                filename = f"{safe_name}-{idx}.yaml"
            seen.add(filename)
            patch_files.append(f"patches/{filename}")

            filepath = patches_dir / filename
            with open(filepath, "w") as f:
                f.write(yaml_dump(patch))
            print(f"   Written: {filepath}")

        # Create the patches kustomization.yaml
        patch_kustom = {
            "apiVersion": "kustomize.config.k8s.io/v1beta1",
            "kind": "Kustomization",
            "resources": patch_files,
        }
        with open(patches_dir / "kustomization.yaml", "w") as f:
            yaml.dump(patch_kustom, f, default_flow_style=False, sort_keys=False)
            f.write("\n")
        print(f"   Written: {patches_dir / 'kustomization.yaml'}")

        # 4. Update the Homepage HelmRelease
        update_helm_release(root)

        # 5. Write standalone config files for reference
        config_dir = root / "flux" / "infrastructure" / "webapps" / "homepage" / "config"
        config_dir.mkdir(parents=True, exist_ok=True)
        for filename, content in [
            ("kubernetes.yaml", generate_kubernetes_yaml()),
            ("settings.yaml", generate_settings_yaml()),
            ("widgets.yaml", generate_widgets_yaml()),
        ]:
            with open(config_dir / filename, "w") as f:
                f.write(content)
            print(f"   Written: {config_dir / filename}")

        # 6. Generate a summary report
        report = {
            "generated_at": "2026-07-20",
            "total_resources_scanned": len(resources),
            "total_patches": len(patches),
            "services_by_group": {},
            "services": [],
        }
        for res, patch, meta, host in patches:
            group = meta.group
            report["services_by_group"][group] = report["services_by_group"].get(group, 0) + 1
            report["services"].append({
                "name": meta.name,
                "group": meta.group,
                "host": host,
                "namespace": res["namespace"],
                "widget": meta.widget_type,
                "icon": meta.icon,
            })

        report_path = root / "flux" / "infrastructure" / "webapps" / "homepage" / "services-report.json"
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)
        print(f"\n   Report: {report_path}")

    else:
        print("\n   [DRY RUN] Would generate the following patches:")
        for res, patch, meta, host in patches:
            print(f"   - {res['namespace']}/{res['name']}: {meta.name} -> https://{host}")
            print(f"     Group: {meta.group}, Icon: {meta.icon}, Widget: {meta.widget_type or 'none'}")

    # Print summary
    print(f"\n{'=' * 60}")
    print(f"Summary:")
    print(f"  Total IngressRoute/Ingress resources: {len(resources)}")
    print(f"  Annotated with Homepage metadata: {len(patches)}")
    print(f"  Unmatched (no metadata): {len(unmatched)}")
    groups = {}
    for _, _, meta, _ in patches:
        groups[meta.group] = groups.get(meta.group, 0) + 1
    for group, count in sorted(groups.items()):
        print(f"    {group}: {count}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
