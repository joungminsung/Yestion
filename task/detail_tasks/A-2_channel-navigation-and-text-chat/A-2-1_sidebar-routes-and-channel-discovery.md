# A-2-1 sidebar routes and channel discovery

## Goal

- [ ] Own how users discover, create, and navigate to workspace and teamspace channels from the main app shell.

## Implementation

- [x] Add a workspace channel section to the sidebar outside the page tree.
- [x] Add teamspace-scoped channel lists inside expanded teamspace sections.
- [x] Add a create-channel modal that supports both text channels and voice rooms.
- [x] Add direct channel routes under `/${workspaceId}/channels/${channelId}`.
- [x] Add unread indicators and quick-switch support for channels.
- [ ] Add mobile-optimized discovery patterns.

## Edge Cases

- [x] Keep the existing page tree intact so page navigation is not displaced by the new channel list.
- [x] Allow workspaces with zero channels to render a helpful empty state instead of breaking the sidebar.
- [ ] Audit narrow tablet and mobile layouts once unread badges and more channel metadata are added.

## Validation

- [x] `pnpm exec tsc --noEmit`
- [ ] Manual test: create one workspace channel and one teamspace channel from the sidebar and verify both routes open correctly.
