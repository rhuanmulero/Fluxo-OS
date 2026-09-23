import { createIcons, icons } from 'lucide';
import { session } from './core/session-store.js';
import { workspaceContext } from './core/workspace-context.js';
import App from './app.js';

export function render(component, containerElement) {
  containerElement.innerHTML = '';
  containerElement.appendChild(component());
  createIcons({ icons });
}

const user = await session.requireSession();

if (user) {
  await workspaceContext.load();
  render(App, document.getElementById('root'));
}
