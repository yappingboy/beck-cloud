# webapps/home-assistant

**Purpose:** Smart home automation

**What it does:** Home Assistant with Mosquitto MQTT broker (ConfigMap). Exposed with ingress.

**Services:**
- `home-assistant` — Home Assistant deployment with PVC
- `mosquitto` — Mosquitto MQTT ConfigMap
