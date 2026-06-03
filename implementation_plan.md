# WebSocket-Powered Real-Time Collaborative Cursors Plan

This implementation plan details our architectural path to transition the **SocialPulse** application from mock multiplayer floaters to a **production-ready, real-time WebSocket-powered multiplayer cursor workspace** using `socket.io` and `socket.io-client`.

---

## 1. Goal Description
The objective is to allow real team members (and a live AI agent socket) logged into the same workspace to see each other's cursor positions in real-time. Nginx's proxy configuration on your Hostinger VPS (`2.24.98.197`) already supports connection upgrades (`Connection 'upgrade'`), making this upgrade fully compatible with your production SSL website immediately!

---

## 2. User Review Required

> [!IMPORTANT]
> - **Zero Breakage Fallback**: We will implement a smart fallback system: if the WebSocket connection fails to connect or is disabled, the layout will automatically fall back to the premium simulated multiplayer cursors, ensuring the website remains gorgeous and interactive.
> - **Dependency Additions**: This upgrade requires installing `socket.io` on the backend and `socket.io-client` on the frontend.

---

## 3. Proposed Changes

### Backend (API Server)

#### [MODIFY] [package.json](file:///C:/Users/Venon/OneDrive/SocialPulse/socialPulse-1/socialPulse-app/backend/package.json)
- Add `socket.io` dependency.
- Add `@types/socket.io` (devDependency) for TypeScript support.

#### [MODIFY] [server.ts](file:///C:/Users/Venon/OneDrive/SocialPulse/socialPulse-1/socialPulse-app/backend/src/server.ts)
- Refactor Express `app.listen` into a native HTTP server wrapping the Express app.
- Initialize `socket.io` server attached to the HTTP server with configured CORS origins.
- Set up connection listeners:
  - Join specific room based on active `workspace_id`.
  - Listen for `mouse-move` events (coordinates `x, y`, username, color, user profile).
  - Broadcast cursor positions (`cursor-update`) exclusively to other users in the same workspace room.
  - Handle client `disconnect` to clean up active cursor coordinates.

---

### Frontend (React SPA)

#### [MODIFY] [package.json](file:///C:/Users/Venon/OneDrive/SocialPulse/socialPulse-1/socialPulse-app/frontend/package.json)
- Add `socket.io-client` dependency.

#### [MODIFY] [AppLayout.tsx](file:///C:/Users/Venon/OneDrive/SocialPulse/socialPulse-1/socialPulse-app/frontend/src/components/layout/AppLayout.tsx)
- Import `io` from `socket.io-client`.
- Add active mouse-move event listener on the `window`:
  - Track user cursor position `x` and `y` as percentages relative to the screen.
  - Throttle coordinates transmission to the socket (every 50ms) to ensure smooth rendering and avoid overloading the network.
- Connect to the backend socket namespace when `multiplayerActive` is toggled on.
- Maintain a state dictionary of active remote cursors, dynamically updating positions when receiving the `cursor-update` event.
- Clear remote cursors when collaborators disconnect.
- Trigger simulated fallback floaters if the connection cannot be established.

---

## 4. Verification Plan

### Automated Tests
- Run `npm run build` inside `socialPulse-app/backend` to verify compilation health.
- Run `npm run build` inside `socialPulse-app/frontend` to verify compilation health.

### Manual Verification
1. Start local servers using `npm run dev` for both backend and frontend.
2. Open two separate browser tabs at `http://localhost:3000` (e.g. one in normal window, one in InPrivate).
3. Move your mouse in one window, and verify that the other window immediately shows your cursor moving in real-time with a matching colored badge!
