# Post-Deploy Checklist

**Updated:** 2026-05-24
**Services covered:** Hubble UI, Trudesk, Silex, Pufferpanel, Mailu

---

## DNS Records (REQUIRED)

Create A records pointing to your cluster public IP:

```
mail.becklab.cloud     -> <YOUR_PUBLIC_IP>
hubble.becklab.cloud   -> <YOUR_PUBLIC_IP>
games.becklab.cloud    -> <YOUR_PUBLIC_IP>
support.becklab.cloud  -> <YOUR_PUBLIC_IP>
silex.becklab.cloud    -> <YOUR_PUBLIC_IP>
```

## Firewall Ports (Mailu ONLY)

Forward these TCP ports to your cluster node for email delivery:

```
25  -> NodePort 30025  (SMTP)
465 -> NodePort 30465  (SMTPS)
587 -> NodePort 30587  (submission)
143 -> NodePort 30143  (IMAP)
993 -> NodePort 30993  (IMAPS)
```

## Email Deliverability (Mailu)

Without these records, outgoing mail will land in spam:

1. **PTR record** — Set reverse DNS for your public IP to `mail.becklab.cloud`
   (Contact your hosting provider — this is not set in Cloudflare)

2. **SPF record** — Add TXT record for `becklab.cloud`:
   ```
   v=spf1 a mx ip4:<YOUR_PUBLIC_IP> ~all
   ```

3. **DKIM record** — Generate key in Mailu UI after first setup, then add:
   ```
   mail._domainkey.becklab.cloud -> <DKIM_PUBLIC_KEY>
   ```

4. **DMARC record** — Add TXT record for `_dmarc.becklab.cloud`:
   ```
   v=DMARC1; p=none; rua=admin@becklab.cloud
   ```

## Verify Deployment

```bash
ssh ubuntu@<k3s-server>

# Check all new pods
kubectl get pods -n support    # trudesk + trudesk-mongodb
kubectl get pods -n gaming     # pufferpanel + postgres
kubectl get pods -n email      # mailu
kubectl get pods -n cms        # directus + silex
kubectl get pods -n kube-system | grep hubble  # existing

# Check IngressRoutes
kubectl get ingressroute -A
```

## First-Time Setup

| Service | URL | Initial Action |
|---------|-----|----------------|
| Hubble UI | https://hubble.becklab.cloud | SSO login, view network map |
| Trudesk | https://support.becklab.cloud | Create admin account on first load |
| Pufferpanel | https://games.becklab.cloud | Create admin account on first load |
| Silex | https://silex.becklab.cloud | Run setup wizard |
| Mailu | https://mail.becklab.cloud | Create admin account, then configure DKIM |

## SOPS Key Management

The SOPS age private key lives at:
```
/root/beck-cloud/.sops.agekey
```

Copy to your workstation for future secret edits:
```bash
scp root@<onepoc>:/root/beck-cloud/.sops.agekey ~/.config/sops/age/becklab.agekey
```
