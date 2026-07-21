# SOPS Key Rotation

## Overview

This playbook rotates the age keypair used by SOPS to encrypt Kubernetes secrets. Run it on the hypervisor (frontend) **before** playbook `06-flux.yml` to ensure Flux has the matching private key for decryption.

## Prerequisites

1. **Old age private key** — needed to decrypt existing secrets before re-encrypting with the new key.
   Copy from your workstation:
   ```bash
   scp ~/.config/sops/age/homelab.agekey becklab:/root/beck-cloud/.sops-old.agekey
   ```

2. **Git user configured** — `git config user.name` / `user.email`

3. **Origin remote configured** with push access

## Usage

```bash
cd /root/beck-cloud/ansible

# Full rotation (generates new key, re-encrypts, commits, pushes)
ansible-playbook -i inventory/hosts.yml playbooks/10-sops-rotate.yml

# Preview without committing/pushing
ansible-playbook -i inventory/hosts.yml playbooks/10-sops-rotate.yml \
  --extra-var "rotate_dry_run=true"

# Keep old key after rotation (don't delete)
ansible-playbook -i inventory/hosts.yml playbooks/10-sops-rotate.yml \
  --extra-var "rotate_keep_old_key=true"

# Override repo root (if playbook cannot auto-detect)
ansible-playbook -i inventory/hosts.yml playbooks/10-sops-rotate.yml \
  --extra-var "repo_path=/home/stephen/beck-cloud"
```

## What It Does

1. Installs `age` and `sops` if missing
2. Generates new age keypair at `/root/beck-cloud/.sops.agekey`
3. Updates `.sops.yaml` with new public key
4. Re-encrypts all secrets using old key to decrypt + new key to encrypt
5. Commits and pushes to git
6. Copies new key to k3s-server at `/root/.config/sops/age/pre-rotated.agekey`

## After Rotation

Playbook `06-flux.yml` automatically detects and uses the pre-rotated key. No manual steps needed — just run `06-flux.yml` normally.

## Manual Recovery

If the old key is lost, you must decrypt and re-encrypt secrets manually:

```bash
# On the hypervisor, with sops installed and the new key:
export SOPS_AGE_KEY_FILE=/root/beck-cloud/.sops.agekey

# For each encrypted file:
sops -d flux/infrastructure/identity/secret-keycloak.yaml | \
  sops -e -i --age age15f2mn6pl769c22z8hw6mtrsna8l7fehml4j0m6jn573cs9vahcjsdrxh20 flux/infrastructure/identity/secret-keycloak.yaml
```

Replace the age recipient with your new public key from `.sops.yaml`.

## Troubleshooting

### ".sops.yaml not found"

The playbook auto-detects the repo root from `playbook_dir | realpath | dirname | dirname`.
If it resolves to the wrong path, override it explicitly:

```bash
ansible-playbook ... -e "repo_path=/absolute/path/to/beck-cloud"
```

Check with: `ls /absolute/path/to/beck-cloud/.sops.yaml`

### "k3s-server was unreachable"

Copy the new key manually:

```bash
scp /root/beck-cloud/.sops.agekey k3s-server:/root/.config/sops/age/pre-rotated.agekey
```
