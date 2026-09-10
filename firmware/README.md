# Firmware Embodiments

`firmware/` separates hardware work by stage:

- **active projects** have a `platformio.ini`, source, a known target board, and an explicit bring-up path;
- **bench bring-up** projects can build and run visual tests, but do not yet implement the STS face/body contract;
- **documented candidates**, when present, preserve board facts before firmware is written.

A board does not enter `config/runtime.json` merely because it exists on the bench. It becomes an active embodiment only after its adapter can report live state and bounded action receipts.

| Folder | Stage | Intended role |
| --- | --- | --- |
| `esp32-s3-face` | active | One-piece portrait face with virtual eyes and mouth. |
| `esp32-s3-face-brain` | parked | External-eye experiment retained for hardware lineage. |
| `esp32-face` | legacy | Earlier external-display face lineage. |
| `esp32-chassis` | active experiment | Tracked chassis controller. |
| `esp32-cam` | active experiment | Camera controller. |
| `esp32-s3-dualeye-lcd-1.28` | bench bring-up | S3 dual-eye animation, blinking, and optional OTA. |
| `esp32-c3-dualeye-lcd-0.71` | bench bring-up | C3-hosted tiny eyes, buffered animation, blinking, and optional OTA. |

## Promotion Path

When a candidate becomes the thing on the bench, add a PlatformIO project and keep its board facts local to that folder. Promotion into the live runtime requires all of the following:

1. Confirm the exact PCB revision and vendor pin map on the physical unit.
2. Run a harmless display and serial bring-up over USB.
3. Implement the semantic face/body adapter with bounded, reportable actions.
4. Verify a live `/state` response and action receipts.
5. Add an active profile to `config/runtime.json` only after the adapter is actually reachable.

The semantic face contract in `config/face/robot-790-face.json` stays above these projects. Each embodiment maps the same intent onto its own display geometry, pins, and limitations.
