const qs = (id) => document.getElementById(id);
const scoreEl = qs('score');
const livesEl = qs('lives');
const timerEl = qs('timer');
const msgEl = qs('msg');

export const HUD = {
  setScore(v){ scoreEl.textContent = `Score: ${v}`; },
  setLives(v){ livesEl.textContent = `Lives: ${v}`; },
  setTime(v){ timerEl.textContent = `Time: ${v}`; },
  setMsg(v){ msgEl.textContent = v; },
  showOverlay(text, onRestart){
    const div = document.createElement('div');
    div.className = 'overlay';
    div.innerHTML = `<div>${text}<br><span class="btn">Restart (R)</span></div>`;
    div.addEventListener('click', () => { onRestart(); div.remove(); });
    document.body.appendChild(div);
  }
};
