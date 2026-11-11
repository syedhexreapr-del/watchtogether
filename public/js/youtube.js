// Supports YouTube embeds and direct, browser-playable video URLs.
// A third-party webpage URL cannot be treated as a video file; that site must allow embedding.
let player;
let playerReady = false;
let videoReady = false;
let activeSource = null;
let pendingPlayback = null;
let applyingRemoteState = false;
let previousPlayerTime = 0;
let loadingTimer;
let playerInitializing = false;
let preloadingVideoId = "";
let preloadedVideoId = "";

const mediaPlayer = document.getElementById("media-player");

function onYouTubeIframeAPIReady() {
  if (playerInitializing || player) return;
  playerInitializing = true;
  player = new YT.Player("player", {
    width: 640,
    height: 390,
    playerVars: { enablejsapi: 1, origin: window.location.origin, playsinline: 1, rel: 0 },
    events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange, onError: onPlayerError },
  });
}
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

function onPlayerReady(event) {
  playerReady = true;
  const iframe = event.target.getIframe();
  iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  iframe.setAttribute("title", "YouTube video player");
  iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
  iframe.setAttribute("allowfullscreen", "");
  console.log("YouTube player ready");
  if (activeSource?.type === "youtube") loadYouTubeSource(activeSource);
  else if (preloadingVideoId) player.cueVideoById({ videoId: preloadingVideoId, startSeconds: 0 });
  window.setInterval(() => {
    if (!videoReady || !window.isRoomHost || applyingRemoteState || activeSource?.type !== "youtube") return;
    const now = player.getCurrentTime();
    if (Math.abs(now - previousPlayerTime) > 1.5) emitSeek(now);
    previousPlayerTime = now;
  }, 500);
}

