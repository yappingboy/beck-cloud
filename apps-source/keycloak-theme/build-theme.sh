#!/usr/bin/env bash
# build-theme.sh — render the Flux ConfigMap for the BeckCloud Keycloak theme.
# CSS-only theme (parent=keycloak.v2, no .ftl). Regenerate after editing files:
#   ./build-theme.sh && git add -A apps-source/keycloak-theme flux/infrastructure/identity/keycloak
# Adding .ftl files: read docs/research/theming-audit.md first (they shipped broken twice).
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../flux/infrastructure/identity/keycloak/theme-configmap.yaml
python3 - <<'PY'
import pathlib
root = pathlib.Path('beckcloud')
files = sorted(p for p in root.rglob('*') if p.is_file())
out = ['apiVersion: v1', 'kind: ConfigMap', 'metadata:',
       '  name: beckcloud-keycloak-theme', '  namespace: identity', '  labels:',
       '    app: keycloak', '    app.kubernetes.io/part-of: keycloak',
       '  annotations:',
       '    beckcloud.io/regenerate: ./apps-source/keycloak-theme/build-theme.sh',
       'data:']
for p in files:
    rel = p.relative_to(root).as_posix()
    key = rel.replace('/', '_')
    body = p.read_text().rstrip('\n').split('\n')
    out.append(f'  {key}: |-')
    out += [('    ' + l) if l.strip() else '' for l in body]
pathlib.Path(out_path := '../../flux/infrastructure/identity/keycloak/theme-configmap.yaml').write_text('\n'.join(out) + '\n')
print(f"wrote {out_path} ({len(files)} files)")
PY
