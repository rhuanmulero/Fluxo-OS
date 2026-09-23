import { projectApi } from '../../api/project-api.js';
import { workspaceContext } from '../../core/workspace-context.js';
import { ApiError } from '../../core/api-error.js';
import { Dropdown } from '../../components/dropdown.js';
import { regionLoader } from '../../components/region-loader.js';

const MODULE_LABELS = {
  TASKS: 'Tarefas',
  KANBAN: 'Kanban',
  NOTES: 'Anotações',
  SNIPPETS: 'Snippets',
  POMODORO: 'Pomodoro',
  AGENDA: 'Agenda',
  HABITS: 'Hábitos',
  ROADMAP: 'Metas',
};

const GOVERNANCE_LABELS = {
  MICROMANAGEMENT: 'Micromanagement',
  HIERARCHICAL: 'Hierárquico',
};

const GOVERNANCE_OPTIONS = Object.entries(GOVERNANCE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export class GovernanceSection {
  id = 'governance';
  icon = 'shield';
  label = 'Regras dos módulos';

  render(content) {
    const project = workspaceContext.project;

    if (!project) {
      content.innerHTML = '<p class="settings-hint">Crie um projeto para configurar as regras.</p>';
      return;
    }

    content.innerHTML = `
      <h3>Projeto ${project.name}</h3>
      <p class="settings-hint">
        No paradigma <strong>Micromanagement</strong> qualquer membro cria, edita e
        exclui. No <strong>Hierárquico</strong> todos leem e atualizam, mas só
        Administrador ou acima cria e exclui.
      </p>
      <div class="governance-list" id="governance-list">Carregando...</div>
      <p class="settings-error" id="governance-error"></p>
    `;

    void this.#load(content, project.id);
  }

  async #load(content, projectId) {
    const list = content.querySelector('#governance-list');

    try {
      const modules = await regionLoader.during(list, () =>
        projectApi.moduleSettings(projectId),
      );

      list.innerHTML = modules.map((module) => this.#row(module)).join('');
      this.#bind(content, projectId);
    } catch (error) {
      list.innerHTML = '';
      this.#report(content, this.#describe(error));
    }
  }

  #row(setting) {
    const label = MODULE_LABELS[setting.module] ?? setting.module;

    if (!setting.configurable) {
      return `
        <div class="governance-row">
          <span>${label}</span>
          <span class="governance-fixed">${GOVERNANCE_LABELS[setting.governance]} (fixo)</span>
        </div>
      `;
    }

    return `
      <div class="governance-row" data-module="${setting.module}">
        <span>${label}</span>
        <div class="governance-select" data-governance="${setting.governance}"></div>
      </div>
    `;
  }

  #bind(content, projectId) {
    for (const mount of content.querySelectorAll('.governance-select')) {
      const module = mount.closest('[data-module]').dataset.module;

      new Dropdown(mount, {
        options: GOVERNANCE_OPTIONS,
        value: mount.dataset.governance,
        onChange: (governance) =>
          projectApi
            .setGovernance(projectId, module, governance)
            .then(() => this.#report(content, ''))
            .catch((error) => {
              this.#report(content, this.#describe(error));

              return this.#load(content, projectId);
            }),
      });
    }
  }

  #report(content, message) {
    content.querySelector('#governance-error').textContent = message;
  }

  #describe(error) {
    return error instanceof ApiError ? error.message : 'Não foi possível concluir.';
  }
}
