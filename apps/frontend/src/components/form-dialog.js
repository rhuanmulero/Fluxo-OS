import { FormFields } from './form-field.js';

export class FormDialog {
  ask({ title, fields, confirmLabel = 'Salvar' }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-dialog">
          <h3>${title}</h3>
          <div class="form-dialog-fields">
            ${fields.map((field) => this.#field(field)).join('')}
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" data-answer="no">Cancelar</button>
            <button class="btn-primary" data-answer="yes">${confirmLabel}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('active'));

      const form = new FormFields(
        overlay,
        fields.map((field) => ({
          name: field.name,
          required: field.required ?? false,
          message: field.message ?? 'Preencha este campo.',
        })),
      );

      const finish = (value) => {
        document.removeEventListener('keydown', onKeyDown);
        overlay.remove();
        resolve(value);
      };

      const onKeyDown = (event) => {
        if (event.key === 'Escape') finish(null);
      };

      overlay.querySelector('[data-answer="yes"]').addEventListener('click', () => {
        if (form.validate()) finish(form.values());
      });

      overlay.querySelector('[data-answer="no"]').addEventListener('click', () => finish(null));
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) finish(null);
      });

      document.addEventListener('keydown', onKeyDown);
      overlay.querySelector('input, textarea')?.focus();
    });
  }

  #field(field) {
    const control =
      field.type === 'textarea'
        ? `<textarea class="settings-input" rows="4" placeholder="${field.placeholder ?? ''}">${field.value ?? ''}</textarea>`
        : `<input type="${field.type ?? 'text'}" class="settings-input" placeholder="${field.placeholder ?? ''}" value="${field.value ?? ''}">`;

    return `
      <div class="form-group" data-field="${field.name}">
        <label>${field.label}</label>
        ${control}
      </div>
    `;
  }
}

export const formDialog = new FormDialog();
