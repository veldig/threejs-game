import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';
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
  camera.position.set(0, 1.2, 3);

  const controls = new PointerLockControls(camera, document.body);
  scene.add(controls.getObject());

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) });

  // Visuals
  createLights(scene);
  createArena(scene, world);

  // Entities
  const player = createPlayer(scene, world);
  const ents = [];

  // Orbs
  for(let i=0;i<12;i++){
    const pos = new THREE.Vector3(randRange(-12,12), 0.4, randRange(-12,12));
    ents.push(createOrb(scene, world, pos));
  }
  // Debris
  for(let i=0;i<6;i++){
    const pos = new THREE.Vector3(randRange(-10,10), 0.7, randRange(-10,10));
    ents.push(createDebris(scene, world, pos));
  }

  // State
  let input = { f:0,b:0,l:0,r:0 }; // WASD
  let score = 0, lives = 3, timeLeft = 90, running = false, last = performance.now();

  function onResize(){
    camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', onResize);

  function lockAndStart(){ if (!running){ controls.lock(); start(); }}
  document.addEventListener('click', lockAndStart);
  controls.addEventListener('lock', ()=>{ HUD.setMsg('Collect orbs • Avoid debris'); });

  function start(){
    if (running) return; running = true; score=0; lives=3; timeLeft=90;
    HUD.setScore(score); HUD.setLives(lives); HUD.setTime(timeLeft);
    last = performance.now();
  }

  function reset(){ location.reload(); }
  addEventListener('keydown', (e)=>{
    if(e.code==='KeyW') input.f=1; if(e.code==='KeyS') input.b=1; if(e.code==='KeyA') input.l=1; if(e.code==='KeyD') input.r=1; if(e.code==='KeyR') reset();
  });
  addEventListener('keyup', (e)=>{
    if(e.code==='KeyW') input.f=0; if(e.code==='KeyS') input.b=0; if(e.code==='KeyA') input.l=0; if(e.code==='KeyD') input.r=0;
  });

  // Movement params
  const moveForce = 12;

  // Attach camera to player
  function syncCamera(){
    const { x,y,z } = player.body.position;
    controls.getObject().position.set(x, y+0.1, z);
  }

  function update(dt){
    // Timer
    if (running){ timeLeft = clamp(timeLeft - dt, 0, 999); HUD.setTime(timeLeft.toFixed(0)); }

    // Input → force in camera space
    const dir = new THREE.Vector3();
    controls.getDirection(dir); // forward vector
    dir.y = 0; dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).negate();
    const force = new CANNON.Vec3(0,0,0);
    if (input.f) force.vadd(new CANNON.Vec3(dir.x,0,dir.z).scale(moveForce), force);
    if (input.b) force.vadd(new CANNON.Vec3(-dir.x,0,-dir.z).scale(moveForce), force);
    if (input.r) force.vadd(new CANNON.Vec3(right.x,0,right.z).scale(moveForce), force);
    if (input.l) force.vadd(new CANNON.Vec3(-right.x,0,-right.z).scale(moveForce), force);
    player.body.applyForce(force);

    world.step(1/60, dt, 3);

    // Sync meshes
    player.mesh.position.copy(player.body.position);
    player.mesh.quaternion.copy(player.body.quaternion);

    for (const e of ents){
      if (e.body){ // physics entity
        e.body.position.y = Math.max(e.body.position.y, 0.2);
        e.mesh.position.copy(e.body.position);
        e.mesh.quaternion.copy(e.body.quaternion);
      }
    }

    // Orb pickup (distance test)
    for (const e of [...ents]){
      if (e.kind==='orb'){
        const d = e.mesh.position.distanceTo(player.mesh.position);
        if (d < 0.9){
          score += 10; HUD.setScore(score);
          e.mesh.parent.remove(e.mesh); removeFromArray(ents, e);
        }
      }
    }

    // Debris collision → lose life if speedy impact
    for (const e of ents){
      if (e.kind==='debris'){
        const d = e.mesh.position.distanceTo(player.mesh.position);
        if (d < 1.2 && player.body.velocity.length() > 2.0){
          lives = Math.max(0, lives-1); HUD.setLives(lives);
          // knock back
          const away = player.mesh.position.clone().sub(e.mesh.position).setY(0).normalize().multiplyScalar(5);
          player.body.velocity.set(away.x, 0, away.z);
        }
      }
    }

    // Win/Lose
    if (running && ents.filter(e=>e.kind==='orb').length===0){
      running = false; HUD.showOverlay('Reboot complete! You win!\nScore: '+score, reset);
    }
    if (running && (timeLeft<=0 || lives<=0)){
      running = false; HUD.showOverlay('Game Over\nScore: '+score, reset);
    }

    syncCamera();
  }

  function frame(t){
    const dt = (t - last)/1000; last = t;
    if (running) update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return { reset };
}
