let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let rotationDelta = { x: 0, y: 0 };

function initialize(canvas) {
  canvas.addEventListener("mousedown", (event) => {
    isDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  });

  canvas.addEventListener("mousemove", (event) => {
    if (isDragging) {
      const dx = event.clientX - lastMouseX;
      const dy = event.clientY - lastMouseY;
      rotationDelta.x += dy * 0.01; // Scale for sensitivity
      rotationDelta.y += dx * 0.01;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
    }
  });

  canvas.addEventListener("mouseup", () => {
    isDragging = false;
  });

  canvas.addEventListener("mouseleave", () => {
    isDragging = false;
  });
}

function getRotationDelta() {
  const delta = { ...rotationDelta };
  rotationDelta.x = 0; // Reset after retrieving
  rotationDelta.y = 0;
  return delta;
}

export default {
  initialize,
  getRotationDelta,
};
