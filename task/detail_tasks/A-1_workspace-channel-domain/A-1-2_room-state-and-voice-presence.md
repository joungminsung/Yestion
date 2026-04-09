# A-1-2 room state and voice presence

## Goal

- [ ] Own the room-state primitives that let a channel behave like a live room before WebRTC media is attached.

## Implementation

- [x] Add join, leave, and heartbeat mutations for voice channels.
- [x] Add stale participant cleanup so abandoned tabs do not keep voice rooms permanently occupied.
- [x] Add SSE room updates so the voice-room surface can refresh participant state without polling the whole app.
- [x] Add first-pass room host and presenter roles derived from voice presence and screen-share state.
- [ ] Add explicit speaker and listener roles once moderation and device policies are broader.
- [ ] Decide how voice presence should bridge to recording, meeting notes, or page attachments.

## Edge Cases

- [x] Reject join and heartbeat calls on non-voice channels.
- [x] Treat missing voice presence on heartbeat as a no-op instead of corrupting room state.
- [x] Add first-pass reconnect grace periods and audio device-switch recovery before production voice rollout.

## Validation

- [x] `pnpm exec vitest run tests/server/routers/channel.test.ts`
- [ ] Manual test: open the same voice channel in two browsers and confirm join and leave state updates live.
