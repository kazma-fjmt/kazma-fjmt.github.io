/* メネラウス実験アプリ */

// ====== ユーティリティ ======
const $ = (sel) => document.querySelector(sel);
const stage = $("#stage");
const layerTriangle = $("#layer-triangle");
const layerTransversal = $("#layer-transversal");
const layerSegments = $("#layer-segments");
const layerIntersections = $("#layer-intersections");
const layerPoints = $("#layer-points");
const layerLabels = $("#layer-labels");
const hintEl = $("#hint");
const productEl = $("#product");
const legendEl = $("#lengthLegend");
const resetBtn = $("#resetBtn");

// 定数座標系: SVG viewBox を 0..1000 に固定
const VB = 1000;

// 色（6本の線分）
const COLORS = {
  AN: getComputedStyle(document.documentElement).getPropertyValue('--c1').trim(),
  NB: getComputedStyle(document.documentElement).getPropertyValue('--c2').trim(),
  BL: getComputedStyle(document.documentElement).getPropertyValue('--c3').trim(),
  LC: getComputedStyle(document.documentElement).getPropertyValue('--c4').trim(),
  CM: getComputedStyle(document.documentElement).getPropertyValue('--c5').trim(),
  MA: getComputedStyle(document.documentElement).getPropertyValue('--c6').trim(),
};

// 状態
let points = []; // {id:'A'|'B'|'C'|'P'|'Q', x, y, g:<svg g>}
const order = ['A','B','C','P','Q'];

