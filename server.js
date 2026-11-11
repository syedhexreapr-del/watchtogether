// Express serves the static frontend; Socket.IO keeps each watch room in sync.
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const rooms = new Map();

app.use(express.static(path.join(__dirname, "public")));

function playbackTime(room) {
  if (!room.isPlaying) return room.currentTime;
  return room.currentTime + (Date.now() - room.updatedAt) / 1000;
}

function participantList(room) {
  return Object.entries(room.users).map(([id, name]) => ({
    id,
    name,
    isHost: id === room.hostId,
  }));
}

function emitParticipants(roomId, room) {
  io.to(roomId).emit("participants", participantList(room));
}

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, userName } = {}) => {
    if (typeof roomId !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(roomId)) return;

    // Leave any previous room if this socket reconnects into a different one.
    for (const joinedRoomId of socket.rooms) {
      if (joinedRoomId !== socket.id) socket.leave(joinedRoomId);
    }

    let room = rooms.get(roomId);
    if (!room) {
      room = { hostId: socket.id, users: {}, source: null, isPlaying: false, currentTime: 0, updatedAt: Date.now() };
      rooms.set(roomId, room);
    }

    const safeName = typeof userName === "string" ? userName.trim().slice(0, 24) : "";
    room.users[socket.id] = safeName || "Guest";
    socket.join(roomId);

    // A joining guest gets a snapshot so the video and its current position restore immediately.
    socket.emit("room-state", {
      source: room.source,
      currentTime: playbackTime(room),
      isPlaying: room.isPlaying,
      hostId: room.hostId,
      isHost: room.hostId === socket.id,
    });
    emitParticipants(roomId, room);
  });

  socket.on("set-video", ({ roomId, source } = {}) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId || !source || typeof source !== "object") return;
    let safeSource;
    if (source.type === "youtube" && typeof source.videoId === "string" && /^[\w-]{11}$/.test(source.videoId)) {
      safeSource = { type: "youtube", videoId: source.videoId };
    } else if (source.type === "direct") {
      try {
        const url = new URL(source.url);
        if (!['http:', 'https:'].includes(url.protocol) || !/\.(mp4|webm|ogv|ogg)(?:$|[?#])/i.test(url.href)) return;
        safeSource = { type: "direct", url: url.href, subtitles: null };
        if (source.subtitles && typeof source.subtitles.url === "string") {
          const track = new URL(source.subtitles.url);
          if (!['http:', 'https:'].includes(track.protocol) || !/\.vtt(?:$|[?#])/i.test(track.href)) return;
          safeSource.subtitles = {
            url: track.href,
            language: typeof source.subtitles.language === "string" ? source.subtitles.language.slice(0, 35) : "English",
            code: typeof source.subtitles.code === "string" && /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(source.subtitles.code) ? source.subtitles.code.slice(0, 12) : "en",
          };
        }
      } catch (_) { return; }
    } else return;
    room.source = safeSource;
    room.currentTime = 0;
    room.isPlaying = false;
    room.updatedAt = Date.now();
    io.to(roomId).emit("video-changed", safeSource);
  });

  socket.on("play", ({ roomId, currentTime } = {}) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    room.currentTime = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : playbackTime(room);
    room.isPlaying = true;
    room.updatedAt = Date.now();
    socket.to(roomId).emit("play", room.currentTime);
  });

  socket.on("pause", ({ roomId, currentTime } = {}) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    room.currentTime = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : playbackTime(room);
    room.isPlaying = false;
    room.updatedAt = Date.now();
    socket.to(roomId).emit("pause", room.currentTime);
  });

  socket.on("seek", ({ roomId, currentTime } = {}) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId || !Number.isFinite(currentTime) || currentTime < 0) return;
    room.currentTime = currentTime;
    room.updatedAt = Date.now();
    io.to(roomId).emit("seek", currentTime);
  });

  socket.on("chat-message", ({ roomId, message } = {}) => {
    const room = rooms.get(roomId);
    const text = typeof message === "string" ? message.trim().slice(0, 500) : "";
    if (!room || !room.users[socket.id] || !text) return;
    io.to(roomId).emit("chat-message", {
      userName: room.users[socket.id],
      message: text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  });

  socket.on("disconnect", () => {
    for (const [roomId, room] of rooms) {
      if (!room.users[socket.id]) continue;
      delete room.users[socket.id];
      if (room.hostId === socket.id) {
        room.hostId = Object.keys(room.users)[0] || null;
        if (room.hostId) io.to(room.hostId).emit("host-changed");
      }
      if (Object.keys(room.users).length === 0) rooms.delete(roomId);
      else emitParticipants(roomId, room);
    }
  });
});

server.listen(PORT, () => console.log(`WatchTogether running at http://localhost:${PORT}`));
