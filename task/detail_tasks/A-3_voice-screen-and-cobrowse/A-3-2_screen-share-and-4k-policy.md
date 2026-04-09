# A-3-2 screen share and 4k policy

## Goal

- [ ] Define how screen sharing works in collaboration rooms, including quality policy for 4K-capable sessions.

## Implementation

- [x] Add share-start and share-stop flows on top of the existing voice room so a joined participant can publish a screen video track.
- [x] Reuse the same offer/answer signaling path for renegotiation when a screen track is added or removed.
- [x] Request 4K-preferred capture settings through `getDisplayMedia` and surface the actual captured resolution in the UI.
- [x] Add local preview and remote shared-screen preview panels inside the voice room surface.
- [x] Define first-pass presenter and viewer permission rules with host override behavior.
- [x] Persist active presenter and resolution metadata on the channel room state.

## Edge Cases

- [x] Handle browser support gaps and denied `getDisplayMedia` prompts with user-facing errors.
- [x] Stop the local share cleanly when the browser-level shared surface disappears.
- [ ] Handle rapid share-source switching and more graceful presenter handoff between multiple users.
- [x] Clear presenter state when the active presenter disconnects from the room.

## Validation

- [x] `pnpm exec tsc --noEmit`
- [x] `pnpm exec vitest run tests/server/routers/channel.test.ts`
- [ ] Manual matrix: test two browsers with screen share start, stop, and renegotiation.
- [ ] Verify permission boundaries for viewers versus presenters before shipping.
