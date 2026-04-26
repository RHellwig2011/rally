# vcon — 360° Camera + Microphone Array with Conversation Analytics

A tabletop "box" device that captures every participant in a meeting room
(360° video + spatial audio) and produces structured analytics of the
conversation in near real time.

---

## 1. Goals

- One device, center of the table, captures the entire room.
- Identify **who** spoke, **when**, **what** they said, and **how** the
  conversation flowed.
- Produce per-meeting analytics (talk-time, turn-taking, sentiment, topics,
  action items) plus a searchable transcript.
- Stream a stitched 360° (or speaker-cropped) video feed to standard video
  conferencing clients (Zoom / Meet / Teams) over USB-UVC and WebRTC.

## 2. Non-goals (v1)

- Replacing a full-room AV install (ceiling mics, PTZ cameras).
- On-device LLM inference for long-context summarization (offload to cloud).
- Face recognition of unknown people. Speaker ID is **voice-based and
  opt-in** per participant.

---

## 3. Hardware

### 3.1 Optics
- 4× global-shutter color sensors (≥ 4K each), ~120° FOV fisheye lenses,
  arranged at 90° to give full 360° horizontal × ~90° vertical coverage.
- Hardware sync (genlock) so stitching seams don't tear on motion.
- Dedicated ISP (e.g. Sony / OmniVision + on-SoC ISP) for HDR + low-light.

### 3.2 Microphones
- 7-element circular MEMS array on the top plate (6 around + 1 center),
  ≥ 65 dB SNR, matched within ±1 dB.
- 48 kHz / 24-bit synchronous capture via TDM/I2S into the SoC.
- Optional 2-element vertical pair for elevation cues.

### 3.3 Compute
- SoC with NPU (e.g. NVIDIA Jetson Orin NX, Qualcomm QCS8550, or
  Rockchip RK3588 + Hailo-8) — ~20–100 TOPS.
- 8–16 GB LPDDR5, 128 GB NVMe (local rolling buffer).
- Gigabit Ethernet + Wi-Fi 6 + USB-C (UVC/UAC gadget mode for plug-and-play
  into laptops).

### 3.4 Enclosure & I/O
- Cylindrical, ~120 mm diameter, machined aluminum (heatsink doubles as
  shell), passive cooling.
- LED ring around the top to indicate: power, mute, recording, speaker
  direction.
- Single hardware **mute switch** (cuts mic power, not just software) and
  a **camera shutter** (mechanical or electrical kill).

---

## 4. Software stack

```
+-------------------------------------------------------------+
|  Cloud:  long-form summarization, search, dashboards, RBAC  |
+----------------------------↑--------------------------------+
                             |  signed event stream (gRPC/MQTT)
+----------------------------↓--------------------------------+
|  Device services (containers, systemd-managed):             |
|    media-pipeline  | analytics  | uplink  | device-admin    |
+----------------------------↑--------------------------------+
|  Media pipeline (GStreamer + custom plugins):               |
|    capture → sync → stitch → encode (H.265 + Opus)          |
|    capture → AEC/AGC → beamform → VAD → ASR → diarize       |
+----------------------------↑--------------------------------+
|  HAL: V4L2, ALSA/TDM, NPU runtime (TensorRT / ONNX RT)      |
+----------------------------↑--------------------------------+
|  Yocto Linux (RT-patched kernel), secure-boot, A/B OTA      |
+-------------------------------------------------------------+
```

### 4.1 Vision pipeline
1. **Capture & sync** — 4 sensors via MIPI CSI-2, hardware-timestamped.
2. **Stitch** — calibrated equirectangular projection, blended seams; runs
   on GPU/NPU at 30 fps @ 4K equirect.
3. **Person detection + tracking** — lightweight detector (YOLOv8-n or
   RT-DETR) on equirect frame, tracker keyed on appearance + position.
4. **Speaker framing** — when audio DOA points at a tracked person,
   crop/zoom a virtual PTZ window for the UVC output.
5. **Face landmarks (no recognition)** — used only to bias DOA when two
   talkers overlap.

