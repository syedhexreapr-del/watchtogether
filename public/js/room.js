// Room identity and socket are shared with chat.js and youtube.js.
const socket = io();
const params = new URLSearchParams(window.location.search);
const roomId = params.get("room");
let userName = (params.get("name") || "Guest").trim().slice(0, 24) || "Guest";
window.socket = socket;
window.roomId = roomId;
window.isRoomHost = false;

const title = document.getElementById("room-title");
const hostTools = document.getElementById("host-tools");
const guestNote = document.getElementById("guest-note");
const toast = document.createElement("div");
toast.className = "toast";
toast.setAttribute("role", "status");
document.body.appendChild(toast);
let toastTimer;

if (!roomId) window.location.replace("/");
title.textContent = params.get("roomName") || "Your watch party";
setHostMode(false);

const joinGate = document.getElementById("join-gate");
const guestNameInput = document.getElementById("guest-name");
function joinRoomWithName(name) {
  userName = name.trim().slice(0, 24);
  if (!userName) return;
  joinGate.hidden = true;
  params.set("name", userName);
  history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  socket.emit("join-room", { roomId, userName, hostIntent: params.get("host") === "1" });
}

if (params.get("name") && params.get("name") !== "Guest") {
  joinGate.hidden = true;
  socket.emit("join-room", { roomId, userName, hostIntent: params.get("host") === "1" });
} else {
  joinGate.hidden = false;
  window.setTimeout(() => guestNameInput.focus(), 0);
  document.getElementById("join-form").addEventListener("submit", (event) => {
    event.preventDefault();
    joinRoomWithName(guestNameInput.value);
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2200);
}

function copyInviteLink() {
  const invite = new URL(window.location.href);
  invite.searchParams.delete("host");
  invite.searchParams.set("name", "Guest");
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(invite.toString()).then(() => showToast("Invite link copied")).catch(() => showToast(invite.toString()));
  } else {
    const temporary = document.createElement("textarea");
    temporary.value = invite.toString();
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.appendChild(temporary);
    temporary.select();
    const copied = document.execCommand("copy");
    temporary.remove();
    showToast(copied ? "Invite link copied" : invite.toString());
  }
}

document.getElementById("copy-link").addEventListener("click", copyInviteLink);
document.getElementById("invite-again").addEventListener("click", copyInviteLink);

const videoUrlInput = document.getElementById("video-url");
const videoThumbnail = document.getElementById("video-thumbnail-preload");
const playerFrame = document.querySelector(".player-frame");
let thumbnailVideoId = "";

function updateVideoPreview() {
  const pastedUrl = videoUrlInput.value.trim();
  const source = getVideoSource(pastedUrl);
  const videoId = source?.type === "youtube" ? source.videoId : "";
  if (!videoId) {
    thumbnailVideoId = "";
    videoThumbnail.hidden = true;
    playerFrame.classList.remove("has-thumbnail-preview");
    return;
  }
  if (thumbnailVideoId === videoId) return;

  thumbnailVideoId = videoId;
  videoThumbnail.dataset.videoId = videoId;
  videoThumbnail.dataset.fallback = "false";
  videoThumbnail.hidden = false;
  playerFrame.classList.add("has-thumbnail-preview");
  videoThumbnail.src = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  // Prepare the player API, while leaving playback behind the Load Video button.
  if (!window.hasActiveRoomVideo?.()) window.prepareYouTubePlayer?.(videoId);
}

videoUrlInput.addEventListener("input", updateVideoPreview);
videoThumbnail.addEventListener("error", () => {
  const failedVideoId = videoThumbnail.dataset.videoId;
  if (!failedVideoId || failedVideoId !== thumbnailVideoId) return;
  if (videoThumbnail.dataset.fallback !== "true") {
    videoThumbnail.dataset.fallback = "true";
    videoThumbnail.src = `https://i.ytimg.com/vi/${failedVideoId}/hqdefault.jpg`;
    return;
  }
  videoThumbnail.hidden = true;
  playerFrame.classList.remove("has-thumbnail-preview");
});

