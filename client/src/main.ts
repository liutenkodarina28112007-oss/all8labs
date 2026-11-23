import './style.css';
import {
  World,
  type InputState,
  type Snapshot,
  type EntityState,
  decodeSnapshot,
} from '@dogfight/shared';
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<main class="shell"><header class="topbar"><div class="brand"><div class="brand-mark">✦</div><div><div>DOGFIGHT</div><div class="eyebrow">MULTIPLAYER SPACE ARENA</div></div></div><div class="status"><i class="dot"></i><span id="connection">OFFLINE TRAINING</span></div></header><section class="layout"><div class="panel"><div class="arena-head"><h2>SECTOR 07 / DEEP SPACE</h2><span class="live">● LIVE SIMULATION</span></div><div class="game-wrap"><canvas id="game"></canvas><div class="wave-banner hidden" id="wave-banner"><small id="wave-kicker">WAVE 1</small><strong id="wave-message">NEXT WAVE</strong><span id="wave-countdown"></span></div><div class="overlay" id="lobby"><div class="modal"><div class="eyebrow">PILOT REGISTRATION · 01</div><h1>ENTER THE<br>ARENA.</h1><p>Join the battle. Fly fast, aim true, and become the last pilot standing.</p><input id="pilot" class="field" maxlength="18" value="Rogue Pilot" placeholder="Your callsign"><input id="room" class="field" maxlength="32" value="sector-07" placeholder="Room code"><button id="join" class="btn full">INITIALIZE FLIGHT ↗</button><p class="help">WASD / ARROWS — MOVE &nbsp; · &nbsp; SPACE — FIRE<br>ENTER — SEND CHAT</p></div></div></div><div class="bottom"><span>FIXED SIMULATION <b>60 HZ</b> · SERVER <b>30 HZ</b></span><span>BUILD <b>1.0.0</b> · <span id="fps">0 FPS</span></span></div></div><aside class="side"><section class="panel card"><h3>COMBAT TELEMETRY</h3><div class="stat-grid"><div class="stat"><strong id="score">000</strong><span>Score</span></div><div class="stat"><strong id="hp">100%</strong><span>Hull integrity</span></div><div class="stat"><strong id="wave">01</strong><span>Current wave</span></div><div class="stat"><strong id="best-wave">01</strong><span>Wave record</span></div><div class="stat"><strong id="rtt">— ms</strong><span>Network RTT</span></div><div class="stat"><strong id="tick">0</strong><span>Server tick</span></div><div class="stat"><strong id="steps">60</strong><span>Steps / sec</span></div><div class="stat"><strong id="frame">0.0</strong><span>Frame ms</span></div></div></section><section class="panel card"><h3>FLIGHT ROSTER <span id="players-count">(0)</span></h3><div id="roster" class="roster"><div class="player"><span>Training drone</span><small>LOCAL</small></div></div></section><section class="panel card"><h3>COMMS CHANNEL</h3><div id="chat" class="chatlog"><div>System: Welcome to Sector 07.</div><div>System: Join a room to connect.</div></div><div class="chatrow"><input id="message" maxlength="240" placeholder="Transmit message…"><button id="send" class="btn">↗</button></div></section></aside></section><div class="help">DOGFIGHT // AUTHORITATIVE MULTIPLAYER PROTOTYPE // KEEP YOUR ENGINES HOT.</div></main><div id="toast" class="toast hidden"></div>`;
const canvas = document.querySelector<HTMLCanvasElement>('#game')!,
  ctx = canvas.getContext('2d')!;
const lobby = document.querySelector('#lobby')!;
const inputKeys = new Set<string>();
const pressed = new Set<string>();
let world = new World(),
  localId = 0,
  localName = 'Pilot',
  roomId = 'sector-07',
  socket: WebSocket | null = null,
  seq = 0,
  tick = 0,
  last = 0,
  acc = 0,
  frames = 0,
  steps = 0,
  statAt = 0,
  frameMs = 0,
  rtt = 0,
  lastPing = 0,
  remoteSnapshot: Snapshot | null = null;