function getVideoSource(input, subtitleUrl = "", subtitleLanguage = "", subtitleCode = "") {
  if (typeof input !== "string") return null;
  let url;
  try { url = new URL(input.trim()); } catch (_) { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let videoId = "";
  if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] || "";
  else if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
    videoId = url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).slice(-1)[0] || "";
  }
  if (/^[\w-]{11}$/.test(videoId)) return { type: "youtube", videoId };

  if (!/\.(mp4|webm|ogv|ogg)(?:$|[?#])/i.test(url.href)) return null;
  let subtitles = null;
  if (subtitleUrl.trim()) {
    try {
      const trackUrl = new URL(subtitleUrl.trim());
      if (!["http:", "https:"].includes(trackUrl.protocol) || !/\.vtt(?:$|[?#])/i.test(trackUrl.href)) return null;
      subtitles = { url: trackUrl.href, language: subtitleLanguage.trim() || "English", code: subtitleCode.trim() || "en" };
    } catch (_) { return null; }
  }
  return { type: "direct", url: url.href, subtitles };
}
window.getVideoSource = getVideoSource;

function loadRoomVideo(source) {
  activeSource = source;
  videoReady = false;
  document.getElementById("video-thumbnail-preload").hidden = true;
  document.querySelector(".player-frame").classList.remove("has-thumbnail-preview");
  document.getElementById("player-placeholder").hidden = true;
  const panel = document.getElementById("player-loading");
  panel.classList.remove("has-error");
  document.getElementById("player-error-link").hidden = true;
  document.getElementById("player-loading-text").textContent = "Loading video…";
  setPlayerLoading(true);
  clearTimeout(loadingTimer);
  if (source.type === "youtube") {
    mediaPlayer.hidden = true;
    if (playerReady) loadYouTubeSource(source);
    else ensureYouTubeApi();
  } else {
    if (player) player.stopVideo();
    document.getElementById("player").hidden = true;
    mediaPlayer.hidden = false;
    mediaPlayer.pause();
    mediaPlayer.removeAttribute("src");
    mediaPlayer.querySelectorAll("track").forEach((track) => track.remove());
    if (source.subtitles) {
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.label = source.subtitles.language;
      track.srclang = source.subtitles.code || "en";
      track.src = source.subtitles.url;
      track.default = true;
      mediaPlayer.appendChild(track);
    }
    mediaPlayer.src = source.url;
    mediaPlayer.load();
  }
  loadingTimer = window.setTimeout(() => {
    if (!videoReady) showPlayerError("The video is taking too long. Check the link and whether the host allows playback.");
  }, 15000);
}
window.loadRoomVideo = loadRoomVideo;

function loadYouTubeSource(source) {
  if (!playerReady || !source?.videoId) return;
  document.getElementById("player").hidden = false;
  if (preloadedVideoId === source.videoId && player.getPlayerState() === YT.PlayerState.CUED) {
    preloadingVideoId = "";
    preloadedVideoId = "";
    videoReady = true;
    setPlayerLoading(false);
    if (pendingPlayback) applyPlayback(pendingPlayback);
    return;
  }
  // If this video is already being cued in the background, let that request finish.
  if (preloadingVideoId === source.videoId) return;
  preloadingVideoId = "";
  preloadedVideoId = "";
  player.cueVideoById({ videoId: source.videoId, startSeconds: pendingPlayback?.currentTime || 0 });
}

mediaPlayer.addEventListener("loadedmetadata", () => {
  videoReady = true;
  setPlayerLoading(false);
  if (pendingPlayback) applyPlayback(pendingPlayback);
});
mediaPlayer.addEventListener("error", () => {
  if (activeSource?.type === "direct") showPlayerError("This video link could not be played. Use a direct MP4/WebM link, or a site that allows embedding.");
});
mediaPlayer.addEventListener("play", () => { if (!applyingRemoteState && window.isRoomHost) emitPlayback("play", mediaPlayer.currentTime); });
mediaPlayer.addEventListener("pause", () => { if (!applyingRemoteState && window.isRoomHost && videoReady) emitPlayback("pause", mediaPlayer.currentTime); });
mediaPlayer.addEventListener("seeked", () => { if (!applyingRemoteState && window.isRoomHost && videoReady) emitSeek(mediaPlayer.currentTime); });

function socketEmit(event, payload) { if (window.socket && window.roomId) window.socket.emit(event, payload); }
function emitPlayback(event, currentTime) { socketEmit(event, { roomId: window.roomId, currentTime }); }
function emitSeek(currentTime) { socketEmit("seek", { roomId: window.roomId, currentTime }); }
function currentPlaybackTime() { return activeSource?.type === "youtube" && playerReady ? player.getCurrentTime() : mediaPlayer.currentTime || 0; }
function isVideoLoaded() { return videoReady; }
window.currentPlaybackTime = currentPlaybackTime;
window.isVideoLoaded = isVideoLoaded;

function applyPlayback(action) {
  pendingPlayback = { currentTime: Number.isFinite(action.currentTime) ? Math.max(0, action.currentTime) : 0, isPlaying: Boolean(action.isPlaying) };
  if (!videoReady) return;
  applyingRemoteState = true;
  const localTime = currentPlaybackTime();
  const shouldCorrectDrift = action.forceSeek || Math.abs(localTime - pendingPlayback.currentTime) > 2.5;
  if (activeSource?.type === "youtube") {
    // Avoid a seek on every play/pause packet; seek only for an explicit seek or visible drift.
    if (shouldCorrectDrift && player.getPlayerState() !== YT.PlayerState.CUED) player.seekTo(pendingPlayback.currentTime, true);
    previousPlayerTime = pendingPlayback.currentTime;
    if (pendingPlayback.isPlaying) player.playVideo();
    else if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
  } else {
    if (shouldCorrectDrift) mediaPlayer.currentTime = pendingPlayback.currentTime;
    if (pendingPlayback.isPlaying) mediaPlayer.play().catch(() => {});
    else mediaPlayer.pause();
  }
  window.setTimeout(() => { applyingRemoteState = false; }, 700);
}
window.applyPlayback = applyPlayback;

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.CUED) {
    const cuedVideoId = player.getVideoData()?.video_id;
    if (!activeSource && preloadingVideoId && cuedVideoId === preloadingVideoId) {
      preloadedVideoId = preloadingVideoId;
      return;
    }
    if (activeSource?.type === "youtube" && preloadingVideoId === activeSource.videoId) {
      preloadingVideoId = "";
      preloadedVideoId = "";
    }
    videoReady = true;
    setPlayerLoading(false);
    if (pendingPlayback) applyPlayback(pendingPlayback);
    return;
  }
  if (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.PAUSED) setPlayerLoading(false);
  else if (event.data === YT.PlayerState.BUFFERING) setPlayerLoading(true);
  if (applyingRemoteState || !window.isRoomHost) return;
  if (event.data === YT.PlayerState.PLAYING) emitPlayback("play", player.getCurrentTime());
  if (event.data === YT.PlayerState.PAUSED) emitPlayback("pause", player.getCurrentTime());
}

window.hasActiveRoomVideo = () => Boolean(activeSource);
window.preloadYouTubeVideo = (videoId) => {
  if (!/^[\w-]{11}$/.test(videoId) || activeSource || preloadingVideoId === videoId || preloadedVideoId === videoId) return;
  preloadingVideoId = videoId;
  preloadedVideoId = "";
  ensureYouTubeApi();
  if (playerReady) player.cueVideoById({ videoId, startSeconds: 0 });
};

function onPlayerError(event) {
  console.error("YouTube onError code:", event.data);
  const messages = { 2: "Invalid YouTube link.", 5: "YouTube player could not play this video.", 100: "This video is unavailable.", 101: "This video cannot be embedded.", 150: "This video cannot be embedded." };
  const text = event.data === 5 ? "This browser can't play YouTube videos here. Try a full browser with media codecs installed." : (messages[event.data] || "YouTube couldn't play this video.");
  showPlayerError(text);
  const link = document.getElementById("player-error-link");
  if (activeSource?.videoId) { link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(activeSource.videoId)}`; link.hidden = false; }
}

function showPlayerError(message) {
  clearTimeout(loadingTimer);
  videoReady = false;
  const panel = document.getElementById("player-loading");
  panel.classList.add("has-error");
  document.getElementById("player-loading-text").textContent = message;
  setPlayerLoading(true);
}
function setPlayerLoading(loading) {
  document.getElementById("player-loading").hidden = !loading;
  if (!loading) clearTimeout(loadingTimer);
}

// Dynamically insert YouTube's player only when an actual YouTube link is used.
function ensureYouTubeApi() {
  if (window.YT?.Player) { onYouTubeIframeAPIReady(); return; }
  if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
  const script = document.createElement("script");
  script.src = "https://www.youtube.com/iframe_api";
  script.async = true;
  script.referrerPolicy = "strict-origin-when-cross-origin";
  document.head.appendChild(script);
}
window.ensureYouTubeApi = ensureYouTubeApi;
