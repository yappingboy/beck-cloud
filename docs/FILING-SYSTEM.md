## 01 Initiation

New service workflow:
    1. Generate directory structure.
    2. Generate the documentation.
    3. Generate the yaml files from the documentation.
    4. Feedback loop with the user until the service is running to their satisfaction.

## 02 Planning
### Repository Structure
This is the basic directory structure of the project repository
```
beck-cloud/
├── ansible/                     # Bare-metal provisioning
│   ├── inventory/               # Host inventories
│   ├── playbooks/               # Numbered playbooks (00-prereqs → 99-uninstall)
│   │   └── templates/           # Jinja2 templates (sunbeam-manifest.)
│   └── templates/               # Root-level templates (sops.yaml.j2)
├── apps-source/                 # All custom application source code
│   ├── apps/                    # User-facing web apps (landing-page, gridspace, user-invite)
│   ├── keycloak-theme/          # Keycloak login/login theme
│   ├── role-enforcer/           # RBAC role enforcement microservice
│   ├── scripts/                 # Utility scripts (keycloak-role-provision, sync-homepage-services)
│   └── tools/                   # Microservices (Go/Python): auth-service, base64, beckflow, cron-jobs, dns-monitor, hash, image-editor, load-testing, qr-generator, url-shortener, webhook-relay, yaml-json-tool
├── docs/                        # All documentation
│   ├── ansible/                 # Ansible-specific docs
│   ├── flux/                    # Flux specific docs
│   ├── brand/                   # Brand identity and website source
│   ├── reference/               # Auto-generated cluster docs (by Nova)
│   ├── runbooks/                # Operational procedures
│   ├── maintenance/             # Maintenance SOPs
│   └── archive/                 # Completed plans, removed code, audit reports
└── flux/                        # Flux CD GitOps manifests
    ├── flux-system/             # Flux bootstrap
    ├── apps-source/             # Application source code
    ├── infrastructure/          # Infrastructure manifests (syncs every 1m)
    │   ├── flux-system/         # Flux Kustomization definitions
    │   ├── sources/             # HelmRepository definitions
    │   ├── {namespace}          # One directory in this level for each namespace in the flux deployment.
    │   │   └── {service}/       # One directory for each service, all the unique resource for each service is contained in its directory.
    └── apps/                    # User-facing apps (syncs every 5m)
```

### Flux

#### Namespace Directory
Each namespace gets its own directory. Each directory will contain the following files:
```
{namespace}/
├── {service}/                   # A directory for each of the services in the namespace
├── README.md                    # A description of the purpose of the namespace, the category of services it provides, specific resources it needs.
├── kustomization.yaml               # Boilerplate file that k3s uses to deploy the namespace. This customize will point to the namespace files, and each service directory, not individual files within the services.
├── namespace.yaml               # k3s's description of the namespace.
├── pvc.yaml                     # all pvcs for the entire namesapce compiled into a single file in the namespace.
└── middelware.yaml              # any middlewares needed within this namespace.
```
#### Service Directory
Each service is contained entirely in its own directory. Each directory will contain the following files:
```
{service}/
├── README.md                    # A description of the purpose of the service, what ports it needs, any specific environment variable that need to be set, and their purpose.
├── kustomization.yaml               # Boilerplate file that k3s uses to deploy the service
├── deployment.yaml              # k3s's deployment file, the values in this product should match the values defined in the README.
├── ingress.yaml                 # This is the networking ingress that interfaces with traefik.
├── secret.yaml                  # Contains any secrets the service may need, such as credentials, or other sensitve data. All secrets are encrypted.
└── service.yaml                 # Define all the ports that need to be forwarded to the ingress.
```
In the case there are multiple ingress/deployments in a single service, concat them into a single file, separated by ---.

## 03 Design

### Namespace File templates

#### README.md
```
# {namespace}

** Purpose: ** a short description of the purpose of this namespace

** What it does: ** an "elevator pitch" of what this service is for. A short description of the type of services it offers (such as media servers, or game servers).

** Special resource: ** any specific/special resources this namespace needs access to, such as a special hardware, storage, or other.

```
#### kustomization.yaml
```
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: {namespace}.yaml
resources:
  - namespace.yaml
  - pvcs.yaml
  - middleware.yaml
  - {service1}
  - {service2}
```

