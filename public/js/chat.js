// Build chat messages with DOM text nodes so user content is never interpreted as HTML.
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const messagesDiv = document.getElementById("messages");

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;
  socket.emit("chat-message", { roomId, message });
  chatInput.value = "";
  chatInput.focus();
});

socket.on("chat-message", ({ userName: name, message, time }) => addMessage(name, message, time));

function addMessage(name, text, time) {
  const emptyNote = messagesDiv.querySelector(".chat-empty");
  if (emptyNote) emptyNote.remove();
  const row = document.createElement("div");
  row.className = "message";
  const avatar = document.createElement("span");
  avatar.className = "message-avatar";
  avatar.textContent = (name || "G").charAt(0).toUpperCase();
  const content = document.createElement("div");
  content.className = "message-content";
  const meta = document.createElement("div");
  meta.className = "message-meta";
  const author = document.createElement("strong");
  author.textContent = name;
  const timestamp = document.createElement("time");
  timestamp.textContent = time;
  meta.append(author, timestamp);
  const message = document.createElement("div");
  message.className = "message-text";
  message.textContent = text;
  content.append(meta, message);
  row.append(avatar, content);
  messagesDiv.appendChild(row);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
