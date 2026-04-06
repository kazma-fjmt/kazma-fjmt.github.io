const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const colorPicker = document.getElementById("colorPicker");
const sizePicker = document.getElementById("sizePicker");
const clearBtn = document.getElementById("clearBtn");

// キャンバスをウィンドウいっぱいに
function resizeCanvas() {
  canvas.width = window.innerWidth * 0.9;
  canvas.height = window.innerHeight * 0.7;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

let drawing = false;

function startDrawing(e) {
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(getX(e), getY(e));
}

function draw(e) {
  if (!drawing) return;
  ctx.lineTo(getX(e), getY(e));
  ctx.strokeStyle = colorPicker.value;
  ctx.lineWidth = sizePicker.value;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function stopDrawing() {
  drawing = false;
  ctx.closePath();
}

function getX(e) {
  return e.clientX || e.touches[0].clientX - canvas.offsetLeft;
}

function getY(e) {
  return e.clientY || e.touches[0].clientY - canvas.offsetTop;
}

// マウスイベント
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseout", stopDrawing);

// タッチイベント
canvas.addEventListener("touchstart", startDrawing);
canvas.addEventListener("touchmove", draw);
canvas.addEventListener("touchend", stopDrawing);

// クリアボタン
clearBtn.addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
