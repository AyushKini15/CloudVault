(() => {
  const N = 20, cv = document.getElementById('board'), ctx = cv.getContext('2d'), S = cv.width / N;
  const $ = id => document.getElementById(id);
  const DIRS = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
  let snake, dir, nextDir, fruit, score, timer = null, over;
  let best = 0; try { best = +localStorage.getItem('cv_snake_best') || 0; } catch (e) {}
  $('best').textContent = best;

  function reset() {
    snake = [[10,10],[9,10],[8,10]]; dir = nextDir = 'right'; score = 0; over = false;
    $('score').textContent = 0; placeFruit(); draw(); stop();
    $('startPause').textContent = 'Start'; $('msg').textContent = 'Press Start.';
  }
  function placeFruit() {
    do fruit = [Math.floor(Math.random()*N), Math.floor(Math.random()*N)];
    while (snake.some(s => s[0]===fruit[0] && s[1]===fruit[1]));
  }
  function stop() { clearInterval(timer); timer = null; }
  function run() { stop(); timer = setInterval(tick, Math.max(60, 140 - score*3)); $('startPause').textContent = 'Pause'; $('msg').textContent = ''; }
  function tick() {
    dir = nextDir; const [dx,dy] = DIRS[dir], h = [snake[0][0]+dx, snake[0][1]+dy];
    if (h[0]<0||h[1]<0||h[0]>=N||h[1]>=N || snake.some(s => s[0]===h[0] && s[1]===h[1])) return gameOver();
    snake.unshift(h);
    if (h[0]===fruit[0] && h[1]===fruit[1]) { score++; $('score').textContent = score; placeFruit(); run(); } else snake.pop();
    draw();
  }
  function gameOver() {
    over = true; stop(); $('startPause').textContent = 'Start'; $('msg').textContent = 'Game over! Score: ' + score;
    if (score > best) { best = score; $('best').textContent = best; try { localStorage.setItem('cv_snake_best', best); } catch (e) {} }
  }
  function draw() {
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0,0,cv.width,cv.height);
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(fruit[0]*S+S/2, fruit[1]*S+S/2, S/2-2, 0, 7); ctx.fill();
    snake.forEach((s,i) => { ctx.fillStyle = i ? '#22c55e' : '#86efac'; ctx.fillRect(s[0]*S+1, s[1]*S+1, S-2, S-2); });
  }
  function turn(d) {
    const o = { up:'down', down:'up', left:'right', right:'left' };
    if (d !== o[dir]) nextDir = d;
  }
  function toggle() { if (over) reset(); if (timer) { stop(); $('startPause').textContent = 'Resume'; } else run(); }
  $('startPause').onclick = toggle; $('restart').onclick = () => { reset(); run(); };
  document.querySelectorAll('.ctrl button').forEach(b => b.addEventListener('click', () => { turn(b.dataset.d); if (!timer && !over) run(); }));
  const keys = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right', w:'up', s:'down', a:'left', d:'right', W:'up', S:'down', A:'left', D:'right' };
  document.addEventListener('keydown', e => { if (keys[e.key]) { e.preventDefault(); turn(keys[e.key]); if (!timer && !over) run(); } });
  let t0; cv.addEventListener('touchstart', e => { t0 = e.touches[0]; }, { passive: true });
  cv.addEventListener('touchend', e => {
    if (!t0) return; const t = e.changedTouches[0], dx = t.clientX-t0.clientX, dy = t.clientY-t0.clientY;
    if (Math.max(Math.abs(dx),Math.abs(dy)) < 20) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up'));
    if (!timer && !over) run();
  });
  reset();
})();
