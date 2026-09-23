import { workspaceApi } from '../../api/workspace-api.js';
import { workspaceContext } from '../../core/workspace-context.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { PendingButton } from '../../components/pending-button.js';
import { ApiError } from '../../core/api-error.js';

export class WorkspaceSection {
  id = 'workspace';
  icon = 'building-2';
  label = 'Workspace';

  render(content) {
    const name = workspaceContext.workspaceName;

    content.innerHTML = `
      <h3>Nome</h3>
      <div class="settings-row">
        <input type="text" id="workspace-name" class="settings-input"
               value="${name}" minlength="3" maxlength="80"
               ${workspaceContext.isSuperadmin ? '' : 'disabled'}>
        ${workspaceContext.isSuperadmin ? '<button class="btn-primary" id="workspace-rename">Salvar</button>' : ''}
      </div>
      <p class="settings-error" id="workspace-error"></p>
      ${workspaceContext.isOwner ? this.#dangerZone(name) : ''}
    `;

    if (workspaceContext.isSuperadmin) {
      this.#bindRename(content);
    }

    if (workspaceContext.isOwner) {
      this.#bindDelete(content);
    }
  }

  #dangerZone(name) {
    return `
      <h3>Zona de risco</h3>
      <p class="settings-hint">
        Excluir o workspace <strong id="workspace-delete-name">${name}</strong> apaga projetos, tarefas, notas,
        snippets e convites. Não há como desfazer.
      </p>
      <div class="settings-danger">
        <button class="btn-primary is-danger" id="workspace-delete">Excluir workspace</button>
        <p class="settings-error" id="workspace-delete-error"></p>
      </div>
    `;
  }

  #bindRename(content) {
    const trigger = content.querySelector('#workspace-rename');
    const button = new PendingButton(trigger);

    trigger.addEventListener('click', () => {
      const name = content.querySelector('#workspace-name').value.trim();

      void button
        .during(() => workspaceApi.rename(workspaceContext.workspaceId, name))
        .then(() => workspaceContext.reload())
        .then(() => {
          const dangerName = content.querySelector('#workspace-delete-name');
          if (dangerName) dangerName.textContent = workspaceContext.workspaceName;
          this.#report(content, '#workspace-error', '');
        })
        .catch((error) => this.#report(content, '#workspace-error', this.#describe(error)));
    });
  }

  #bindDelete(content) {
    const trigger = content.querySelector('#workspace-delete');
    const button = new PendingButton(trigger);

    trigger.addEventListener('click', () => {
      const name = workspaceContext.workspaceName;

      void confirmDialog
        .askTyped({
          title: 'Excluir workspace',
          message: `Digite <strong>${name}</strong> para confirmar. Tudo que existe dentro dele será apagado.`,
          expected: name,
        })
        .then((confirmed) => {
          if (!confirmed) return null;

          return button
            .during(() => workspaceApi.remove(workspaceContext.workspaceId))
            .then(() => {
              workspaceContext.clearActive();
              window.location.assign('/workspace.html');
            });
        })
        .catch((error) => this.#report(content, '#workspace-delete-error', this.#describe(error)));
    });
  }

  #report(content, selector, message) {
    content.querySelector(selector).textContent = message;
  }

  #describe(error) {
    return error instanceof ApiError ? error.message : 'Não foi possível concluir.';
  }
}
