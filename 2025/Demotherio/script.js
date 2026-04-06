// script.js — 改良版：即時ワープ、breakフラグで横断接続を防ぐ、栄養とNew Game UIを復活

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const newGameBtn = document.getElementById('newGameBtn');
const scoreEl = document.getElementById('score');

function resize() {
  // canvas internal pixels = CSS pixels (no DPR scaling here for simplicity)
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ---- 設定 ----
const ENEMY_COUNT = 4;
const START_FOOD = 40;
const WORM_SPEED = 0.9;
const TURN_RATE = 0.12;      // max angle change per update (radians)
const SEGMENT_WIDTH = 8;
const FOOD_RADIUS = 5;
const EAT_RADIUS = 10;
const INITIAL_LENGTH = 40;

// ---- ユーティリティ ----
const rand = (a,b) => Math.random()*(b-a)+a;
const clampAngleDiff = (d)=> Math.atan2(Math.sin(d), Math.cos(d));

// ---- ゲーム状態 ----
let worms = [];      // all worms (player + enemies)
let foods = [];      // nutrients
let running = false;
let score = 0;

// ---- Nutrient class ----
class Nutrient {
  constructor(x,y){
    this.x = x;
    this.y = y;
  }
  draw(){
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(this.x, this.y, FOOD_RADIUS, 0, Math.PI*2);
    ctx.fill();
  }
}

// ---- Worm class ----
// segments: head first, each segment: {x,y,break}
// break=true => do not connect previous segment to this one (used when wrap occurs)
class Worm {
  constructor(x,y,color,isPlayer=false,intel=0.5){
    this.color = color;
    this.isPlayer = !!isPlayer;
    this.intel = intel;
    this.angle = rand(0, Math.PI*2);
    this.length = INITIAL_LENGTH;
    this.segments = [{x,y,break:false}];
    this.target = null;           // {x,y} or null
    this.nutrientsEaten = 0;
    this.alive = true;
  }

  head(){ return this.segments[0]; }

  setTarget(x,y){
    this.target = {x,y};
  }

  // update movement: if target exists, smoothly rotate toward it; if no target, keep current angle (straight)
  update(){
    if(!this.alive) return;

    // target behavior
    if(this.target){
      const dx = this.target.x - this.segments[0].x;
      const dy = this.target.y - this.segments[0].y;
      const dist2 = dx*dx + dy*dy;
      if(dist2 < (WORM_SPEED*WORM_SPEED)){
        // reached target: clear target but keep current angle (=> continue straight)
        this.target = null;
      } else {
        const desired = Math.atan2(dy, dx);
        let diff = clampAngleDiff(desired - this.angle);
        const step = Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE);
        this.angle += step;
      }
    } else {
      // no target => maintain angle (straight)
    }

    // compute next head position
    let nx = this.segments[0].x + Math.cos(this.angle) * WORM_SPEED;
    let ny = this.segments[0].y + Math.sin(this.angle) * WORM_SPEED;

    // detect wrap BEFORE normalization
    let wrapped = false;
    if(nx < 0 || nx >= canvas.width || ny < 0 || ny >= canvas.height) wrapped = true;

    // normalize coordinates (instant wrap)
    if(nx < 0) nx += canvas.width;
    if(nx >= canvas.width) nx -= canvas.width;
    if(ny < 0) ny += canvas.height;
    if(ny >= canvas.height) ny -= canvas.height;

    // decide break flag: if wrapped OR large jump between prev head and new head, set break=true
    let prev = this.segments[0];
    let broke = false;
    if(wrapped) broke = true;
    if(prev){
      // if difference across half-size, treat as wrap -> break
      if(Math.abs(prev.x - nx) > canvas.width * 0.5 || Math.abs(prev.y - ny) > canvas.height * 0.5){
        broke = true;
      }
    }

    // push new head
    this.segments.unshift({x: nx, y: ny, break: broke});

    // limit segments length
    while(this.segments.length > this.length){
      this.segments.pop();
    }
  }

  // eat nutrients that are close to head
  eatFoods(){
    if(!this.alive) return;
    for(let i = foods.length - 1; i >= 0; i--){
      const f = foods[i];
      const dx = this.segments[0].x - f.x;
      const dy = this.segments[0].y - f.y;
      if(dx*dx + dy*dy < EAT_RADIUS*EAT_RADIUS){
        foods.splice(i,1);
        this.nutrientsEaten++;
        this.length += 6;     // growth amount
        if(this.isPlayer){
          score++;
          scoreElUpdate();
        }
      }
    }
  }

  // check collisions: head against segments of others (if collides -> this dies)
  checkCollisions(others){
    if(!this.alive) return;
    for(const other of others){
      if(other === this || !other.alive) continue;
      for(const seg of other.segments){
        const dx = this.segments[0].x - seg.x;
        const dy = this.segments[0].y - seg.y;
        if(dx*dx + dy*dy < (SEGMENT_WIDTH*0.6)*(SEGMENT_WIDTH*0.6)){
          // collision -> this dies
          this.die();
          return;
        }
      }
    }
  }

  // die: drop nutrients equal to nutrientsEaten on trail positions (exactly that many)
  die(){
    if(!this.alive) return;
    this.alive = false;

    const n = Math.max(0, Math.floor(this.nutrientsEaten));
    if(n > 0 && this.segments.length > 0){
      // sample from latter half of segments (trail area)
      const segCount = this.segments.length;
      for(let i = 0; i < n; i++){
        const t = (i + 0.5) / n; // 0..1
        const idx = Math.floor(segCount/2 + t * (segCount/2));
        const s = this.segments[Math.max(0, Math.min(segCount-1, idx))];
        const jitter = 8;
        const fx = (s.x + rand(-jitter, jitter) + canvas.width) % canvas.width;
        const fy = (s.y + rand(-jitter, jitter) + canvas.height) % canvas.height;
        foods.push(new Nutrient(fx, fy));
      }
    }

    // if not player, we will remove and respawn in main loop
    if(this.isPlayer){
      // stop game and show overlay (New Game)
      running = false;
      overlay.classList.add('show');
      newGameBtn.style.display = 'inline-block';
    }
  }

  draw(){
    if(!this.alive) return;

    // draw stroke while breaking paths where segments[i].break == true or large jumps
    ctx.lineWidth = SEGMENT_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.color;
    if(this.segments.length === 0) return;

    ctx.beginPath();
    let started = false;
    for(let i = 0; i < this.segments.length; i++){
      const s = this.segments[i];
      if(i === 0 || s.break){
        if(started) ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        started = true;
      } else {
        const prev = this.segments[i-1];
        // safety: if there's a huge gap treat as break
        if(Math.abs(prev.x - s.x) > canvas.width * 0.5 || Math.abs(prev.y - s.y) > canvas.height * 0.5){
          if(started) ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
        } else {
          ctx.lineTo(s.x, s.y);
        }
      }
    }
    if(started) ctx.stroke();

    // head highlight
    const hd = this.segments[0];
    ctx.fillStyle = this.color === 'green' ? '#8efc8e' : (this.color === 'magenta' ? '#ff8cff' : this.color);
    ctx.beginPath();
    ctx.arc(hd.x, hd.y, SEGMENT_WIDTH*0.6, 0, Math.PI*2);
    ctx.fill();
  }
}

