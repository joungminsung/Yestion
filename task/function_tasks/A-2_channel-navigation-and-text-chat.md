# A-2 channel-navigation-and-text-chat

## Capability

- [ ] Own channel discovery, sidebar navigation, direct channel routes, and the first channel-native text chat experience.
- [ ] Consider this feature complete when users can create channels from the sidebar, navigate to them directly, and use a persisted real-time text chat surface without touching page chat.

## Breakdown

- [x] Add sidebar sections for workspace channels and teamspace channels.
- [x] Add direct `/${workspaceId}/channels/${channelId}` routes with a dedicated channel surface.
- [x] Add SSE-backed text message streaming and persisted channel history.
- [x] Add create-channel UI for both workspace and teamspace scopes.
- [ ] Add mentions, attachments, pinned items, and page references to channel chat.
- [x] Add unread counts, last-read markers, quick-switch support, and the first notification hooks for high-signal collaboration events.

## Detail Task Links

- [ ] [A-2-1 sidebar routes and channel discovery](../detail_tasks/A-2_channel-navigation-and-text-chat/A-2-1_sidebar-routes-and-channel-discovery.md)
- [ ] [A-2-2 text chat streaming experience](../detail_tasks/A-2_channel-navigation-and-text-chat/A-2-2_text-chat-streaming-experience.md)

## Validation

- [x] TypeScript passes after route, sidebar, and channel view additions.
- [x] Manual navigation path exists from the sidebar to newly created workspace and teamspace channels.
- [ ] Manual UX review is still required for unread state, mobile layout behavior, and deeper message affordances.
