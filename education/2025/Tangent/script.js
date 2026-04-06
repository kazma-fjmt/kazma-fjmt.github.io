const canvas = document.getElementById("graphCanvas");
const ctx = canvas.getContext("2d");
const funcInput = document.getElementById("functionInput");
const xMinInput = document.getElementById("xMin");
const xMaxInput = document.getElementById("xMax");
const yMinInput = document.getElementById("yMin");
const yMaxInput = document.getElementById("yMax");
const aspectInput = document.getElementById("aspect");
const drawBtn = document.getElementById("drawBtn");
const pointInfo = document.getElementById("pointInfo");
const tangentInfo = document.getElementById("tangentInfo");

let f;
let xMin, xMax, yMin, yMax, aspect;

// ユーザ入力関数をパース
function parseFunction(expr) {
  // 累乗記号 ^ を ** に変換
  expr = expr.replace(/(\w|\))\^(\d+)/g, "$1**$2");
  // Math. を補完
  expr = expr.replace(/([a-zA-Z]+)\(/g, (match, fn) => {
    if (["sin","cos","tan","log","exp","sqrt","abs"].includes(fn)) {
      return "Math." + fn + "(";
    }
    return match;
  });
  return new Function("x", "return " + expr + ";");
}

// グラフ描画
function drawGraph() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  f = parseFunction(funcInput.value);
  xMin = parseFloat(xMinInput.value);
  xMax = parseFloat(xMaxInput.value);
  yMin = parseFloat(yMinInput.value);
  yMax = parseFloat(yMaxInput.value);
  aspect = parseFloat(aspectInput.value);

  // スケーリング
  const xScale = canvas.width / (xMax - xMin);
  const yScale = canvas.height / (yMax - yMin) * aspect;

  function toCanvasX(x) { return (x - xMin) * xScale; }
  function toCanvasY(y) { return canvas.height - (y - yMin) * yScale; }

  // 軸
  ctx.strokeStyle = "gray";
  ctx.beginPath();
  ctx.moveTo(toCanvasX(xMin), toCanvasY(0));
  ctx.lineTo(toCanvasX(xMax), toCanvasY(0));
  ctx.moveTo(toCanvasX(0), toCanvasY(yMin));
  ctx.lineTo(toCanvasX(0), toCanvasY(yMax));
  ctx.stroke();

  // 関数グラフ
  ctx.strokeStyle = "blue";
  ctx.beginPath();
  let first = true;
  for (let i = 0; i <= 1000; i++) {
    const x = xMin + (xMax - xMin) * i / 1000;
    let y;
    try {
      y = f(x);
    } catch {
      continue;
    }
    if (first) {
      ctx.moveTo(toCanvasX(x), toCanvasY(y));
      first = false;
    } else {
      ctx.lineTo(toCanvasX(x), toCanvasY(y));
    }
  }
  ctx.stroke();

  // クリックで接点指定
  canvas.onclick = function(event) {
    const rect = canvas.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const x = xMin + cx / xScale;
    const y = f(x);
    drawGraph(); // 再描画
    drawPointAndTangent(x, y, toCanvasX, toCanvasY, xScale, yScale);
  };
}

function derivative(x) {
  const h = 1e-5;
  return (f(x + h) - f(x - h)) / (2 * h);
}

function drawPointAndTangent(x0, y0, toCanvasX, toCanvasY, xScale, yScale) {
  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(toCanvasX(x0), toCanvasY(y0), 5, 0, 2 * Math.PI);
  ctx.fill();

  const slope = derivative(x0);
  const tangent = (x) => slope * (x - x0) + y0;

  ctx.strokeStyle = "green";
  ctx.beginPath();
  ctx.moveTo(toCanvasX(xMin), toCanvasY(tangent(xMin)));
  ctx.lineTo(toCanvasX(xMax), toCanvasY(tangent(xMax)));
  ctx.stroke();

  pointInfo.textContent = `接点: (${x0.toFixed(2)}, ${y0.toFixed(2)})`;
  tangentInfo.textContent = `接線: y = ${slope.toFixed(2)}(x - ${x0.toFixed(2)}) + ${y0.toFixed(2)}`;
}

drawBtn.onclick = drawGraph;
drawGraph();