### 4.2 Audio pipeline
1. **AEC** against the local loopback (the conferencing app's far-end audio).
2. **Beamforming** — MVDR or GSC steered to detected DOA, per-talker stream.
3. **VAD** — Silero / WebRTC VAD gates the ASR stage.
4. **ASR** — streaming Whisper-distil or Parakeet on NPU; partials < 300 ms.
5. **Diarization** — online clustering (e.g. pyannote-style ECAPA embeddings
   + agglomerative clustering); fused with DOA for robustness.
6. **Speaker enrollment (opt-in)** — 10 s sample creates a stable voice
   ID stored on device, never leaves without consent.

### 4.3 Conversation analytics
Per utterance the device emits a **vCon-compatible** event (IETF vcon draft):

```json
{
  "ts": "2026-04-26T14:02:11.412Z",
  "speaker": "spk_03",
  "doa_deg": 142,
  "text": "Let's push the launch to next Tuesday.",
  "confidence": 0.94,
  "sentiment": -0.1,
  "intent": "decision",
  "tags": ["schedule", "launch"]
}
```

Aggregated metrics computed continuously:
- Talk-time and turn count per speaker.
- Interruption / overlap rate.
- Question vs. statement ratio.
- Sentiment trend per speaker and per topic.
- Topic segmentation (BERTopic-style on rolling window).
- Action-item / decision / risk extraction (LLM, cloud-side).
- Engagement: gaze-direction proxy from cropped face boxes.

### 4.4 Cloud
- Ingest: signed gRPC stream of vCon events + optional encrypted media.
- Storage: object store for media (S3-compatible), Postgres for events,
  vector store for transcript search.
- Summarization & action items via Claude (Sonnet/Opus) with prompt
  caching on the meeting transcript.
- Web dashboard: per-meeting timeline, per-person scorecards, org-level
  trends, search.

---

## 5. Privacy, security, compliance

- **Consent**: device announces recording via LED ring + spoken chime;
  meetings start in "preview only" until a participant taps consent on
  the companion app or the device's capacitive top.
- **On-device by default**: raw audio/video never leave the device unless
  the org enables cloud media upload. Analytics events can flow without
  media.
- **At rest**: LUKS-encrypted NVMe, keys sealed to TPM.
- **In transit**: mTLS to cloud, per-device certs provisioned at
  manufacturing.
- **Secure boot + signed A/B OTA**, rollback protection.
- **Data residency**: tenant-pinned region; configurable retention
  (default 30 days media, 1 year events).
- **Regulatory**: GDPR DSAR endpoints, CCPA, SOC 2 Type II target,
  HIPAA-ready deployment profile (BAA, no cloud media).
- **Voice biometrics** are treated as biometric data (GDPR Art. 9):
  opt-in, revocable, stored hashed where feasible.

---

## 6. APIs & integrations

- **UVC / UAC** — appears as a webcam + mic to any OS, no driver.
- **WebRTC** — direct join to Zoom Rooms / Meet / Teams Rooms via SIP/H.323
  gateway (later release).
- **Webhooks** — meeting started/ended, action item detected, sentiment
  threshold crossed.
- **REST + gRPC** — query past meetings, transcripts, analytics.
- **vCon export** — full meeting as a single signed vCon JSON file.
- **Zapier / Slack / Salesforce / HubSpot** connectors for action items
  and CRM logging.

---

## 7. Milestones

| Phase | Duration | Outcome |
|-------|----------|---------|
| M0  Feasibility           | 4 wks  | SoC + sensor + mic-array bench rig; stitched 4K@30 + 7-ch audio captured. |
| M1  EVT hardware          | 8 wks  | First enclosed units, thermals validated, UVC output working. |
| M2  Audio analytics alpha | 6 wks  | Streaming ASR + DOA-fused diarization, WER ≤ 12% in 6-person room. |
| M3  Vision analytics alpha| 6 wks  | Stitching + person tracking + virtual PTZ at 30 fps. |
| M4  Cloud + dashboard MVP | 8 wks  | vCon ingest, transcript search, per-meeting summary, action items. |
| M5  DVT + pilot           | 8 wks  | 20 units in 3 design-partner orgs, telemetry + feedback loop. |
| M6  PVT + GA              | 10 wks | Manufacturing ramp, SOC 2 audit, GA launch. |

Total to GA: ~12 months.

---

## 8. Key risks & mitigations

| Risk | Mitigation |
|------|------------|
| Stitching seams visible on motion | Hardware genlock + learned blend net; fall back to 3-cam config if a sensor lags. |
| Diarization fails with overlapping talkers | Fuse DOA + voice embeddings; per-beam ASR so overlapping speech is separable. |
| Thermal throttling under sustained 4K + NPU load | CFD-validated heatsink shell; dynamic resolution drop before throttle. |
| Privacy backlash | Hardware mute + shutter, on-device default, transparent consent UX, third-party privacy audit before GA. |
| ASR quality in noisy rooms | AEC + beamform + room-adaptive noise suppression; user-tunable noise profiles. |
| Regulatory variance (biometrics laws e.g. BIPA) | Voice ID opt-in per user + jurisdiction config; ship with feature off in IL/TX/WA. |

---

## 9. Open questions

1. Single SKU or two (room size S/M/L)?
2. Subscription tier model: per-device, per-seat, or per-meeting-hour?
3. Do we ship a SIP/H.323 gateway in v1, or rely on UVC + companion app?
4. Local-only / "air-gapped" deployment mode for regulated customers?
5. Build vs. license the diarization + ASR stack (Whisper, NeMo,
   AssemblyAI, Deepgram)?
