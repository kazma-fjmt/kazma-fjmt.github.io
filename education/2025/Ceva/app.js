/* Cheva (チェバ) インタラクティブアプリ */

// DOM
const $ = s => document.querySelector(s);
const stage = $('#stage');
const layerTriangle = $('#layer-triangle');
const layerCevians = $('#layer-cevians');
const layerSegments = $('#layer-segments');
const layerIntersections = $('#layer-intersections');
const layerPoints = $('#layer-points');
const layerLabels = $('#layer-labels');
const hintEl = $('#hint');
const productEl = $('#product');
const legendEl = $('#lengthLegend');
const resetBtn = $('#resetBtn');

const VB = 1000;
const COLORS = {
  BD: getComputedStyle(document.documentElement).getPropertyValue('--c1')?.trim() ?? '#ff6b6b',
  DC: getComputedStyle(document.documentElement).getPropertyValue('--c2')?.trim() ?? '#ffa94d',
  CE: getComputedStyle(document.documentElement).getPropertyValue('--c3')?.trim() ?? '#ffd43b',
  EA: getComputedStyle(document.documentElement).getPropertyValue('--c4')?.trim() ?? '#69db7c',
  AF: getComputedStyle(document.documentElement).getPropertyValue('--c5')?.trim() ?? '#4dabf7',
  FB: getComputedStyle(document.documentElement).getPropertyValue('--c6')?.trim() ?? '#b197fc',
};

let points = []; // {id:'A'|'B'|'C'|'O', x,y, g}
const order = ['A','B','C','O'];

function toLocal(ev){
  const r = stage.getBoundingClientRect();
  const px = (ev.clientX - r.left) / r.width;
  const py = (ev.clientY - r.top) / r.height;
  return { x: px*VB, y: py*VB };
}
function clamp(p){ return { x: Math.max(0, Math.min(VB, p.x)), y: Math.max(0, Math.min(VB, p.y)) }; }
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function midpoint(a,b){ return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }

// 直線交点（無限直線）
function lineIntersection(p1,p2,q1,q2){
  const A1 = p2.y - p1.y, B1 = p1.x - p2.x, C1 = A1*p1.x + B1*p1.y;
  const A2 = q2.y - q1.y, B2 = q1.x - q2.x, C2 = A2*q1.x + B2*q1.y;
  const det = A1*B2 - A2*B1;
  if (Math.abs(det) < 1e-9) return null;
  return { x: (B2*C1 - B1*C2)/det, y: (A1*C2 - A2*C1)/det };
}

function drawSeg(parent,a,b,color,width=6,dash=null){
  const L = document.createElementNS('http://www.w3.org/2000/svg','line');
  L.setAttribute('x1', a.x); L.setAttribute('y1', a.y);
  L.setAttribute('x2', b.x); L.setAttribute('y2', b.y);
  L.setAttribute('stroke', color); L.setAttribute('stroke-width', width); L.setAttribute('stroke-linecap','round');
  if (dash) L.setAttribute('stroke-dasharray', dash);
  parent.appendChild(L); return L;
}
function drawText(parent,p,text,color,cls='seg-label',dy=-8){
  const t = document.createElementNS('http://www.w3.org/2000/svg','text');
  t.setAttribute('x', p.x); t.setAttribute('y', p.y+dy);
  t.setAttribute('text-anchor','middle'); t.setAttribute('class', cls); t.setAttribute('fill', color);
  t.textContent = text; parent.appendChild(t); return t;
}
function formatLen(v){
  if (!isFinite(v)) return '—';
  if (v >= 100) return v.toFixed(1);
  if (v >= 10) return v.toFixed(2);
  return v.toFixed(3);
}

// 点作成（ドラッグ可）
function createPoint(id,x,y){
  const g = document.createElementNS('http://www.w3.org/2000/svg','g');
  g.classList.add('point'); g.dataset.id = id;
  const rOuter = 16, rInner = 6;
  const ring = document.createElementNS('http://www.w3.org/2000/svg','circle');
  ring.setAttribute('class','point-ring'); ring.setAttribute('r', rOuter);
  const core = document.createElementNS('http://www.w3.org/2000/svg','circle');
  core.setAttribute('class','point-core'); core.setAttribute('r', rInner);
  const label = document.createElementNS('http://www.w3.org/2000/svg','text');
  label.setAttribute('class','point-label'); label.setAttribute('text-anchor','middle'); label.setAttribute('y', -rOuter-6);
  label.textContent = id;
  const setPos = (x,y)=> g.setAttribute('transform', `translate(${x},${y})`);
  setPos(x,y);
  g.appendChild(ring); g.appendChild(core); g.appendChild(label);
  layerPoints.appendChild(g);

  let dragging = false;
  g.addEventListener('pointerdown', ev => { ev.preventDefault(); dragging = true; g.setPointerCapture(ev.pointerId); });
  g.addEventListener('pointermove', ev => {
    if (!dragging) return;
    const p = clamp(toLocal(ev));
    setPos(p.x,p.y);
    const rec = points.find(o => o.id === id);
    rec.x = p.x; rec.y = p.y;
    updateAll();
  });
  g.addEventListener('pointerup', ()=> dragging = false);
  g.addEventListener('pointercancel', ()=> dragging = false);

  points.push({id, x, y, g});
}

