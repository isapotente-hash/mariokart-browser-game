import './style.css';
import { Game } from './core/Game';
import { graphicsSupport } from './platform/capabilities';

const root = document.querySelector<HTMLElement>('#app')!;
function showFailure(message: string): void {
  root.replaceChildren();
  const screen = document.createElement('main'); screen.className = 'failure-screen';
  const title = document.createElement('h1'); title.textContent = 'A quick pit stop.';
  const description = document.createElement('p'); description.textContent = message;
  const retry = document.createElement('button'); retry.className = 'primary-button'; retry.textContent = 'Try again'; retry.onclick = () => location.reload();
  screen.append(title, description, retry); root.append(screen);
}

if (!graphicsSupport()) {
  showFailure('This playground needs WebGL 2. Try a recent desktop Chrome, Edge, Firefox or Safari with hardware acceleration enabled. A keyboard is required to drive.');
} else {
  try {
    const game = new Game(root);
    if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
    window.addEventListener('pagehide', (event) => { if (!event.persisted) game.dispose(); }, { once: true });
  } catch (error) {
    console.error(error);
    showFailure('The course could not start. Check that hardware acceleration is enabled and reload the page.');
  }
}
