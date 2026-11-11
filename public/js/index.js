// Create a private room and carry the host's name into the invite URL.
const nameInput = document.getElementById("user-name");
document.getElementById("create-room").addEventListener("click", createRoom);
nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") createRoom();
});

function createRoom() {
  const userName = nameInput.value.trim();
  if (!userName) {
    nameInput.focus();
    nameInput.setCustomValidity("Add your name to start a party.");
    nameInput.reportValidity();
    return;
  }
  nameInput.setCustomValidity("");
  const roomId = Math.random().toString(36).slice(2, 8);
  const query = new URLSearchParams({ room: roomId, name: userName });
  window.location.href = `/room.html?${query}`;
}

nameInput.addEventListener("input", () => nameInput.setCustomValidity(""));
