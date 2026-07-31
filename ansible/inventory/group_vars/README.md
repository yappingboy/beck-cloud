# Encrypted Secrets

## Overview

Ansible secrets are encrypted using [SOPS](https://github.com/getsops/sops) with age encryption.

## Files

- **`all_secrets.yml.enc`** — Encrypted secrets file (tracked in git)
- **`.sops.yaml`** — SOPS config with age recipient key

## Secrets

| Variable | Description | File |
|----------|-------------|------|
| `one_admin_password` | OpenNebula admin password | `all_secrets.yml.enc` |
| `k3s_token` | K3s cluster join token | `all_secrets.yml.enc` |
| `github_token` | GitHub token (from env) | Environment variable |

## Usage

### Decrypt the secrets file

```bash
# Set the age key
export SOPS_AGE_KEY_FILE=~/.config/sops/age/homelab.agekey

# Decrypt to stdout
sops --decrypt inventory/group_vars/all_secrets.yml.enc

# Decrypt and load as JSON for programmatic use
sops --decrypt --input-type yaml --output-type json inventory/group_vars/all_secrets.yml.enc
```

### Edit secrets

1. Decrypt: `sops --decrypt inventory/group_vars/all_secrets.yml.enc > /tmp/secrets.yml`
2. Edit: `nano /tmp/secrets.yml`
3. Re-encrypt: `sops --encrypt --input-type yaml --output-type yaml /tmp/secrets.yml > inventory/group_vars/all_secrets.yml.enc`

### In playbooks

The secrets are loaded automatically as Ansible variables from `group_vars/all.yml`. To explicitly load the encrypted file:

```yaml
- name: Load encrypted secrets
  ansible.builtin.include_vars:
    file: all_secrets.yml.enc
    name: secrets
```

## Rotation

Run `playbooks/10-sops-rotate.yml` to rotate the age keypair.
