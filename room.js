const socket = io();

const roomId = new URLSearchParams(window.location.search).get("room");
const userName = prompt("Enter Your Name:");

socket.emit("join-room", { roomId, userName });

socket.on("play", (currentTime) => {
  player.seekTo(currentTime, true);
  player.playVideo();
});

socket.on("pause", (currentTime) => {
  player.pauseVideo();
});

socket.on("seek", (currentTime) => {
  player.seekTo(currentTime, true);
});

socket.on("chat-message", ({ userName, message, time }) => {
  addMessage(userName, message, time);
});