// ---- Spawning / initialization ----
function spawnInitialFoods(){
  while(foods.length < START_FOOD){
    foods.push(new Nutrient(rand(20, canvas.width-20), rand(20, canvas.height-20)));
  }
}

function spawnEnemy(){
  const e = new Worm(rand(0,canvas.width), rand(0,canvas.height), 'magenta', false, rand(0.05, 0.95));
  // initialize some trailing segments behind head so looks natural
  for(let i=1;i<10;i++){
    const bx = (e.segments[0].x - Math.cos(e.angle)*i*WORM_SPEED + canvas.width) % canvas.width;
    const by = (e.segments[0].y - Math.sin(e.angle)*i*WORM_SPEED + canvas.height) % canvas.height;
    e.segments.push({x:bx,y:by, break:false});
  }
  worms.push(e);
}

// start a new game
function startNewGame(){
  worms = [];
  foods = [];
  score = 0;
  scoreElUpdate();

  // create player
  const player = new Worm(canvas.width/2, canvas.height/2, 'green', true, 0.5);
  // give player initial segments
  for(let i=1;i<INITIAL_LENGTH;i++){
    const bx = (player.segments[0].x - Math.cos(player.angle)*i*WORM_SPEED + canvas.width) % canvas.width;
    const by = (player.segments[0].y - Math.sin(player.angle)*i*WORM_SPEED + canvas.height) % canvas.height;
    player.segments.push({x:bx,y:by, break:false});
  }
  worms.push(player);

  // spawn enemies
  for(let i=0;i<ENEMY_COUNT;i++) spawnEnemy();

  // spawn foods
  spawnInitialFoods();

  // hide overlay
  overlay.classList.remove('show');
  newGameBtn.style.display = 'none';
  running = true;
}

