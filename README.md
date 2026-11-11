# WatchTogether

WatchTogether is a small, beginner-friendly watch party app built with plain HTML, CSS and JavaScript, Node.js, Express and Socket.IO. Friends can join a shared room, watch YouTube embeds or direct video files in sync, and chat in real time.

The app embeds YouTube videos through YouTube's IFrame Player API and can play direct MP4, WebM, Ogg, or OGV URLs in the browser. It does not upload, store, or host movies or video files.

### Video links and subtitles

- Paste a YouTube watch/short link or a direct video file URL ending in `.mp4`, `.webm`, `.ogv`, or `.ogg`.
- A link to a webpage is not necessarily a video stream. Other sites must allow embedding, and DRM-protected streams cannot be played by this app.
- For direct video files, optional subtitles can be added as a `.vtt` URL with a display name and language code. The video and subtitle servers must allow cross-origin browser access (CORS).
- YouTube captions remain in YouTube's own player controls. The app cannot list every caption language for arbitrary sites or override their player restrictions.

## Run it locally

1. Install Node.js 18 or newer.
2. In this project folder, install dependencies:

   ```bash
   npm install
   ```

3. Start the server:

   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000), enter your name, and create a party.
5. Use **Copy invite link** to share the room with friends. The first person in a room is its host.

For development, `npm run dev` starts the same server. Set the `PORT` environment variable to use a different port.

## How to use a room

- The host pastes a YouTube watch, short, embed, or live URL and selects **Load video**.
- The host's play, pause, and seek changes are sent to everyone in the room. A new guest receives the current video, playback position, and playing state on arrival.
- Chat and the participant list are room-specific. The host is marked with a badge.
- Only the host can control playback. If the host disconnects, the next participant becomes host.

## Project structure

```text
server.js               Express static server and Socket.IO room state
public/
  index.html            Create a watch party
  room.html             Player, controls, participants and chat
  css/style.css         Responsive dark UI
  js/index.js           Room creation
  js/room.js            Room events and participant UI
  js/youtube.js         YouTube IFrame Player API and URL parsing
  js/chat.js            Real-time chat UI (textContent for user content)
```

## Socket.IO events

The client/server use `join-room`, `set-video`, `play`, `pause`, `seek`, `chat-message`, `video-changed`, and `participants`. The server also sends `room-state` as the initial playback snapshot for a joining user.

## Notes

Room state is kept in server memory, so rooms reset when the server restarts. This starter is intended for local demos and portfolios; production hosting would need persistent room state and additional operational protections.