document.getElementById("load-video").addEventListener("click", () => {
  const source = getVideoSource(
    document.getElementById("video-url").value,
    document.getElementById("subtitle-url").value,
    document.getElementById("subtitle-language").value,
    document.getElementById("subtitle-language-code").value,
  );
  if (!source) {
    showToast("Use a YouTube link or direct MP4/WebM URL. Subtitles must be .vtt.");
    return;
  }
  if (source.type === "youtube") console.log("Extracted YouTube video ID:", source.videoId);
  socket.emit("set-video", { roomId, source });
  videoUrlInput.value = "";
  document.getElementById("subtitle-url").value = "";
  document.getElementById("subtitle-language").value = "";
  document.getElementById("subtitle-language-code").value = "";
});

document.getElementById("video-url").addEventListener("keydown", (event) => {
  if (event.key === "Enter") document.getElementById("load-video").click();
});

document.getElementById("play-btn").addEventListener("click", () => {
  if (window.isRoomHost && isVideoLoaded()) {
    const currentTime = currentPlaybackTime();
    applyPlayback({ currentTime, isPlaying: true });
    socket.emit("play", { roomId, currentTime });
  }
});
document.getElementById("pause-btn").addEventListener("click", () => {
  if (window.isRoomHost && isVideoLoaded()) {
    const currentTime = currentPlaybackTime();
    applyPlayback({ currentTime, isPlaying: false });
    socket.emit("pause", { roomId, currentTime });
  }
});

socket.on("room-state", (state) => {
  setHostMode(state.isHost);
  if (state.source) {
    pendingPlayback = { currentTime: state.currentTime, isPlaying: state.isPlaying };
    loadRoomVideo(state.source);
  }
});
socket.on("room-not-found", () => {
  showToast("This room is unavailable. Ask the host for a fresh invite link.");
  window.setTimeout(() => window.location.replace("/"), 2600);
});
socket.on("video-changed", (source) => {
  console.log("video-changed event:", source);
  pendingPlayback = { currentTime: 0, isPlaying: false };
  loadRoomVideo(source);
});
socket.on("play", (currentTime) => applyPlayback({ currentTime, isPlaying: true }));
socket.on("pause", (currentTime) => applyPlayback({ currentTime, isPlaying: false }));
socket.on("seek", (currentTime) => {
  applyPlayback({
    currentTime,
    isPlaying: pendingPlayback ? pendingPlayback.isPlaying : false,
    forceSeek: true,
  });
});
socket.on("sync-state", (state) => {
  if (!window.isRoomHost && state && Number.isFinite(state.currentTime)) {
    applyPlayback({ currentTime: state.currentTime, isPlaying: state.isPlaying });
  }
});
socket.on("host-changed", () => {
  setHostMode(true);
  showToast("You’re the new host");
});
socket.on("participants", renderParticipants);

function setHostMode(isHost) {
  window.isRoomHost = Boolean(isHost);
  hostTools.hidden = !window.isRoomHost;
  guestNote.hidden = window.isRoomHost;
  document.getElementById("play-btn").disabled = !window.isRoomHost;
  document.getElementById("pause-btn").disabled = !window.isRoomHost;
}

function renderParticipants(participants) {
  const list = document.getElementById("participants");
  list.replaceChildren();
  document.getElementById("participant-count").textContent = participants.length;
  participants.forEach((person) => {
    const item = document.createElement("li");
    item.className = "participant";
    const avatar = document.createElement("span");
    avatar.className = "participant-avatar";
    avatar.textContent = (person.name || "G").charAt(0).toUpperCase();
    const name = document.createElement("span");
    name.textContent = person.name;
    item.append(avatar, name);
    if (person.isHost) {
      const badge = document.createElement("span");
      badge.className = "host-badge";
      badge.textContent = "HOST";
      item.appendChild(badge);
    }
    list.appendChild(item);
  });
}
