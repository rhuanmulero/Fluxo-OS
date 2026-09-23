import { createIcons, icons } from 'lucide';
import { workspaceApi } from '../../api/workspace-api.js';
import { workspaceContext } from '../../core/workspace-context.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { PendingButton } from '../../components/pending-button.js';
import { Dropdown } from '../../components/dropdown.js';
import { regionLoader } from '../../components/region-loader.js';
import { ApiError } from '../../core/api-error.js';

const ROLE_LABELS = {
  SUPERADMIN: 'Superadministrador',
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
};

export class InvitesSection {
  id = 'invites';
  icon = 'ticket';
  label = 'Convites';

  render(content) {
    content.innerHTML = `
      ${workspaceContext.isSuperadmin ? this.#form() : ''}
      <h3>Convites ativos</h3>
      <div class="invite-list" id="invite-list">Carregando...</div>
      <p class="settings-error" id="invites-error"></p>
    `;

    if (workspaceContext.isSuperadmin) {
      this.#bindForm(content);
    }

    void this.#load(content);
  }

  #form() {
    return `
      <h3>Novo convite</h3>
      <div class="settings-row">
        <div class="settings-row-grow" id="invite-role"></div>
        <input type="email" class="settings-input" id="invite-email"
               placeholder="E-mail (opcional)">
        <button class="btn-primary" id="invite-create">Gerar código</button>
      </div>
    `;
  }

  #bindForm(content) {
    const trigger = content.querySelector('#invite-create');
    const button = new PendingButton(trigger);

    const rolePicker = new Dropdown(content.querySelector('#invite-role'), {
      options: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
      value: Object.keys(ROLE_LABELS)[0],
    });

    trigger.addEventListener('click', () => {
      const email = content.querySelector('#invite-email').value.trim();
      const data = { role: rolePicker.value };

      if (email) data.email = email;

      void button
        .during(() => workspaceApi.createInvite(workspaceContext.workspaceId, data))
        .then(() => {
          content.querySelector('#invite-email').value = '';
          this.#report(content, '');

          return this.#load(content);
        })
        .catch((error) => this.#report(content, this.#describe(error)));
    });
  }

  async #load(content) {
    const list = content.querySelector('#invite-list');

    try {
      const invites = await regionLoader.during(list, () =>
        workspaceApi.invites(workspaceContext.workspaceId),
      );
      const active = invites.filter((invite) => invite.usedAt === null);

      list.innerHTML = active.length
        ? active.map((invite) => this.#row(invite)).join('')
        : '<p class="settings-hint">Nenhum convite ativo.</p>';

      this.#bindRows(content);
      createIcons({ icons });
    } catch (error) {
      list.innerHTML = '';
      this.#report(content, this.#describe(error));
    }
  }

  #row(invite) {
    const expires = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(invite.expiresAt));

    return `
      <div class="invite-row" data-invite="${invite.id}">
        <code class="invite-code">${invite.code}</code>
        <div class="invite-meta">
          <strong>${ROLE_LABELS[invite.role]}</strong>
          <span>${invite.email ?? 'Qualquer pessoa'} &bull; expira ${expires}</span>
        </div>
        <button class="btn-icon-small invite-copy" data-code="${invite.code}"
                data-label="Copiar código"><i data-lucide="copy"></i></button>
        ${
          workspaceContext.isSuperadmin
            ? `<button class="btn-icon-small invite-revoke" data-label="Revogar convite">
                 <i data-lucide="trash-2"></i>
               </button>`
            : ''
        }
      </div>
    `;
  }

  #bindRows(content) {
    for (const trigger of content.querySelectorAll('.invite-copy')) {
      trigger.addEventListener('click', () => {
        void navigator.clipboard
          .writeText(trigger.dataset.code)
          .then(() => {
            trigger.classList.add('is-copied');
            setTimeout(() => trigger.classList.remove('is-copied'), 1200);
          })
          .catch((error) => this.#report(content, this.#describe(error)));
      });
    }

    for (const trigger of content.querySelectorAll('.invite-revoke')) {
      const button = new PendingButton(trigger);
      const inviteId = trigger.closest('[data-invite]').dataset.invite;

      trigger.addEventListener('click', () => {
        void confirmDialog
          .ask({
            title: 'Revogar convite',
            message: 'Quem tiver esse código deixa de conseguir entrar.',
            confirmLabel: 'Revogar',
            danger: true,
          })
          .then((confirmed) => {
            if (!confirmed) return null;

            return button
              .during(() => workspaceApi.revokeInvite(workspaceContext.workspaceId, inviteId))
              .then(() => this.#load(content));
          })
          .catch((error) => this.#report(content, this.#describe(error)));
      });
    }
  }

  #report(content, message) {
    content.querySelector('#invites-error').textContent = message;
  }

  #describe(error) {
    return error instanceof ApiError ? error.message : 'Não foi possível concluir.';
  }
}
