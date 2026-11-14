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
  const query = new URLSearchParams({ room: roomId, name: userName, host: "1" });
  window.location.href = `/room.html?${query}`;
}

nameInput.addEventListener("input", () => nameInput.setCustomValidity(""));

// Keep the homepage's cursor response on the compositor and disable it for touch/reduced-motion devices.
const pointerGlow = document.getElementById("pointer-glow");
const canUsePointerGlow = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (pointerGlow && canUsePointerGlow && !prefersReducedMotion) {
  let pointerFrame = 0;
  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (pointerFrame) return;
    pointerFrame = window.requestAnimationFrame(() => {
      pointerGlow.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0) translate(-50%, -50%)`;
      pointerFrame = 0;
    });
  }, { passive: true });
}
