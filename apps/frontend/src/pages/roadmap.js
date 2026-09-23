import { createIcons, icons } from 'lucide';
import '../styles/pages/roadmap.css';
import { roadmapApi } from '../api/roadmap-api.js';
import { projectApi } from '../api/project-api.js';
import { workspaceContext } from '../core/workspace-context.js';
import { PendingButton } from '../components/pending-button.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { formDialog } from '../components/form-dialog.js';
import { pageFeedback } from '../core/page-feedback.js';
import { regionLoader } from '../components/region-loader.js';
import { emptyState, emptyStateHtml } from '../components/empty-state.js';
import { Dropdown } from '../components/dropdown.js';

const STATUS_LABELS = {
  PLANNED: 'Planejada',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
};

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

export default function RoadmapPage() {
  const container = document.createElement('div');
  container.className = 'roadmap-container';

  let roadmaps = [];
  let selectedId = null;
  let canManage = false;

  function selected() {
    return roadmaps.find((roadmap) => roadmap.id === selectedId) ?? roadmaps[0] ?? null;
  }

  async function loadPermissions() {
    const modules = await projectApi.moduleSettings(workspaceContext.projectId);
    const roadmap = modules.find((module) => module.module === 'ROADMAP');

    canManage =
      roadmap?.governance === 'MICROMANAGEMENT' || workspaceContext.isAdmin;
  }

  async function refresh() {
    if (!workspaceContext.projectId) {
      container.replaceChildren(
        emptyState({
          icon: 'target',
          message: 'Crie um projeto para definir metas.',
        }),
      );
      createIcons({ icons });
      return;
    }

    await regionLoader.during(container, async () => {
      try {
        await loadPermissions();
        roadmaps = await roadmapApi.list(workspaceContext.projectId);
        selectedId = selected()?.id ?? null;
        render();
      } catch (error) {
        pageFeedback.fail(error);
      }
    });
  }

  function render() {
    const current = selected();

    container.innerHTML = `
      <aside class="tasks-sidebar">
        <div class="sidebar-header-action">
          <div class="sidebar-label" style="margin:0; padding:0;">Metas</div>
          ${canManage ? '<button class="btn-icon-small" id="btn-new-roadmap" title="Nova meta"><i data-lucide="plus"></i></button>' : ''}
        </div>
        ${
          roadmaps.length
            ? roadmaps
                .map(
                  (roadmap) => `
              <button class="filter-btn ${roadmap.id === current?.id ? 'active' : ''}"
                      data-roadmap="${roadmap.id}">
                <i data-lucide="target" style="width:16px;"></i> ${roadmap.title}
              </button>`,
                )
                .join('')
            : '<div class="sidebar-label">Nenhuma meta.</div>'
        }
      </aside>
      <main class="roadmap-main">
        ${current ? renderRoadmap(current) : emptyStateHtml({ icon: 'target', message: 'Crie uma meta para começar.' })}
      </main>
    `;

    bindSidebar();

    if (current) bindRoadmap(current);

    createIcons({ icons });
  }

  function renderRoadmap(roadmap) {
    return `
      <header class="tasks-header">
        <div class="header-info">
          <h1>${roadmap.title}</h1>
          <p>${roadmap.description ?? 'Sem descrição.'}</p>
        </div>
        ${canManage ? '<button class="btn-create-task" id="btn-new-stage"><i data-lucide="plus"></i> Nova etapa</button>' : ''}
      </header>
      <div class="roadmap-progress">
        <div class="roadmap-progress-bar" role="progressbar"
             aria-valuenow="${roadmap.progress}" aria-valuemin="0" aria-valuemax="100">
          <div class="roadmap-progress-fill" style="width: ${roadmap.progress}%"></div>
        </div>
        <strong>${roadmap.progress}%</strong>
      </div>
      <div class="stage-list" id="stage-list">
        ${roadmap.stages.map(renderStage).join('')}
      </div>
    `;
  }

  function renderStage(stage) {
    return `
      <article class="stage-card status-${stage.status.toLowerCase()}"
               draggable="true" data-stage="${stage.id}">
        <div class="stage-drag"><i data-lucide="grip-vertical"></i></div>
        <div class="stage-body">
          <strong>${stage.title}</strong>
          <span>${stage.goal ?? ''}</span>
        </div>
        <span class="stage-points">${stage.points} pts</span>
        <div class="stage-status" data-status="${stage.status}"></div>
        ${canManage ? '<button class="action-btn btn-stage-delete" title="Excluir etapa"><i data-lucide="trash-2"></i></button>' : ''}
      </article>
    `;
  }

  function bindSidebar() {
    container.querySelectorAll('[data-roadmap]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedId = button.dataset.roadmap;
        render();
      });
    });

    const newRoadmap = container.querySelector('#btn-new-roadmap');

    if (newRoadmap) {
      const button = new PendingButton(newRoadmap);

      newRoadmap.addEventListener('click', async () => {
        const values = await formDialog.ask({
          title: 'Nova meta',
          confirmLabel: 'Criar',
          fields: [
            {
              name: 'title',
              label: 'Título',
              required: true,
              message: 'Informe o título da meta.',
            },
            { name: 'description', label: 'Descrição', type: 'textarea' },
          ],
        });

        if (!values) {
          return;
        }

        const data = { title: values.title };

        if (values.description) {
          data.description = values.description;
        }

        void button
          .during(() => roadmapApi.create(workspaceContext.projectId, data))
          .then(() => refresh())
          .catch((error) => pageFeedback.fail(error));
      });
    }
  }

  function bindRoadmap(roadmap) {
    const newStage = container.querySelector('#btn-new-stage');

    if (newStage) {
      const button = new PendingButton(newStage);

      newStage.addEventListener('click', async () => {
        const values = await formDialog.ask({
          title: 'Nova etapa',
          confirmLabel: 'Adicionar',
          fields: [
            {
              name: 'title',
              label: 'Título',
              required: true,
              message: 'Informe o título da etapa.',
            },
            { name: 'goal', label: 'Meta' },
            { name: 'points', label: 'Pontos', type: 'number', value: '1' },
          ],
        });

        if (!values) {
          return;
        }

        const data = { title: values.title };

        if (values.goal) {
          data.goal = values.goal;
        }

        if (values.points) {
          data.points = Number(values.points);
        }

        void button
          .during(() => roadmapApi.addStage(workspaceContext.projectId, roadmap.id, data))
          .then(() => refresh())
          .catch((error) => pageFeedback.fail(error));
      });
    }

    container.querySelectorAll('.stage-status').forEach((mount) => {
      const stageId = mount.closest('[data-stage]').dataset.stage;

      new Dropdown(mount, {
        options: STATUS_OPTIONS,
        value: mount.dataset.status,
        onChange: (status) =>
          roadmapApi
            .updateStage(workspaceContext.projectId, roadmap.id, stageId, { status })
            .then(() => refresh())
            .catch((error) => {
              pageFeedback.fail(error);

              return refresh();
            }),
      });
    });

    container.querySelectorAll('.btn-stage-delete').forEach((trigger) => {
      const button = new PendingButton(trigger);
      const stageId = trigger.closest('[data-stage]').dataset.stage;

      trigger.addEventListener('click', () => {
        void confirmDialog
          .ask({
            title: 'Excluir etapa',
            message: 'A etapa sai da meta e o progresso é recalculado.',
            confirmLabel: 'Excluir',
            danger: true,
          })
          .then((confirmed) =>
            confirmed
              ? button
                  .during(() =>
                    roadmapApi.removeStage(workspaceContext.projectId, roadmap.id, stageId),
                  )
                  .then(() => refresh())
              : null,
          )
          .catch((error) => pageFeedback.fail(error));
      });
    });

    bindDragAndDrop(roadmap);
  }

  function bindDragAndDrop(roadmap) {
    const list = container.querySelector('#stage-list');
    let dragged = null;

    container.querySelectorAll('.stage-card').forEach((card) => {
      card.addEventListener('dragstart', () => {
        dragged = card;
        card.classList.add('is-dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        dragged = null;
      });
    });

    list.addEventListener('dragover', (event) => {
      event.preventDefault();

      if (!dragged) return;

      const after = [...list.querySelectorAll('.stage-card:not(.is-dragging)')].find((card) => {
        const box = card.getBoundingClientRect();

        return event.clientY < box.top + box.height / 2;
      });

      list.insertBefore(dragged, after ?? null);
    });

    list.addEventListener('drop', (event) => {
      event.preventDefault();

      const orderedIds = [...list.querySelectorAll('.stage-card')].map(
        (card) => card.dataset.stage,
      );

      void roadmapApi
        .reorderStages(workspaceContext.projectId, roadmap.id, orderedIds)
        .then(() => refresh())
        .catch((error) => {
          pageFeedback.fail(error);

          return refresh();
        });
    });
  }

  workspaceContext.onChange(() => void refresh());

  void refresh();

  return container;
}
