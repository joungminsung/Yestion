# A-3-1 voice room media architecture

## Goal

- [ ] Define and implement the real WebRTC voice-room architecture that will replace the current presence-only room shell.

## Implementation

- [x] Choose channel SSE + signaling mutations as the first signaling path for room join, peer negotiation, and teardown.
- [x] Add client-side `RTCPeerConnection` lifecycle management for peer creation, offer/answer exchange, ICE candidate delivery, and remote stream playback.
- [x] Add microphone permission prompts, room join/leave flows, and local mute toggling for the first mesh voice-room MVP.
- [x] Add explicit deafen, audio input device selection, and device switching flows.
- [ ] Decide whether SFU, peer-to-peer, or hybrid topology best fits the product and infra budget.
- [x] Bridge room lifecycle to the existing presence model instead of replacing it outright.

## Edge Cases

- [x] Handle browser permission denial with user-facing errors instead of silently failing the room join.
- [x] Add first-pass device hot-swap and network-drop recovery behavior.
- [ ] Harden late peer join recovery more robustly for larger rooms.
- [ ] Define what happens when the room host leaves during an active screen share or shared browser session.

## Validation

- [x] `pnpm exec vitest run tests/server/routers/channel.test.ts`
- [x] `pnpm exec tsc --noEmit`
- [ ] Manual smoke check: two browser windows join the same voice room and confirm remote audio plays.
- [ ] Record browser compatibility expectations and minimum viable network scenarios.