#### namespace.yaml
```
apiVersion: v1
kind: Namespace
metadata:
  name: media
  labels:
    name: media
```

#### pvc.yaml
```
---
# some basic information in a comment to explain what each PVC is for.

apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {PVC name}
  namespace: {namespace}
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: ""
  volumeName: {volume name}
  resources:
    requests:
      storage: {requested size}
---
```
#### middleware.yaml
```
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: {middleware-name}
  namespace: {required-namespace}
spec:
    {Add all the the middleware definitions/values here}
```

### Service File Templates

#### NOTE:
 There may be deviations from this standard. Some services may need different resources, or or to be formatted differently. If that is the case, make your best judgement call, and annotate it in the README.

#### README.md
```
# {service}

**Purpose:** A short tagline of what this service does

**What it does:** A longer "elevator pitch" for this service. Include a short description of how it does whatever it does.

**Resources:**
| Type | Details |
|------|---------|
| CPU | {Add the minimum and maximum CPU} |
| RAM | {Add the minimum and maximum RAM} |
| PVCs | {A list of all PVCs this service needs} |

**Images: ** A list of all container images used by this service

**Deployments: ** A list of any pods/deployments necessary to host this service.

**Ports:**
- {List all ports and what they are used for}

**Middleware / Ingress:**
- {List the middleware and ingress points needed, include the subdomain, and ports/protocols}

**Environment variables:**
- {List any/all environment variables that need to be set, and what the target value is}

**Notes:** {Any additional notes needed}
```

#### kustomization.yaml
```
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - ingress.yaml
  - secret.yaml # note, only include this if there are secretes necessary to the deployment of this service.
  - service.yaml
```
#### deployment.yaml
```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {pod-name}
  namespace: {namespace}
  labels:
    app: {service-name}
spec:
  replicas: {Number of replicas neeeded}
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: {service-name}
  template:
    metadata:
      labels:
        app: {service-name}
    spec:
      containers:
        - name: {service-name}
          image: {Container image name}
          imagePullPolicy: Always
          ports:
            - containerPort: {port number}
              name: {port name}
              protocol: {protocol}
          env:
            - name: {Environment variables}
              value: {Their values}
          resources:
            limits:
              cpu: {Limits as listed in the README}
              memory: {Limits as listed in the README}
            requests:
              cpu: {Minimum as listed in the README}
              memory: {Minimum as listed in the README}
          volumeMounts:
            - name: {volume names, as required}
              mountPath: {mount path}
          livenessProbe: # Subject to change to best reach the target service
            httpGet:
            path: /
            port: {service name}
            scheme: HTTPS
            initialDelaySeconds: 150
            periodSeconds: 30
            timeoutSeconds: 5
          readinessProbe: # Subject to change to best reach the target service
            httpGet:
              path: /
              port: {service name}
              scheme: HTTPS
            initialDelaySeconds: 30
            periodSeconds: 15
            timeoutSeconds: 5
      volumes:
        - name: {volume name}
          persistentVolumeClaim:
            claimName: {PVC name from namespace}
---
```
#### ingress.yaml
```
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {service name}
  namespace: {namespace}
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    cert-manager.io/cluster-issuer: letsencrypt-prod
    traefik.ingress.kubernetes.io/router.middlewares: {Any required auth middlewares}
spec:
  tls:
    - hosts:
      - {the FQDN as listed in the README}
      secretName: {TLS secret name}
  rules:
    - host: {the FQDN as listed in the README}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                 name: {Service name}
                 port:
                   number: {Port as listed in the README}
```
#### secret.yaml
```
apiVersion: v1
kind: Secret
metadata:
    name: {secret name}
    namespace: {namespace}
stringData:
    {variable name}: {encoded secret}
sops:
    {all the required information for a sops tag}
```
#### service.yaml 
```
---
apiVersion: v1
kind: Service
metadata:
  name: {service name}
  namespace: {namespace}
  labels:
    app: {service name}
spec:
  selector:
    app: {service name}
  ports:
    - name: {port name}
      port: {port number}
      targetPort: {port number}
  type: ClusterIP
```
