import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
import { clamp, randRange, removeFromArray } from './utils.js';
import { HUD } from './hud.js';
import { createLights, createArena, createPlayer, createFriend, createBeerCrate } from './objects.js';

export function createWorld(canvas){
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06122e);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;

  // FIXED CAMERA (centered feel)
  const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 200);
  camera.position.set(0, 10, 12);
  camera.lookAt(0, 0, 0);

  // Post-processing
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.6, 0.25);
  composer.addPass(bloomPass);

  // Physics
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) });

  // Visuals
  createLights(scene);
  createArena(scene, world);

  // Entities
  const player = createPlayer(scene, world);
  const ents = [];

  // Friends (collectibles)
  for (let i = 0; i < 12; i++) {
    const pos = new THREE.Vector3(randRange(-12, 12), 0.4, randRange(-12, 12));
    ents.push(createFriend(scene, world, pos));
  }
  // Beer crates (hazards)
  for (let i = 0; i < 6; i++) {
    const pos = new THREE.Vector3(randRange(-10, 10), 0.7, randRange(-10, 10));
    ents.push(createBeerCrate(scene, world, pos));
  }

  // State
  let input = { f:0, b:0, l:0, r:0 };
  let score = 0, lives = 3, timeLeft = 90, running = false, last = performance.now();

  HUD.setScore(score); HUD.setLives(lives); HUD.setTime(timeLeft);

  // Safe removal queue
  const removalQueue = new Set();

  // --- Audio (autoplay-safe on first click/Enter) ---
  let audioCtx = null;
  function ensureAudio(){
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  function beep(freq = 880, dur = 0.08, type = 'sine', gain = 0.04){
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }
  const sfx = {
    pickup(){ beep(1200, 0.07, 'sine', 0.05); beep(1600, 0.05, 'sine', 0.03); },
    hit(){ beep(200, 0.12, 'square', 0.06); }
  };

  // --- Start overlay (story) ---
  function overlay(html, onClick){
    const div = document.createElement('div');
    div.className = 'overlay';
    div.innerHTML = `<div style="max-width:680px;line-height:1.3">
      ${html}
      <br><span class="btn">Start</span></div>`;
    div.addEventListener('click', () => { onClick?.(); div.remove(); });
    document.body.appendChild(div);
    return div;
  }

  overlay(
    `You’re an alien from the Andromeda galaxy who just watched the Super Bowl —
     you saw the Eagles beat the Chiefs and the celebration beer hit **hard**. 
     Your shuttle leaves soon, but all your friends forgot they still need a ride! 
     Rescue them around the arena before time runs out.<br><br>
     <b>Drunk hint:</b> your left/right are swapped — A is right, D is left. 
     The camera stays centered so you don’t lose them.<br><br>
     Controls: WASD (A/D reversed) • R to reset`,
    () => { ensureAudio(); start(); }
  );

  function start(){
    if (running) return;
    running = true;
    score = 0; lives = 3; timeLeft = 90;
    HUD.setScore(score); HUD.setLives(lives); HUD.setTime(timeLeft);
    last = performance.now();
  }

  function gameOver(win){
    running = false;
    const msg = win
      ? `Everyone’s aboard! 🛸<br>Friends rescued: ${score/10}<br>Time left: ${Math.max(0, timeLeft|0)}s`
      : `You missed the shuttle 😵<br>Friends rescued: ${score/10}`;
    overlay(msg, () => location.reload());
  }

  // Input
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') input.f = 1;
    if (e.code === 'KeyS') input.b = 1;
    if (e.code === 'KeyA') input.l = 1;
    if (e.code === 'KeyD') input.r = 1;
    if (e.code === 'KeyR') location.reload();
    if (e.code === 'Enter' && !running){ ensureAudio(); start(); }
  });
  addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') input.f = 0;
    if (e.code === 'KeyS') input.b = 0;
    if (e.code === 'KeyA') input.l = 0;
    if (e.code === 'KeyD') input.r = 0;
  });

  function onResize(){
    camera.aspect = innerWidth / innerHeight; 
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    bloomPass.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', onResize);

  const moveForce = 12;

  // Helper: remove entity
  function removeEntity(ent){
    if (ent.mesh && ent.mesh.parent) ent.mesh.parent.remove(ent.mesh);
    if (ent.body) world.removeBody(ent.body);
    removeFromArray(ents, ent);
  }

  // Collisions
  player.body.addEventListener('collide', (ev) => {
    const otherBody = ev.body;
    const ent = ents.find(e => e.body === otherBody);
    if (!ent) return;

    if (ent.kind === 'friend') {
      removalQueue.add(ent);
      score += 10;
      HUD.setScore(score);
      sfx.pickup();
      return;
    }

    if (ent.kind === 'beer') {
      const rel = otherBody.velocity.vsub(player.body.velocity).length();
      if (rel > 2.0) {
        lives = Math.max(0, lives - 1);
        HUD.setLives(lives);
        sfx.hit();
        const away = player.mesh.position.clone()
          .sub(ent.mesh.position).setY(0).normalize().multiplyScalar(5);
        player.body.velocity.set(away.x, 0, away.z);
      }
    }
  });

  // Movement uses camera axes; A/D are intentionally reversed
  function cameraVectors(){
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0; dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).negate();
    return { dir, right };
  }

  function update(dt){
    if (running){
      timeLeft = clamp(timeLeft - dt, 0, 999);
      HUD.setTime(timeLeft.toFixed(0));
    }

    // Apply input as forces
    const { dir, right } = cameraVectors();
    const force = new CANNON.Vec3(0,0,0);

    if (input.f) force.vadd(new CANNON.Vec3(dir.x,0,dir.z).scale(12), force);
    if (input.b) force.vadd(new CANNON.Vec3(-dir.x,0,-dir.z).scale(12), force);

    // DRUNK twist: A/D reversed → A adds +right, D adds -right
    if (input.l) force.vadd(new CANNON.Vec3(right.x,0,right.z).scale(12), force);
    if (input.r) force.vadd(new CANNON.Vec3(-right.x,0,-right.z).scale(12), force);

    player.body.applyForce(force);

    world.step(1/60, dt, 3);

    // Remove after step
    if (removalQueue.size) {
      for (const ent of removalQueue) removeEntity(ent);
      removalQueue.clear();
    }

    // Sync meshes
    player.mesh.position.copy(player.body.position);
    player.mesh.quaternion.copy(player.body.quaternion);

    for (const e of ents){
      if (e.body){
        e.body.position.y = Math.max(e.body.position.y, 0.2);
        e.mesh.position.copy(e.body.position);
        e.mesh.quaternion.copy(e.body.quaternion);
      }
    }

    // Win/Lose
    if (running && ents.filter(e => e.kind === 'friend').length === 0){
      gameOver(true);
    }
    if (running && (timeLeft <= 0 || lives <= 0)){
      gameOver(false);
    }
  }

  function frame(t){
    const dt = (t - last) / 1000; 
    last = t;
    update(dt);
    composer.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