function dist(a, b){
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function lineIntersection(p1, p2, q1, q2){
  // 2直線 p1p2 と q1q2 の交点（無限直線同士）
  const A1 = p2.y - p1.y;
  const B1 = p1.x - p2.x;
  const C1 = A1*p1.x + B1*p1.y;

  const A2 = q2.y - q1.y;
  const B2 = q1.x - q2.x;
  const C2 = A2*q1.x + B2*q1.y;

  const det = A1*B2 - A2*B1;
  if (Math.abs(det) < 1e-9) return null; // 平行
  const x = (B2*C1 - B1*C2) / det;
  const y = (A1*C2 - A2*C1) / det;
  return {x, y};
}

function clampToView(p){
  return { x: Math.max(0, Math.min(VB, p.x)), y: Math.max(0, Math.min(VB, p.y)) };
}

function midpoint(a, b){
  return { x: (a.x+b.x)/2, y: (a.y+b.y)/2 };
}

// 線分描画ヘルパ
function drawSeg(parent, a, b, color, width=5, dash=null, id=null){
  const el = document.createElementNS("http://www.w3.org/2000/svg","line");
  el.setAttribute('x1', a.x); el.setAttribute('y1', a.y);
  el.setAttribute('x2', b.x); el.setAttribute('y2', b.y);
  el.setAttribute('stroke', color);
  el.setAttribute('stroke-width', width);
  el.setAttribute('stroke-linecap','round');
  if (dash) el.setAttribute('stroke-dasharray', dash);
  if (id) el.dataset.key = id;
  parent.appendChild(el);
  return el;
}

function drawText(parent, p, text, color, cls='seg-label', dy=-8){
  const t = document.createElementNS("http://www.w3.org/2000/svg","text");
  t.setAttribute('x', p.x);
  t.setAttribute('y', p.y + dy);
  t.setAttribute('text-anchor','middle');
  t.setAttribute('class', cls);
  t.setAttribute('fill', color);
  t.textContent = text;
  parent.appendChild(t);
  return t;
}

function formatLen(v){
  if (!isFinite(v)) return '—';
  if (v >= 100) return v.toFixed(1);
  if (v >= 10) return v.toFixed(2);
  return v.toFixed(3);
}

// 点生成
function createPoint(id, x, y){
  const g = document.createElementNS("http://www.w3.org/2000/svg","g");
  g.classList.add('point');
  g.dataset.id = id;

  const rOuter = 16; const rInner = 6;

  const ring = document.createElementNS("http://www.w3.org/2000/svg","circle");
  ring.setAttribute('class','point-ring');
  ring.setAttribute('r', rOuter);

  const core = document.createElementNS("http://www.w3.org/2000/svg","circle");
  core.setAttribute('class','point-core');
  core.setAttribute('r', rInner);

  const label = document.createElementNS("http://www.w3.org/2000/svg","text");
  label.setAttribute('class','point-label');
  label.setAttribute('text-anchor','middle');
  label.setAttribute('y', -rOuter - 6);
  label.textContent = id;

  const setPos = (x,y)=>{
    g.setAttribute('transform', `translate(${x},${y})`);
    g._x = x; g._y = y;
  };

  setPos(x,y);

  g.appendChild(ring);
  g.appendChild(core);
  g.appendChild(label);
  layerPoints.appendChild(g);

  // ドラッグ（Pointer Events）
  let dragging = false;
  g.addEventListener('pointerdown', (ev)=>{
    ev.preventDefault();
    dragging = true;
    g.setPointerCapture(ev.pointerId);
  });
  g.addEventListener('pointermove', (ev)=>{
    if(!dragging) return;
    const pt = toLocal(ev);
    const p = clampToView(pt);
    setPos(p.x, p.y);
    const rec = points.find(o=>o.id===id);
    rec.x = p.x; rec.y = p.y;
    updateAll();
  });
  g.addEventListener('pointerup', ()=> dragging=false);
  g.addEventListener('pointercancel', ()=> dragging=false);

  points.push({id, x, y, g});
}

function toLocal(ev){
  // スクリーン座標を viewBox 座標へ
  const rect = stage.getBoundingClientRect();
  const px = (ev.clientX - rect.left) / rect.width;
  const py = (ev.clientY - rect.top) / rect.height;
  return { x: px*VB, y: py*VB };
}

// キャンバスをタップして点を追加
stage.addEventListener('pointerdown', (ev)=>{
  // 既存点の上を押したときは無視（ドラッグにまかせる）
  if (ev.target.closest('.point')) return;

  if (points.length >= 5) return; // 5点そろったら生成しない

  const p = toLocal(ev);
  const id = order[points.length];
  createPoint(id, p.x, p.y);

  if (points.length < 3){
    hintEl.textContent = `B・C の順に頂点をタップしてください`.slice((points.length-1)*1);
    if (points.length===1) hintEl.textContent = `B・C の順に頂点をタップしてください`;
    if (points.length===2) hintEl.textContent = `C の頂点をタップしてください`;
  } else if (points.length < 5){
    hintEl.textContent = (points.length===3) ? `直線上の点 P をタップしてください` : `直線上の点 Q をタップしてください`;
  } else {
    hintEl.textContent = `5点をドラッグして動かせます`;
  }
  updateAll();
});

// リセット
resetBtn.addEventListener('click', ()=>{
  points = [];
  layerTriangle.innerHTML = '';
  layerTransversal.innerHTML = '';
  layerSegments.innerHTML = '';
  layerIntersections.innerHTML = '';
  layerPoints.innerHTML = '';
  layerLabels.innerHTML = '';
  productEl.textContent = '—';
  legendEl.innerHTML = '';
  hintEl.textContent = 'A・B・C の順に頂点をタップしてください';
});

// ====== 描画ロジック ======
function getPoint(id){ return points.find(p=>p.id===id); }

function updateAll(){
  layerTriangle.innerHTML = '';
  layerTransversal.innerHTML = '';
  layerSegments.innerHTML = '';
  layerIntersections.innerHTML = '';
  layerLabels.innerHTML = '';

  if (points.length >= 2){
    // 仮の補助: 2点目まで出たら、何も描かない（ガイドのみ）
  }

  if (points.length >= 3){
    // 三角形 ABC
    const A = getPoint('A'), B = getPoint('B'), C = getPoint('C');
    drawSeg(layerTriangle, A, B, '#94a3b8', 2.5);
    drawSeg(layerTriangle, B, C, '#94a3b8', 2.5);
    drawSeg(layerTriangle, C, A, '#94a3b8', 2.5);
  }

  if (points.length >= 4){
    // 直線の最初の点を置いた段階では、仮の長い線を出しておく
    const P = getPoint('P');
    const dir = getPoint('Q') ? {x:getPoint('Q').x - P.x, y:getPoint('Q').y - P.y} : {x:1, y:0};
    const a = {x: P.x - dir.x*2000, y: P.y - dir.y*2000};
    const b = {x: P.x + dir.x*2000, y: P.y + dir.y*2000};
    drawSeg(layerTransversal, a, b, '#7dd3fc', 2.5, '6 8'); // 水色の破線
  }

  if (points.length < 5) { updateFooter(null); return; }

  const A = getPoint('A'), B = getPoint('B'), C = getPoint('C');
  const P = getPoint('P'), Q = getPoint('Q');
  if (!A || !B || !C || !P || !Q) { updateFooter(null); return; }

  // 直線 l（P-Q）を長く描画
  {
    const dir = {x: Q.x - P.x, y: Q.y - P.y};
    const a = {x: P.x - dir.x*2000, y: P.y - dir.y*2000};
    const b = {x: P.x + dir.x*2000, y: P.y + dir.y*2000};
    drawSeg(layerTransversal, a, b, '#7dd3fc', 3, '8 10');
  }

  // 各辺との交点（無限直線として）
  const N = lineIntersection(A, B, P, Q); // AB ∩ l
  const L = lineIntersection(B, C, P, Q); // BC ∩ l
  const M = lineIntersection(C, A, P, Q); // CA ∩ l

  // 交点が取れない（平行など）の場合は表示スキップ
  if (!N || !L || !M){ updateFooter(null); return; }

  // 6本の色分け線分（絶対距離）
  const lenAN = dist(A, N), lenNB = dist(N, B);
  const lenBL = dist(B, L), lenLC = dist(L, C);
  const lenCM = dist(C, M), lenMA = dist(M, A);

  // 線分を塗る
  drawSeg(layerSegments, A, N, COLORS.AN, 6);  drawText(layerLabels, midpoint(A,N), formatLen(lenAN), COLORS.AN);
  drawSeg(layerSegments, N, B, COLORS.NB, 6);  drawText(layerLabels, midpoint(N,B), formatLen(lenNB), COLORS.NB);

  drawSeg(layerSegments, B, L, COLORS.BL, 6);  drawText(layerLabels, midpoint(B,L), formatLen(lenBL), COLORS.BL);
  drawSeg(layerSegments, L, C, COLORS.LC, 6);  drawText(layerLabels, midpoint(L,C), formatLen(lenLC), COLORS.LC);

  drawSeg(layerSegments, C, M, COLORS.CM, 6);  drawText(layerLabels, midpoint(C,M), formatLen(lenCM), COLORS.CM);
  drawSeg(layerSegments, M, A, COLORS.MA, 6);  drawText(layerLabels, midpoint(M,A), formatLen(lenMA), COLORS.MA);

  // 交点マーカー
  [ {pt:N, id:'N'}, {pt:L, id:'L'}, {pt:M, id:'M'} ].forEach(({pt,id})=>{
    const mark = document.createElementNS("http://www.w3.org/2000/svg","circle");
    mark.setAttribute('cx', pt.x); mark.setAttribute('cy', pt.y);
    mark.setAttribute('r', 4.5);
    mark.setAttribute('fill', '#f8fafc');
    mark.setAttribute('stroke', '#0b1020');
    mark.setAttribute('stroke-width', '2');
    layerIntersections.appendChild(mark);

    const lab = document.createElementNS("http://www.w3.org/2000/svg","text");
    lab.setAttribute('x', pt.x+12);
    lab.setAttribute('y', pt.y-10);
    lab.setAttribute('class','point-label');
    lab.textContent = id;
    layerIntersections.appendChild(lab);
  });

  // 右下パネル
  const product = (lenAN/lenNB) * (lenBL/lenLC) * (lenCM/lenMA);
  updateFooter({
    AN: lenAN, NB: lenNB, BL: lenBL, LC: lenLC, CM: lenCM, MA: lenMA,
    product
  });
}

function updateFooter(data){
  if (!data){
    productEl.textContent = '—';
    legendEl.innerHTML = '';
    return;
  }
  const {AN,NB,BL,LC,CM,MA,product} = data;
  productEl.textContent = isFinite(product) ? product.toFixed(6) : '—';

  // 凡例（色と長さ）
  const rows = [
    {k:'AN', v:AN, c:COLORS.AN},
    {k:'NB', v:NB, c:COLORS.NB},
    {k:'BL', v:BL, c:COLORS.BL},
    {k:'LC', v:LC, c:COLORS.LC},
    {k:'CM', v:CM, c:COLORS.CM},
    {k:'MA', v:MA, c:COLORS.MA},
  ];
  legendEl.innerHTML = rows.map(r=>(
    `<div class="row">
       <span class="swatch" style="background:${r.c}"></span>
       <span class="label">${r.k}</span>
       <span class="mono">${formatLen(r.v)}</span>
     </div>`
  )).join('');
}

// 初期化（とりあえず何もしない。ユーザ操作待ち）
updateAll();
