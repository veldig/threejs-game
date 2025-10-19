# 🛸 **Super Bowl Shuttle — Andromeda Run**

**CSCI 310 – GUI & Game Programming**  
**Instructor:** Dr. Chang  
**Author:** Martín Sebastián Vizcaíno Rivas and Badrinath Arul Raj 

**Live Game:** [Play on GitHub Pages](https://YOUR-USERNAME.github.io/threejs-game/)  
*(replace YOUR-USERNAME with your GitHub handle)*  

---

## 🎮 Game Story
You’re an alien from the **Andromeda Galaxy** who just attended the **Super Bowl**—the Eagles beat the Chiefs, and the victory beers hit hard.  
Now your shuttle is leaving soon, but all your friends forgot they need a ride home.  

You must pilot your craft around the arena, collecting your **friends** before time runs out. Watch out for the floating **beer crates** left from the celebration—they’ll knock you around and cost you a strike.  

When all friends are rescued, you win. Run out of time or strikes, and you miss the shuttle.

---

## ⚙️ Game Mechanics

| Feature | Description |
|:--|:--|
| **Movement** | `WASD` keys to move • Drag mouse to look • `R` to reset |
| **Goal** | Collect all friends before the timer expires |
| **Hazards** | Beer crates cause damage (lose 1 strike) |
| **Physics** | Built with **Cannon-ES** for realistic collisions and knockback |
| **Scoring** | +10 points per friend rescued |
| **Lives** | 3 strikes → game over |
| **Feedback** | HUD updates score/time/lives + audio SFX + bloom lighting |
| **Replay** | Press `R` or click overlay to restart |

---

## 🧠 Core Technologies

- **Three.js**  – 3D scene, camera, renderer, lighting  
- **Cannon-ES**  – physics engine for movement & collisions  
- **Post-Processing**  – Unreal Bloom for emissive glow  
- **OrbitControls**  – mouse drag camera view  
- **HTML/CSS/JS modules**  – organized by `objects.js`, `world.js`, `hud.js`, `utils.js`  

---

## 🏗️ Structure
```
threejs-game/
├── index.html
├── styles.css
└── src/
    ├── main.js
    ├── world.js
    ├── objects.js
    ├── hud.js
    ├── utils.js
```

---

## 🧩 Game Flow
1. **Start Overlay** – explains the story + controls.  
2. **Gameplay Loop** – physics updates + HUD + bloom render.  
3. **Win State** – all friends rescued → “You Win” overlay.  
4. **Fail State** – time or lives reach zero → “Game Over” overlay.  
5. **Reset** – press `R` to reload the arena.

---

## 💡 Design Decisions
- **Zero-gravity** feel fits the “space arena” setting.  
- **Emissive materials + bloom** add sci-fi aesthetic.  
- **Audio feedback** makes scoring and damage clear.  
- **Orbit camera** keeps player centered yet interactive.  
- **Simple geometry** ensures high FPS even on low-end devices.  

---

## 🧪 Development Notes
- Tested on Chrome and Firefox (Desktop).  
- Hosted via GitHub Pages for cross-platform access.  
- Uses ES Modules + import maps for dependency loading.  

---

## 🧾 Grading Checklist ✅
| Category | Status |
|:--|:--|
| 3D Scene, Camera, Renderer | ✅ |
| Lighting & World Building | ✅ |
| Physics & Collisions | ✅ |
| Interaction & Controls | ✅ |
| Start/End Flow | ✅ |
| Scoring & Feedback | ✅ |
| Hosting & Deployment | ✅ |
| Game Story / Theme | ✅ |

---

## 🚀 Future Ideas (Bonus Expansion)
- Add particle bursts on rescue.  
- Replace beer crates with GLTF models.  
- Background music and start menu.  
- Leaderboard with saved scores (localStorage).  

---

**Play it. Rescue your friends. Don’t miss the shuttle.** 🛸  
© 2025 Martín Sebastián Vizcaíno Rivas  
