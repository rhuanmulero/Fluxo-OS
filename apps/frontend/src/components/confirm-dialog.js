export class ConfirmDialog {
  ask({ title, message, confirmLabel = 'Confirmar', danger = false }) {
    return this.#open({ title, message, confirmLabel, danger, expected: null });
  }

  askTyped({ title, message, confirmLabel = 'Excluir', expected }) {
    return this.#open({ title, message, confirmLabel, danger: true, expected });
  }

  #open({ title, message, confirmLabel, danger, expected }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-dialog">
          <h3>${title}</h3>
          <p>${message}</p>
          ${expected ? `<input type="text" class="settings-input" placeholder="${expected}">` : ''}
          <div class="modal-actions">
            <button class="btn-secondary" data-answer="no">Cancelar</button>
            <button class="btn-primary ${danger ? 'is-danger' : ''}" data-answer="yes"
                    ${expected ? 'disabled' : ''}>${confirmLabel}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('active'));

      const confirm = overlay.querySelector('[data-answer="yes"]');
      const input = overlay.querySelector('input');

      if (input) {
        input.addEventListener('input', () => {
          confirm.disabled = input.value !== expected;
        });
        input.focus();
      }

      const finish = (answer) => {
        document.removeEventListener('keydown', onKeyDown);
        overlay.remove();
        resolve(answer);
      };

      const onKeyDown = (event) => {
        if (event.key === 'Escape') finish(false);
      };

      confirm.addEventListener('click', () => finish(true));
      overlay.querySelector('[data-answer="no"]').addEventListener('click', () => finish(false));
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) finish(false);
      });
      document.addEventListener('keydown', onKeyDown);
    });
  }
}

export const confirmDialog = new ConfirmDialog();
