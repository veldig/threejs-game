import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
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

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 18;

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
  let score = 0, lives = 3, timeLeft = 90, running = true, last = performance.now();

  // NEW: queue entities to remove safely after physics step
  const removalQueue = new Set();

  function onResize(){
    camera.aspect = innerWidth / innerHeight; 
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', onResize);

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') input.f = 1;
    if (e.code === 'KeyS') input.b = 1;
    if (e.code === 'KeyA') input.l = 1;
    if (e.code === 'KeyD') input.r = 1;
    if (e.code === 'KeyR') location.reload();
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
      // Enqueue for removal (do NOT remove during step)
      removalQueue.add(ent);
      score += 10;
      HUD.setScore(score);
      return;
    }

    if (ent.kind === 'debris') {
      // damage only if impact is strong enough (relative velocity threshold)
      const rel = otherBody.velocity.vsub(player.body.velocity).length();
      if (rel > 2.0) {
        lives = Math.max(0, lives - 1);
        HUD.setLives(lives);
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
    timeLeft = clamp(timeLeft - dt, 0, 999);
    HUD.setTime(timeLeft.toFixed(0));

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
      running = false; 
      HUD.showOverlay('Reboot complete! You win!\nScore: ' + score, () => location.reload());
    }
    if (running && (timeLeft <= 0 || lives <= 0)){
      running = false; 
      HUD.showOverlay('Game Over\nScore: ' + score, () => location.reload());
    }

    controls.update();
  }

  function frame(t){
    const dt = (t - last) / 1000; 
    last = t;
    update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
