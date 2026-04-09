# Discord-like Collaboration Hub Implementation Plan

## Goal

- [ ] Turn the current page-only product into a workspace collaboration system with channel-based text chat, voice rooms, screen sharing, and shared browser research sessions.
- [ ] Preserve the existing page editor, page chat, and page meeting flows while adding a separate room model that can survive outside individual pages.

## Scope

- [ ] Add workspace and teamspace channels that users can navigate to directly from the sidebar.
- [ ] Add text channels with persisted messages, real-time updates, and page-independent conversation history.
- [ ] Add voice room state and participant presence as the foundation for WebRTC voice and screen sharing.
- [ ] Add a delivery plan for 4K screen sharing, shared browser sessions, and rollout safeguards.
- [ ] Keep page-level meeting capture and collaboration as separate capabilities unless an explicit bridge is designed.
- [ ] Do not promise fully working WebRTC voice, 4K screen sharing, or cobrowsing before the media, signaling, and sandbox tasks in A-3 are completed.

## Function Task Map

- [ ] [A-1 workspace-channel-domain](./function_tasks/A-1_workspace-channel-domain.md)
- [ ] [A-2 channel-navigation-and-text-chat](./function_tasks/A-2_channel-navigation-and-text-chat.md)
- [ ] [A-3 voice-screen-and-cobrowse](./function_tasks/A-3_voice-screen-and-cobrowse.md)
- [ ] [A-4 operations-security-and-rollout](./function_tasks/A-4_operations-security-and-rollout.md)

## Milestones

- [x] Seed the three-level task system for the collaboration hub and define the capability slices.
- [x] Ship the first foundation slice with channel schema, tRPC router, SSE stream, sidebar navigation, direct channel routes, text messaging, and voice-room presence scaffolding.
- [ ] Expand the voice-room foundation beyond the current WebRTC mesh MVP into stronger reconnection, device controls, and room-level moderation.
- [x] Expand the voice-room foundation with first-pass deafen, audio input switching, and reconnection recovery.
- [x] Expand the current screen share MVP with presenter control rules, persisted presenter metadata, and host override behavior.
- [x] Ship the first shared browser session MVP with synchronized URL state, tab sync, controller handoff, iframe fallback messaging, and research artifacts.
- [ ] Harden permissions, observability, staged rollout, and cross-device QA before general enablement.

## Dependencies

- [ ] Complete A-1 before deep A-3 media work so voice, screen share, and cobrowsing all share the same channel identity and access model.
- [ ] Complete the A-2 route and navigation work before broader rollout so users can discover and return to channels consistently.
- [ ] Gate A-3 production launch on A-4 permission, abuse, and observability tasks.