// クリックで点を追加
stage.addEventListener('pointerdown', ev => {
  if (ev.target.closest('.point')) return;
  if (points.length >= 4) return;
  const p = toLocal(ev);
  const id = order[points.length];
  createPoint(id, p.x, p.y);

  if (points.length < 3){
    hintEl.textContent = (points.length===1) ? 'B・C を続けてタップしてください' : 'C をタップしてください';
  } else if (points.length === 3){
    hintEl.textContent = '点 O をタップしてください（セイバンスの交点）';
  } else {
    hintEl.textContent = '5本目は不要です。点をドラッグして調整してください';
  }
  updateAll();
});

resetBtn.addEventListener('click', ()=>{
  points = [];
  layerTriangle.innerHTML = '';
  layerCevians.innerHTML = '';
  layerSegments.innerHTML = '';
  layerIntersections.innerHTML = '';
  layerPoints.innerHTML = '';
  layerLabels.innerHTML = '';
  productEl.textContent = '—';
  legendEl.innerHTML = '';
  hintEl.textContent = 'A・B・C の順に頂点をタップしてください';
});

// ヘルパ: get point
function getPoint(id){ return points.find(p => p.id === id); }

function updateAll(){
  layerTriangle.innerHTML = '';
  layerCevians.innerHTML = '';
  layerSegments.innerHTML = '';
  layerIntersections.innerHTML = '';
  layerLabels.innerHTML = '';

  if (points.length >= 3){
    const A = getPoint('A'), B = getPoint('B'), C = getPoint('C');
    drawSeg(layerTriangle, A, B, '#94a3b8', 3);
    drawSeg(layerTriangle, B, C, '#94a3b8', 3);
    drawSeg(layerTriangle, C, A, '#94a3b8', 3);
  }

  if (points.length < 4) { updateFooter(null); return; }

  const A = getPoint('A'), B = getPoint('B'), C = getPoint('C'), O = getPoint('O');
  if (!A || !B || !C || !O){ updateFooter(null); return; }

  // セイバンス（各頂点から O へ線を引く）
  drawSeg(layerCevians, A, O, '#7dd3fc', 2.5, '6 6');
  drawSeg(layerCevians, B, O, '#7dd3fc', 2.5, '6 6');
  drawSeg(layerCevians, C, O, '#7dd3fc', 2.5, '6 6');

  // 交点: AO ∩ BC = D, BO ∩ CA = E, CO ∩ AB = F
  const D = lineIntersection(A, O, B, C);
  const E = lineIntersection(B, O, C, A);
  const F = lineIntersection(C, O, A, B);

  if (!D || !E || !F){ updateFooter(null); return; }

  // 6線分の長さ（辺上の分割）
  const lenBD = dist(B, D), lenDC = dist(D, C);
  const lenCE = dist(C, E), lenEA = dist(E, A);
  const lenAF = dist(A, F), lenFB = dist(F, B);

  // 色分けして辺上の該当区間のみ描画
  drawSeg(layerSegments, B, D, COLORS.BD, 6); drawText(layerLabels, midpoint(B,D), formatLen(lenBD), COLORS.BD);
  drawSeg(layerSegments, D, C, COLORS.DC, 6); drawText(layerLabels, midpoint(D,C), formatLen(lenDC), COLORS.DC);

  drawSeg(layerSegments, C, E, COLORS.CE, 6); drawText(layerLabels, midpoint(C,E), formatLen(lenCE), COLORS.CE);
  drawSeg(layerSegments, E, A, COLORS.EA, 6); drawText(layerLabels, midpoint(E,A), formatLen(lenEA), COLORS.EA);

  drawSeg(layerSegments, A, F, COLORS.AF, 6); drawText(layerLabels, midpoint(A,F), formatLen(lenAF), COLORS.AF);
  drawSeg(layerSegments, F, B, COLORS.FB, 6); drawText(layerLabels, midpoint(F,B), formatLen(lenFB), COLORS.FB);

  // 交点マーカーとラベル
  [ {pt:D, id:'D'}, {pt:E, id:'E'}, {pt:F, id:'F'} ].forEach(({pt,id})=>{
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', 4.5);
    c.setAttribute('fill', '#f8fafc'); c.setAttribute('stroke', '#0b1020'); c.setAttribute('stroke-width', '2');
    layerIntersections.appendChild(c);
    const lab = document.createElementNS('http://www.w3.org/2000/svg','text');
    lab.setAttribute('x', pt.x + 12); lab.setAttribute('y', pt.y - 10);
    lab.setAttribute('class','point-label'); lab.textContent = id;
    layerIntersections.appendChild(lab);
  });

  const product = (lenBD/lenDC) * (lenCE/lenEA) * (lenAF/lenFB);
  updateFooter({BD:lenBD, DC:lenDC, CE:lenCE, EA:lenEA, AF:lenAF, FB:lenFB, product});
}

function updateFooter(data){
  if (!data){
    productEl.textContent = '—';
    legendEl.innerHTML = '';
    return;
  }
  const {BD,DC,CE,EA,AF,FB,product} = data;
  productEl.textContent = isFinite(product) ? product.toFixed(6) : '—';
  const rows = [
    {k:'BD', v:BD, c:COLORS.BD},
    {k:'DC', v:DC, c:COLORS.DC},
    {k:'CE', v:CE, c:COLORS.CE},
    {k:'EA', v:EA, c:COLORS.EA},
    {k:'AF', v:AF, c:COLORS.AF},
    {k:'FB', v:FB, c:COLORS.FB},
  ];
  legendEl.innerHTML = rows.map(r=>(
    `<div class="row">
       <span class="swatch" style="background:${r.c}"></span>
       <span class="label">${r.k}</span>
       <span class="mono">${formatLen(r.v)}</span>
     </div>`
  )).join('');
}

// 初期化
updateAll();
