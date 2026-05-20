import './style.css';
import { Game } from './engine/Game';
import { soundManager } from './engine/SoundManager';

// Initialize the game when the page is loaded
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game('game-canvas');
  
  // Expose game instance globally for convenience (e.g. death triggers, debugging)
  (window as any).gameInstance = game;

  // --- BUTTON EVENT LISTENERS ---
  const btnStart = document.getElementById('btn-start')!;
  const btnRestart = document.getElementById('btn-restart')!;
  const btnResume = document.getElementById('btn-resume')!;
  const btnMenuMute = document.getElementById('btn-menu-mute')!;
  const btnHudMute = document.getElementById('btn-hud-mute')!;

  btnStart.addEventListener('click', () => {
    game.startGame();
  });

  btnRestart.addEventListener('click', () => {
    game.startGame();
  });

  btnResume.addEventListener('click', () => {
    game.resumeGame();
  });

  // Mute control toggle
  const toggleMute = () => {
    const isMuted = !soundManager.getMuted();
    soundManager.setMute(isMuted);

    // Update UI elements
    btnMenuMute.innerHTML = isMuted 
      ? '<span class="mute-icon">🔇</span> Sound: OFF' 
      : '<span class="mute-icon">🔊</span> Sound: ON';
      
    btnHudMute.innerText = isMuted ? '🔇' : '🔊';
  };

  btnMenuMute.addEventListener('click', toggleMute);
  btnHudMute.addEventListener('click', toggleMute);

  // Prevent backspace or arrow keys scrolling the browser
  window.addEventListener('keydown', (e) => {
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'backspace'].indexOf(e.key.toLowerCase()) > -1) {
      // Allow inputs to be handled by the game, but stop default viewport scrolling behavior
      if (game.state === 'playing') {
        e.preventDefault();
      }
    }
  });
});
