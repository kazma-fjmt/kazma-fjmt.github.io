const video = document.getElementById("webcam");
const predictionEl = document.getElementById("prediction");
const switchBtn = document.getElementById("switchBtn");
const zoomSlider = document.getElementById("zoomSlider");

let model;
let stream;
let videoTrack;
let usingFront = false;

// カメラ初期化・切替
async function setupCamera() {
  if (stream) stream.getTracks().forEach(track => track.stop());

  const constraints = { video: { facingMode: usingFront ? "user" : { exact: "environment" } }, audio: false };
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }

  video.srcObject = stream;
  await video.play();

  videoTrack = stream.getVideoTracks()[0];
  const capabilities = videoTrack.getCapabilities();
  if (capabilities.zoom) {
    zoomSlider.min = capabilities.zoom.min;
    zoomSlider.max = capabilities.zoom.max;
    zoomSlider.step = capabilities.zoom.step || 0.1;
    zoomSlider.value = capabilities.zoom.min;
    zoomSlider.disabled = false;
  } else zoomSlider.disabled = true;
}

zoomSlider.addEventListener("input", () => {
  if (videoTrack) videoTrack.applyConstraints({ advanced: [{ zoom: parseFloat(zoomSlider.value) }] });
});

switchBtn.addEventListener("click", async () => {
  usingFront = !usingFront;
  await setupCamera();
});

// 推論ループ
async function predictLoop() {
  if (model && video.readyState >= 2) {
    const predictions = await model.classify(video);
    if (predictions.length > 0) {
      const best = predictions[0];
      predictionEl.innerText = `予測: ${best.className} (${(best.probability*100).toFixed(1)}%)`;
    }
  }
  requestAnimationFrame(predictLoop);
}

// 初期化
async function run() {
  predictionEl.innerText = "モデル読み込み中...";
  model = await mobilenet.load();
  await setupCamera();
  predictionEl.innerText = "準備完了！";
  predictLoop();
}

run();