const STEP = 1 / 60;
let pending: InputState[] = [];
let audio: AudioContext | null = null;
function resize() {
  const r = canvas.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(resize).observe(canvas);
function toast(s: string) {
  const t = document.querySelector('#toast')!;
  t.textContent = s;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2600);
}
function addChat(name: string, text: string) {
  const el = document.createElement('div');
  el.className = 'chatline';
  el.innerHTML = `<b>${escapeHtml(name)}:</b> ${escapeHtml(text)}`;
  const log = document.querySelector('#chat')!;
  log.append(el);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 50) log.firstElementChild?.remove();
}
function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
function updateRoster(entities: EntityState[]) {
  const ships = entities.filter((e) => e.kind === 'ship');
  document.querySelector('#players-count')!.textContent = `(${ships.length})`;
  document.querySelector('#roster')!.innerHTML =
    ships
      .map(
        (s) =>
          `<div class="player"><span>✦ ${escapeHtml(s.owner || 'Pilot')}</span><small>${s.id === localId ? 'YOU' : 'ONLINE'}</small></div>`,
      )
      .join('') || '<small>No pilots in sector</small>';
}
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${proto}://${location.host}/ws`);
  socket.binaryType = 'arraybuffer';
  socket.onopen = () => {
    document.querySelector('#connection')!.textContent = 'CONNECTED';
    socket?.send(JSON.stringify({ type: 'join', v: 1, room: roomId, name: localName }));
    toast('Secure channel established.');
  };
  socket.onmessage = (e) => {
    const msg = typeof e.data === 'string' ? JSON.parse(e.data) : decodeSnapshot(e.data);
    if (msg.type === 'joined') {
      localId = msg.playerId;
      addChat('SYSTEM', `Joined ${roomId}`);
    } else if (msg.type === 'chat') addChat(msg.name, msg.text);
    else if (msg.type === 'roster') updateRoster(msg.players);
    else if (msg.type === 'snapshot') {
      remoteSnapshot = msg;
      tick = msg.tick;
      document.querySelector('#tick')!.textContent = String(tick);
      const wave = msg.wave ?? 1,
        bestServer = msg.bestWave ?? 1;
      const storedBest = Number(localStorage.getItem('dogfight-best-wave') || 1);
      const best = Math.max(storedBest, bestServer);
      if (best > storedBest) localStorage.setItem('dogfight-best-wave', String(best));
      document.querySelector('#wave')!.textContent = String(wave).padStart(2, '0');
      document.querySelector('#best-wave')!.textContent = String(best).padStart(2, '0');
      const banner = document.querySelector('#wave-banner')!,
        kicker = document.querySelector('#wave-kicker')!,
        message = document.querySelector('#wave-message')!,
        countdown = document.querySelector('#wave-countdown')!;
      if ((msg.nextWaveCountdown ?? 0) > 0) {
        kicker.textContent = `WAVE ${wave} CLEARED`;
        message.textContent = 'NEXT WAVE';
        countdown.textContent = String(Math.ceil(msg.nextWaveCountdown ?? 0));
        banner.classList.remove('hidden');
      } else if ((msg.nextWaveAnnouncement ?? 0) > 0) {
        kicker.textContent = 'SECTOR ALERT';
        message.textContent = 'NEXT WAVE';
        countdown.textContent = String(wave);
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
      updateRoster(msg.entities);
      const me = msg.entities.find((x: EntityState) => x.id === localId);
      if (me) {
        const old = world.get(localId);
        if (old) old.state = { ...me };
        else {
          world.restore(msg);
        }
      }
      pending = pending.filter((x) => x.seq > (msg.lastProcessedSeq ?? 0));
    } else if (msg.type === 'pong') {
      rtt = performance.now() - lastPing;
      document.querySelector('#rtt')!.textContent = `${rtt.toFixed(0)} ms`;
    }
  };
  socket.onclose = () => {
    document.querySelector('#connection')!.textContent = 'RECONNECTING';
    setTimeout(() => {
      if (!lobby.classList.contains('hidden')) return;
      connect();
    }, 1200);
  };
  socket.onerror = () => toast('Connection interrupted. Reconnecting…');
}
function join() {
  localName = (document.querySelector<HTMLInputElement>('#pilot')!.value || 'Pilot')
    .trim()
    .slice(0, 18);
  roomId = (document.querySelector<HTMLInputElement>('#room')!.value || 'sector-07')
    .trim()
    .slice(0, 32);
  if (!localName || !roomId) return;
  world = new World();
  world.addPlayer(localName, Math.floor(Math.random() * 1e9));
  lobby.classList.add('hidden');
  try {
    audio = new AudioContext();
    void audio.resume();
  } catch {}
  connect();
}
document.querySelector('#join')!.addEventListener('click', join);
document.querySelector<HTMLInputElement>('#pilot')!.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') join();
});
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code))
    e.preventDefault();
  if (!inputKeys.has(e.code)) pressed.add(e.code);
  inputKeys.add(e.code);
});
window.addEventListener('keyup', (e) => inputKeys.delete(e.code));
window.addEventListener('blur', () => inputKeys.clear());
function sendChat() {
  const el = document.querySelector<HTMLInputElement>('#message')!,
    text = el.value.trim();
  if (!text) return;
  if (socket?.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify({ type: 'chat', v: 1, text }));
  el.value = '';
}
document.querySelector('#send')!.addEventListener('click', sendChat);
document.querySelector<HTMLInputElement>('#message')!.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
});
function simulate(dt: number) {
  steps++;
  const me = world.get(localId) || [...world.ofKind('ship')][0];
  if (!me) return;
  const i: InputState = {
    turn:
      (inputKeys.has('KeyD') || inputKeys.has('ArrowRight') ? 1 : 0) -
      (inputKeys.has('KeyA') || inputKeys.has('ArrowLeft') ? 1 : 0),
    thrust: inputKeys.has('KeyW') || inputKeys.has('ArrowUp'),
    fire: inputKeys.has('Space'),
    seq: ++seq,
  };
  world.step(dt, new Map([[localName, i]]), 42);
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: 'input',
        v: 1,
        seq: i.seq,
        turn: i.turn,
        thrust: i.thrust,
        fire: i.fire,
      }),
    );
    pending.push(i);
    if (pending.length > 180) pending.shift();
  }
  pressed.clear();
}
function drawShip(s: EntityState, local: boolean) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.angle);
  ctx.shadowBlur = local ? 22 : 12;
  ctx.shadowColor = local ? '#52e5ff' : '#ff668e';
  ctx.strokeStyle = local ? '#69edff' : '#ff779b';
  ctx.fillStyle = local ? '#163d58' : '#4a203b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(19, 0);
  ctx.lineTo(-12, -11);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-12, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (local && inputKeys.has('KeyW')) {
    ctx.strokeStyle = '#ffb45e';
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(-22, 0);
    ctx.lineTo(-10, 4);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#91a8c9';
  ctx.font = '10px DM Mono';
  ctx.textAlign = 'center';
  ctx.fillText(s.owner || 'PILOT', s.x, s.y + 27);
}
function render() {
  const w = canvas.clientWidth,
    h = canvas.clientHeight,
    sx = w / 900,
    sy = h / 600;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.scale(sx, sy);
  ctx.fillStyle = '#050b18';
  ctx.fillRect(0, 0, 900, 600);
  for (let i = 0; i < 100; i++) {
    const x = (i * 137.5) % 900,
      y = (i * 83.7) % 600;
    ctx.fillStyle = `rgba(139,190,255,${0.15 + (i % 5) * 0.12})`;
    ctx.fillRect(x, y, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
  }
  ctx.strokeStyle = '#142b49';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 900; x += 75) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 600);
    ctx.stroke();
  }
  for (let y = 0; y <= 600; y += 75) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(900, y);
    ctx.stroke();
  }
  const entities = remoteSnapshot?.entities ?? [...world].map((e) => e.state);
  for (const e of entities) {
    if (e.kind === 'ship') drawShip(e, e.id === localId);
    else if (e.kind === 'bullet') {
      ctx.fillStyle = e.owner === localName ? '#67eaff' : '#ff769c';
      ctx.shadowBlur = 14;
      ctx.shadowColor = e.owner === localName ? '#67eaff' : '#ff769c';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (e.kind === 'asteroid') {
      ctx.strokeStyle = '#8394b3';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  const me = entities.find((e) => e.id === localId);
  if (me) {
    document.querySelector('#hp')!.textContent = `${Math.max(0, me.hp)}%`;
    document.querySelector('#score')!.textContent = String(me.score).padStart(3, '0');
  }
}
function frame(now: number) {
  if (!last) last = now;
  const elapsed = Math.min((now - last) / 1000, 0.25);
  last = now;
  frameMs = elapsed * 1000;
  acc += elapsed;
  while (acc >= STEP) {
    simulate(STEP);
    acc -= STEP;
  }
  render();
  frames++;
  if (now - statAt > 1000) {
    document.querySelector('#fps')!.textContent = `${frames} FPS`;
    document.querySelector('#steps')!.textContent = String(steps);
    document.querySelector('#frame')!.textContent = frameMs.toFixed(1);
    frames = 0;
    steps = 0;
    statAt = now;
    if (socket?.readyState === WebSocket.OPEN) {
      lastPing = performance.now();
      socket.send(JSON.stringify({ type: 'ping', v: 1 }));
    }
  }
  requestAnimationFrame(frame);
}
resize();
requestAnimationFrame(frame);
if ('serviceWorker' in navigator)
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
