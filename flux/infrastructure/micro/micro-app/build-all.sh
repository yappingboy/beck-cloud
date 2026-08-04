#!/bin/bash
set -e

SERVICES="hash:hasher base64:converter url-shortener:url-shortener qr-generator:qr-generator yaml-json-tool:yaml-json-tool webhook-relay:webhook-relay cron-jobs:cron-jobs dns-monitor:dns-monitor"

for entry in $SERVICES; do
    SRC_DIR=$(echo $entry | cut -d: -f1)
    BINARY=$(echo $entry | cut -d: -f2)
    IMAGE_NAME="ghcr.io/yappingboy/$BINARY:latest"
    
    cat > /tmp/build-${BINARY}.yaml << EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: build-${BINARY}
  namespace: toolbox
spec:
  template:
    spec:
      serviceAccountName: kaniko-builder
      initContainers:
        - name: copy-source
          image: alpine/git:latest
          command: ["sh", "-c", "cd /workspace && git clone --branch main --depth 1 https://github.com/yappingboy/beck-cloud.git src && cd src && cp -r tools/${SRC_DIR}/* ."]
          volumeMounts:
            - name: workspace
              mountPath: /workspace
      containers:
        - name: kaniko
          image: gcr.io/kaniko-project/executor:v1.24.0
          args:
            - --dockerfile=/workspace/src/Dockerfile
            - --context=dir:///workspace
            - --destination=${IMAGE_NAME}
            - --cache=true
            - --cache-repo=ghcr.io/yappingboy/kaniko-cache
            - --skip-tls-verify
            - --push-retry=3
          resources:
            limits:
              cpu: "2"
              memory: 4Gi
            requests:
              cpu: "500m"
              memory: 2Gi
          volumeMounts:
            - name: workspace
              mountPath: /workspace
            - name: docker-config
              mountPath: /kaniko/.docker/
              readOnly: true
      restartPolicy: Never
      volumes:
        - name: workspace
          emptyDir: {}
        - name: docker-config
          secret:
            secretName: ghcr-config
EOF
done
echo "Done generating build jobs"
