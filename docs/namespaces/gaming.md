# gaming

**Purpose:** Game server orchestration.

**What it does:** Runs the Crafty Controller, a lightweight controller that manages Minecraft server instances. Exposes the game via NodePort `31337` (mapped internally to port `25565`). The namespace also contains the associated service endpoints for both the controller and the Minecraft traffic, providing a dedicated namespace for all gaming-related workloads.
