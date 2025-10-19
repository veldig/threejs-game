import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
import { clamp, randRange, removeFromArray } from './utils.js';
import { HUD } from './hud.js';
import { createLights, createArena, createPlayer, createOrb, createDebris } from './objects.js';

export function createWorld(canvas){
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06122e);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;

  const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 200);
  camera.position.set(0, 2.0, 6);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 18;

  // Post-processing (subtle bloom)
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.6, 0.2);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);

  // Physics
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) });

  // Visuals
  createLights(scene);
  createArena(scene, world);

  // Entities
  const player = createPlayer(scene, world);
  const ents = [];

  // Orbs
  for (let i = 0; i < 12; i++) {
    const pos = new THREE.Vector3(randRange(-12, 12), 0.4, randRange(-12, 12));
    ents.push(createOrb(scene, world, pos));
  }
  // Debris
  for (let i = 0; i < 6; i++) {
    const pos = new THREE.Vector3(randRange(-10, 10), 0.7, randRange(-10, 10));
    ents.push(createDebris(scene, world, pos));
  }

  // State
  let input = { f:0, b:0, l:0, r:0 };
  let score = 0, lives = 3, timeLeft = 90, running = false, last = performance.now();

  HUD.setScore(score); HUD.setLives(lives); HUD.setTime(timeLeft);

  // Queue removals after physics step
  const removalQueue = new Set();

  // --- Audio (autoplay-safe: created on first Start click) ---
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

  // --- Start overlay ---
  function makeOverlay(html, onClick){
    const div = document.createElement('div');
    div.className = 'overlay';
    div.innerHTML = `<div>${html}<br><span class="btn">Continue</span></div>`;
    div.addEventListener('click', () => { onClick?.(); div.remove(); });
    document.body.appendChild(div);
    return div;
  }

  const startOverlay = makeOverlay('Orb Salvager<br>Collect orbs before power runs out', () => {
    ensureAudio();
    start();
  });

  function start(){
    if (running) return;
    running = true;
    score = 0; lives = 3; timeLeft = 90;
    HUD.setScore(score); HUD.setLives(lives); HUD.setTime(timeLeft);
    last = performance.now();
  }

  function gameOver(win){
    running = false;
    const msg = win ? `Reboot complete! You win!<br>Score: ${score}<br>Time left: ${Math.max(0, timeLeft|0)}s`
                    : `Game Over<br>Score: ${score}`;
    makeOverlay(msg, () => location.reload());
  }

  // Events
  function onResize(){
    camera.aspect = innerWidth / innerHeight; 
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    bloomPass.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', onResize);

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

  const moveForce = 12;

  // ---- helpers ----
  function removeEntity(ent){
    if (ent.mesh && ent.mesh.parent) ent.mesh.parent.remove(ent.mesh);
    if (ent.body) world.removeBody(ent.body);
    removeFromArray(ents, ent);
  }

  // ---- physics-based collisions on the player ----
  player.body.addEventListener('collide', (ev) => {
    const otherBody = ev.body;
    const ent = ents.find(e => e.body === otherBody);
    if (!ent) return;

    if (ent.kind === 'orb') {
      removalQueue.add(ent);
      score += 10;
      HUD.setScore(score);
      sfx.pickup();
      return;
    }

    if (ent.kind === 'debris') {
      const rel = otherBody.velocity.vsub(player.body.velocity).length();
      if (rel > 2.0) {
        lives = Math.max(0, lives - 1);
        HUD.setLives(lives);
        sfx.hit();
        // knockback away from debris
        const away = player.mesh.position.clone()
          .sub(ent.mesh.position)
          .setY(0)
          .normalize()
          .multiplyScalar(5);
        player.body.velocity.set(away.x, 0, away.z);
      }
    }
  });

  function cameraVectors(){
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0; 
    dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).negate();
    return { dir, right };
  }

  function update(dt){
    if (running){
      timeLeft = clamp(timeLeft - dt, 0, 999);
      HUD.setTime(timeLeft.toFixed(0));
    }

    // Input → force in camera space
    const { dir, right } = cameraVectors();
    const force = new CANNON.Vec3(0,0,0);
    if (input.f) force.vadd(new CANNON.Vec3(dir.x,0,dir.z).scale(moveForce), force);
    if (input.b) force.vadd(new CANNON.Vec3(-dir.x,0,-dir.z).scale(moveForce), force);
    if (input.r) force.vadd(new CANNON.Vec3(right.x,0,right.z).scale(moveForce), force);
    if (input.l) force.vadd(new CANNON.Vec3(-right.x,0,-right.z).scale(moveForce), force);
    player.body.applyForce(force);

    world.step(1/60, dt, 3);

    // Process queued removals AFTER physics step
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
    if (running && ents.filter(e => e.kind === 'orb').length === 0){
      gameOver(true);
    }
    if (running && (timeLeft <= 0 || lives <= 0)){
      gameOver(false);
    }

    controls.update();
  }

  function frame(t){
    const dt = (t - last) / 1000; 
    last = t;
    update(dt);
    composer.render(); // use post-processing
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
