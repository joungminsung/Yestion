# A-3 voice-screen-and-cobrowse

## Capability

- [ ] Own WebRTC voice rooms, screen sharing, and shared browser session behavior that sits on top of the channel model.
- [ ] Consider this feature complete when users can join a voice room, exchange media reliably, share screens with quality fallback, and collaborate inside a synchronized browser session with clear authority rules.

## Breakdown

- [x] Seed the first room-presence layer on top of workspace channels.
- [x] Add the first signaling, peer lifecycle, microphone permission, and remote-audio connection flow for voice rooms.
- [x] Add the first deafen, audio input switching, and reconnect recovery behavior for voice rooms.
- [ ] Harden larger-room behavior and longer-lived recovery paths for voice rooms.
- [x] Add the first screen share session orchestration on top of the existing voice-room signaling path.
- [x] Add first-pass presenter rules, host override behavior, and persisted presenter metadata for screen sharing.
- [ ] Harden multiple-viewer behavior, adaptive quality policy, and multi-presenter handoff for screen sharing.
- [x] Add the first shared browser session state, synchronized URL navigation, tab sync, controller handoff, and artifact capture flow.
- [ ] Add cursor intent, richer in-page collaboration, and remote-browser fallback for iframe-blocked sites.
- [ ] Decide how voice-room recording or transcription should bridge to the existing page meeting system.

## Detail Task Links

- [ ] [A-3-1 voice room media architecture](../detail_tasks/A-3_voice-screen-and-cobrowse/A-3-1_voice-room-media-architecture.md)
- [ ] [A-3-2 screen share and 4k policy](../detail_tasks/A-3_voice-screen-and-cobrowse/A-3-2_screen-share-and-4k-policy.md)
- [ ] [A-3-3 shared browser research sessions](../detail_tasks/A-3_voice-screen-and-cobrowse/A-3-3_shared-browser-research-sessions.md)

## Validation

- [ ] Complete cross-device media tests before enabling any WebRTC features broadly.
- [ ] Verify permissions, fallback behavior, and browser support for screen share and shared browsing.
