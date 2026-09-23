import { createIcons, icons } from 'lucide';
import { workspaceApi } from '../../api/workspace-api.js';
import { workspaceContext } from '../../core/workspace-context.js';
import { session } from '../../core/session-store.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { Dropdown } from '../../components/dropdown.js';
import { regionLoader } from '../../components/region-loader.js';
import { PendingButton } from '../../components/pending-button.js';
import { ApiError } from '../../core/api-error.js';

const ROLE_LABELS = {
  OWNER: 'Dono',
  SUPERADMIN: 'Superadministrador',
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
};

const ASSIGNABLE = ['SUPERADMIN', 'ADMIN', 'MEMBER'];

export class MembersSection {
  id = 'members';
  icon = 'users';
  label = 'Membros';

  render(content) {
    content.innerHTML = `
      <h3>Membros do workspace</h3>
      <div class="member-list" id="member-list">Carregando...</div>
      <p class="settings-error" id="members-error"></p>
    `;

    void this.#load(content);
  }

  async #load(content) {
    const list = content.querySelector('#member-list');

    try {
      const members = await regionLoader.during(list, () =>
        workspaceApi.members(workspaceContext.workspaceId),
      );

      list.innerHTML = members.map((member) => this.#row(member)).join('');
      this.#bind(content, members);
      createIcons({ icons });
    } catch (error) {
      list.innerHTML = '';
      this.#report(content, this.#describe(error));
    }
  }

  #row(member) {
    const mine = member.userId === session.user?.id;
    const locked = member.role === 'OWNER' || mine || !workspaceContext.isSuperadmin;

    return `
      <div class="member-row ${member.active ? '' : 'is-inactive'}" data-user="${member.userId}">
        <div class="member-identity">
          <span class="member-avatar" style="background: ${member.profile.themeColor ?? '#8b5cf6'}">
            ${member.name.substring(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>${member.name}${mine ? ' (você)' : ''}</strong>
            <span>${member.email}</span>
          </div>
        </div>
        ${member.active ? '' : '<span class="member-inactive-badge">Desligado</span>'}
        ${
          locked
            ? `<span class="member-role-fixed">${ROLE_LABELS[member.role]}</span>`
            : member.active
              ? `<div class="member-role" data-role="${member.role}"></div>
                 <button class="btn-icon-small member-deactivate" data-label="Desligar do workspace">
                   <i data-lucide="user-x"></i>
                 </button>
                 <button class="btn-icon-small member-remove" data-label="Remover do workspace">
                   <i data-lucide="user-minus"></i>
                 </button>`
              : `<span class="member-role-fixed">${ROLE_LABELS[member.role]}</span>
                 <button class="btn-icon-small member-reactivate" data-label="Reativar acesso">
                   <i data-lucide="user-check"></i>
                 </button>`
        }
      </div>
    `;
  }

  #bind(content, members) {
    for (const mount of content.querySelectorAll('.member-role')) {
      const userId = mount.closest('[data-user]').dataset.user;

      new Dropdown(mount, {
        options: ASSIGNABLE.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
        value: mount.dataset.role,
        onChange: (role) =>
          workspaceApi
            .changeRole(workspaceContext.workspaceId, userId, role)
            .then(() => workspaceContext.reload())
            .then(() => this.#report(content, ''))
            .catch((error) => {
              this.#report(content, this.#describe(error));

              return this.#load(content);
            }),
      });
    }

    for (const trigger of content.querySelectorAll('.member-remove')) {
      const button = new PendingButton(trigger);
      const userId = trigger.closest('[data-user]').dataset.user;
      const member = members.find((candidate) => candidate.userId === userId);

      trigger.addEventListener('click', () => {
        void confirmDialog
          .ask({
            title: 'Remover membro',
            message: `${member.name} sai da lista do workspace e deixa de ser nomeado nas tarefas e notas que criou. Para tirar o acesso preservando o histórico, use Desligar.`,
            confirmLabel: 'Remover',
            danger: true,
          })
          .then((confirmed) => {
            if (!confirmed) return null;

            return button
              .during(() => workspaceApi.removeMember(workspaceContext.workspaceId, userId))
              .then(() => this.#load(content));
          })
          .catch((error) => this.#report(content, this.#describe(error)));
      });
    }

    for (const trigger of content.querySelectorAll('.member-deactivate')) {
      const button = new PendingButton(trigger);
      const userId = trigger.closest('[data-user]').dataset.user;
      const member = members.find((candidate) => candidate.userId === userId);

      trigger.addEventListener('click', () => {
        void confirmDialog
          .ask({
            title: 'Desligar membro',
            message: `${member.name} perde o acesso ao workspace, mas continua aparecendo como autor das tarefas, notas e eventos que criou. Dá para reativar depois.`,
            confirmLabel: 'Desligar',
            danger: true,
          })
          .then((confirmed) => {
            if (!confirmed) return null;

            return button
              .during(() =>
                workspaceApi.setMemberActive(workspaceContext.workspaceId, userId, false),
              )
              .then(() => this.#load(content));
          })
          .catch((error) => this.#report(content, this.#describe(error)));
      });
    }

    for (const trigger of content.querySelectorAll('.member-reactivate')) {
      const button = new PendingButton(trigger);
      const userId = trigger.closest('[data-user]').dataset.user;

      trigger.addEventListener('click', () => {
        void button
          .during(() => workspaceApi.setMemberActive(workspaceContext.workspaceId, userId, true))
          .then(() => this.#load(content))
          .catch((error) => this.#report(content, this.#describe(error)));
      });
    }
  }

  #report(content, message) {
    content.querySelector('#members-error').textContent = message;
  }

  #describe(error) {
    return error instanceof ApiError ? error.message : 'Não foi possível concluir.';
  }
}
