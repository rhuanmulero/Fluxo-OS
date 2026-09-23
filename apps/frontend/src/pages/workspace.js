import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '../styles/tokens.css';
import '../styles/auth.css';
import '../styles/components.css';
import { session } from '../core/session-store.js';
import { workspaceApi } from '../api/workspace-api.js';
import { ApiError } from '../core/api-error.js';
import { PendingButton } from '../components/pending-button.js';

const VIEW_OFFSETS = {
  'view-home': '0%',
  'view-code': '-33.333%',
  'view-create': '-66.666%',
};

function goToView(viewId) {
  document.getElementById('viewSlider').style.transform = `translateX(${VIEW_OFFSETS[viewId]})`;
}

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => goToView(button.dataset.view));
});

document.querySelectorAll('.code-input').forEach((input) => {
  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase();
  });
});

function enter(workspace) {
  sessionStorage.setItem('fluxo_active_workspace', workspace.id);
  window.location.assign('/index.html');
}

function renderWorkspaces(workspaces) {
  const list = document.getElementById('workspaceList');
  list.innerHTML = '';

  if (workspaces.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'list-empty';
    empty.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="7" width="18" height="13" rx="2"/>
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      <strong>Nenhum workspace por aqui</strong>
      <span>Entre com um código de convite ou crie o seu primeiro espaço.</span>
    `;
    list.appendChild(empty);
    return;
  }

  for (const workspace of workspaces) {
    const item = document.createElement('button');
    item.className = 'list-item nav-btn';
    item.textContent = workspace.name;
    item.addEventListener('click', () => enter(workspace));
    list.appendChild(item);
  }
}

function showFieldError(elementId, error) {
  document.getElementById(elementId).textContent =
    error instanceof ApiError ? error.message : 'Não foi possível concluir.';
}

async function refresh() {
  renderWorkspaces(await workspaceApi.list());
}

const createButton = new PendingButton(
  document.getElementById('createForm').querySelector('button[type="submit"]'),
);

document.getElementById('createForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = event.currentTarget.querySelector('input');

  void createButton
    .during(() => workspaceApi.create(input.value))
    .then(enter)
    .catch((error) => showFieldError('createError', error));
});

const codeButton = new PendingButton(
  document.getElementById('codeForm').querySelector('button[type="submit"]'),
);

document.getElementById('codeForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = event.currentTarget.querySelector('.code-input');

  void codeButton
    .during(() => workspaceApi.acceptInvite(input.value))
    .then(async () => {
      document.getElementById('codeError').textContent = '';
      goToView('view-home');
      await refresh();
    })
    .catch((error) => showFieldError('codeError', error));
});

await session.requireSession();
await refresh();
