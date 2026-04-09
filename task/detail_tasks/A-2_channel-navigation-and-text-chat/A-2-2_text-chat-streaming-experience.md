# A-2-2 text chat streaming experience

## Goal

- [ ] Own the first persisted, real-time text chat experience for channel-native collaboration.

## Implementation

- [x] Add channel message list and send mutations.
- [x] Add a channel SSE route and client-side stream handling for new messages.
- [x] Add a dedicated text-channel surface with persisted history and a composer.
- [ ] Add mentions, file attachments, page references, pinned messages, and moderation actions.
- [x] Add unread tracking and last-read markers once channel usage grows beyond a single open tab.
- [x] Add first notification hooks for high-signal collaboration events tied to channel sessions.

## Edge Cases

- [x] Prevent duplicate message insertion when streamed events arrive after the initial query.
- [x] Keep channel text chat separate from the existing page chat so old data and new data do not mix.
- [ ] Add retry and offline recovery rules for failed sends before broader rollout.

## Validation

- [x] `pnpm exec vitest run tests/server/routers/channel.test.ts`
- [x] `pnpm exec tsc --noEmit`
- [ ] Manual test: open the same text channel in two windows and verify messages appear live in both.
