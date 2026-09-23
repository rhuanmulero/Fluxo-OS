export function emptyState({ icon = null, title = null, message, action = null }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-empty';

  const inner = document.createElement('div');
  inner.className = 'empty-state';
  inner.innerHTML = `
    ${icon ? `<i data-lucide="${icon}"></i>` : ''}
    ${title ? `<h3>${title}</h3>` : ''}
    <p>${message}</p>
  `;

  if (action) {
    const button = document.createElement('button');
    button.className = 'btn-primary';
    button.textContent = action.label;
    button.addEventListener('click', action.onClick);
    inner.appendChild(button);
  }

  wrapper.appendChild(inner);

  return wrapper;
}

export function emptyStateHtml(options) {
  return emptyState(options).outerHTML;
}