// update HUD
function scoreElUpdate(){
  scoreEl.textContent = `Score: ${score}`;
}

// ---- Main loop ----
function update(){
  if(!running) return;

  // For enemies: occasionally choose a new target (intelligence affects choosing food or random)
  for(const w of worms){
    if(!w.alive) continue;

    if(!w.isPlayer){
      if(!w.target || Math.random() < 0.007){
        if(Math.random() < w.intel && foods.length > 0){
          // choose nearest food
          let best = null, bestD = Infinity;
          for(const f of foods){
            const dx = f.x - w.segments[0].x, dy = f.y - w.segments[0].y;
            const d = dx*dx + dy*dy;
            if(d < bestD){ best = f; bestD = d; }
          }
          if(best) w.setTarget(best.x, best.y);
          else w.setTarget(rand(0,canvas.width), rand(0,canvas.height));
        } else {
          w.setTarget(rand(0,canvas.width), rand(0,canvas.height));
        }
      }
    }
  }

  // update worms movement
  for(const w of worms){
    if(w.alive) w.update();
  }

  // eating
  for(const w of worms) {
    if(w.alive) w.eatFoods();
  }

  // collisions (head vs others' segments)
  for(const w of worms){
    if(w.alive) w.checkCollisions(worms);
  }

  // process dead non-player worms: remove and respawn to maintain enemy count
  const wasLen = worms.length;
  worms = worms.filter(w => w.alive || w.isPlayer);
  const currentEnemies = worms.filter(w => !w.isPlayer).length;
  while(currentEnemies < ENEMY_COUNT){
    spawnEnemy();
    // update currentEnemies
    // (recompute to be safe)
    const cs = worms.filter(w=>!w.isPlayer).length;
    if(cs >= ENEMY_COUNT) break;
  }

  // ensure minimum food
  while(foods.length < START_FOOD) foods.push(new Nutrient(rand(10, canvas.width-10), rand(10, canvas.height-10)));
}

function draw(){
  // clear
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // draw foods
  for(const f of foods) f.draw();

  // draw worms
  for(const w of worms) w.draw();

  // score shown in DOM only (no canvas text duplication)
}

// loop
function loop(){
  update();
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---- Input handling ----
// On click/tap: set player's target (they will rotate and move toward it; upon arrival they'll continue straight)
canvas.addEventListener('pointerdown', (ev) => {
  // map to canvas CSS coordinates
  const rect = canvas.getBoundingClientRect();
  const cx = ev.clientX - rect.left;
  const cy = ev.clientY - rect.top;
  const player = worms.find(w => w.isPlayer);
  if(player && player.alive){
    player.setTarget(cx, cy);
  }
});

// Prevent context menu on long press
window.addEventListener('contextmenu', e => e.preventDefault());

// New game button
newGameBtn.addEventListener('click', startNewGame);

// Show New Game on initial load
overlay.classList.add('show');
newGameBtn.style.display = 'inline-block';
scoreElUpdate();
