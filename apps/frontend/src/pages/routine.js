import { createIcons, icons } from 'lucide';
import '../styles/pages/routine.css';
import { eventApi } from '../api/event-api.js';
import { workspaceApi } from '../api/workspace-api.js';
import { habitApi } from '../api/habit-api.js';
import { workspaceContext } from '../core/workspace-context.js';
import { PendingButton } from '../components/pending-button.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { pageFeedback } from '../core/page-feedback.js';
import { regionLoader } from '../components/region-loader.js';
import { emptyStateHtml } from '../components/empty-state.js';
import { Dropdown } from '../components/dropdown.js';
import { FormFields } from '../components/form-field.js';
import { session } from '../core/session-store.js';

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function isoOf(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function timeOf(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

const MONTH_FORMAT = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const CALENDAR_CELLS = 42;

function calendarStart(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);

  first.setDate(first.getDate() - first.getDay());

  return first;
}

function calendarDays(month) {
  const start = calendarStart(month);

  return Array.from({ length: CALENDAR_CELLS }, (_, offset) => {
    const day = new Date(start);

    day.setDate(start.getDate() + offset);

    return day;
  });
}

function lastDays(count) {
  const days = [];
  const today = new Date();

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);

    day.setDate(today.getDate() - offset);
    days.push(day);
  }

  return days;
}

export default function RoutinePage() {
  const container = document.createElement('div');
  container.className = 'routine-container';

  let activeTab = 'agenda';
  let events = [];
  let habits = [];
  let habitLogs = new Map();
  let habitView = 'active';
  let editingEventId = null;
  let eventProject = null;
  let eventForm = null;
  let members = [];
  let visibleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedDay = isoOf(new Date());
  const pendingHabitDays = new Set();
  const currentUserId = session.user?.id ?? null;

  function renderShell() {
    container.innerHTML = `
      <main class="routine-main">
        <header class="routine-header">
          <div>
            <h1>Rotina</h1>
            <p>Seus compromissos e seus hábitos, no mesmo lugar.</p>
          </div>
          <div class="routine-tabs">
            <button class="routine-tab ${activeTab === 'agenda' ? 'active' : ''}" data-tab="agenda">
              <i data-lucide="calendar-days"></i> Agenda
            </button>
            <button class="routine-tab ${activeTab === 'habits' ? 'active' : ''}" data-tab="habits">
              <i data-lucide="repeat"></i> Hábitos
            </button>
          </div>
        </header>
        <section class="routine-body" id="routine-body"></section>
        <div class="task-drawer-overlay" id="event-overlay"></div>
        <aside class="task-drawer" id="event-drawer">
          <header class="drawer-header">
            <h2 id="event-drawer-title">Novo evento</h2>
            <button class="btn-icon-small" id="btn-close-event"><i data-lucide="x"></i></button>
          </header>
          <div class="drawer-content">
            <div class="form-group" data-field="title">
              <label>Título</label>
              <input type="text" id="event-title" maxlength="120">
            </div>
            <div class="form-group">
              <label>Descrição</label>
              <input type="text" id="event-description" maxlength="2000">
            </div>
            <div class="grid-2-col">
              <div class="form-group" data-field="startDate">
                <label>Início</label>
                <input type="date" id="event-start-date">
              </div>
              <div class="form-group">
                <label>Hora de início</label>
                <input type="time" id="event-start-time">
              </div>
            </div>
            <div class="grid-2-col">
              <div class="form-group">
                <label>Término</label>
                <input type="date" id="event-end-date">
              </div>
              <div class="form-group">
                <label>Hora de término</label>
                <input type="time" id="event-end-time">
              </div>
            </div>
            <div class="form-group" data-field="participants">
              <label>Participantes</label>
              <div class="participant-list" id="event-participants"></div>
            </div>
            <div class="form-group">
              <label>Projeto</label>
              <div id="event-project"></div>
            </div>
            <label class="event-allday">
              <input type="checkbox" id="event-all-day"> Dia inteiro
            </label>
          </div>
          <footer class="drawer-footer">
            <button class="btn-secondary" id="btn-cancel-event">Cancelar</button>
            <button class="btn-primary" id="btn-save-event">Salvar evento</button>
          </footer>
        </aside>
      </main>
    `;


    container.querySelectorAll('.routine-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        renderShell();
        void refresh();
      });
    });

    bindEventDrawer();
    createIcons({ icons });
  }

  async function refresh() {
    if (activeTab === 'agenda') {
      await refreshAgenda();
      return;
    }

    await refreshHabits();
  }

  const DAY_FORMAT = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

  async function refreshAgenda() {
    await regionLoader.during(container.querySelector('#routine-body'), async () => {
      try {
        const days = calendarDays(visibleMonth);
        const from = new Date(days[0]);
        const to = new Date(days[days.length - 1]);

        to.setHours(23, 59, 59, 999);

        [events, members] = await Promise.all([
          eventApi.list(workspaceContext.workspaceId, {
            from: from.toISOString(),
            to: to.toISOString(),
          }),
          workspaceApi.members(workspaceContext.workspaceId),
        ]);
        renderCalendar();
      } catch (error) {
        pageFeedback.fail(error);
      }
    });
  }

  function groupByDay(list) {
    const groups = new Map();

    for (const event of list) {
      const key = isoOf(new Date(event.startsAt));
      const bucket = groups.get(key) ?? [];

      bucket.push(event);
      groups.set(key, bucket);
    }

    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }

  function renderCalendar() {
    const body = container.querySelector('#routine-body');
    const byDay = new Map(groupByDay(events));
    const todayIso = isoOf(new Date());

    body.innerHTML = `
      <div class="routine-toolbar">
        <div class="calendar-nav">
          <button class="btn-icon-small" id="calendar-prev" data-label="Mês anterior"><i data-lucide="chevron-left"></i></button>
          <strong id="calendar-label">${MONTH_FORMAT.format(visibleMonth)}</strong>
          <button class="btn-icon-small" id="calendar-next" data-label="Próximo mês"><i data-lucide="chevron-right"></i></button>
          <button class="btn-secondary" id="calendar-today">Hoje</button>
        </div>
        <button class="btn-create-task" id="btn-new-event">
          <i data-lucide="plus"></i> Novo evento
        </button>
      </div>

      <div class="calendar-grid">
        ${WEEKDAY_SHORT.map((day) => `<div class="calendar-weekday">${day}</div>`).join('')}
        ${calendarDays(visibleMonth)
          .map((day) => {
            const iso = isoOf(day);
            const items = byDay.get(iso) ?? [];
            const outside = day.getMonth() !== visibleMonth.getMonth();

            return `
              <div class="calendar-day ${outside ? 'is-outside' : ''} ${iso === todayIso ? 'is-today' : ''} ${iso === selectedDay ? 'is-selected' : ''}"
                   data-date="${iso}">
                <span class="calendar-day-number">${day.getDate()}</span>
                ${items
                  .slice(0, 3)
                  .map(
                    (event) => `
                      <span class="calendar-chip" title="${event.title}">
                        ${event.allDay ? '' : `${TIME_FORMAT.format(new Date(event.startsAt))} `}${event.title}
                      </span>`,
                  )
                  .join('')}
                ${items.length > 3 ? `<span class="calendar-more">+${items.length - 3}</span>` : ''}
              </div>`;
          })
          .join('')}
      </div>

      <div class="calendar-day-panel">
        <h3>${DAY_FORMAT.format(new Date(`${selectedDay}T12:00:00`))}</h3>
        <div class="agenda-list" id="agenda-list">
          ${
            (byDay.get(selectedDay) ?? []).length === 0
              ? emptyStateHtml({ icon: 'calendar-days', message: 'Nada marcado neste dia.' })
              : byDay.get(selectedDay).map(renderEventRow).join('')
          }
        </div>
      </div>
    `;

    bindCalendar();
    bindEventRows();
    createIcons({ icons });
  }

  function bindCalendar() {
    const body = container.querySelector('#routine-body');

    body.querySelector('#btn-new-event').addEventListener('click', () => openEventDrawer());

    body.querySelector('#calendar-prev').addEventListener('click', () => {
      visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
      void refreshAgenda();
    });

    body.querySelector('#calendar-next').addEventListener('click', () => {
      visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
      void refreshAgenda();
    });

    body.querySelector('#calendar-today').addEventListener('click', () => {
      const today = new Date();

      visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      selectedDay = isoOf(today);
      void refreshAgenda();
    });

    for (const cell of body.querySelectorAll('.calendar-day')) {
      cell.addEventListener('click', () => {
        selectedDay = cell.dataset.date;
        renderCalendar();
      });

      cell.addEventListener('dblclick', () => {
        selectedDay = cell.dataset.date;
        openEventDrawer();
        container.querySelector('#event-start-date').value = cell.dataset.date;
      });
    }
  }

  function renderEventRow(event) {
    const project = workspaceContext.projects.find((candidate) => candidate.id === event.projectId);
    const time = event.allDay ? 'Dia inteiro' : TIME_FORMAT.format(new Date(event.startsAt));
    const isMine = event.authorId === currentUserId;

    const ownerActions = isMine
      ? `
        <button class="action-btn btn-event-share" title="Alternar visibilidade">
          <i data-lucide="${event.visibility === 'PROJECT' ? 'eye-off' : 'send'}"></i>
        </button>
        <button class="action-btn btn-event-edit" title="Editar"><i data-lucide="pencil"></i></button>
        <button class="action-btn btn-event-delete" title="Excluir"><i data-lucide="trash-2"></i></button>
      `
      : '';

    return `
      <div class="agenda-row" data-id="${event.id}">
        <span class="agenda-time">${time}</span>
        <span class="agenda-mark" style="background: ${project?.color ?? 'transparent'}"></span>
        <div class="agenda-info">
          <strong>${event.title}</strong>
          <span>${event.description ?? ''}</span>
          ${
            event.participants?.length
              ? `<span class="event-participants">Com ${event.participants
                  .map((participant) => participant.name)
                  .join(', ')}</span>`
              : ''
          }
        </div>
        <span class="agenda-visibility">${event.visibility === 'PROJECT' ? 'Equipe' : 'Privado'}</span>
        ${ownerActions}
      </div>
    `;
  }

  function toIso(dateValue, timeValue, allDay) {
    if (!dateValue) return null;

    const time = allDay ? '00:00' : timeValue || '00:00';

    return new Date(`${dateValue}T${time}`).toISOString();
  }

  function fieldsOf(event) {
    const starts = new Date(event.startsAt);
    const ends = event.endsAt ? new Date(event.endsAt) : null;

    return {
      date: isoOf(starts),
      time: timeOf(starts),
      endDate: ends ? isoOf(ends) : '',
      endTime: ends ? timeOf(ends) : '',
    };
  }

  function renderParticipants(chosen) {
    const list = container.querySelector('#event-participants');
    const selected = new Set(chosen.map((participant) => participant.id));

    list.innerHTML = members.length
      ? members
          .map(
            (member) => `
              <label class="participant-option">
                <input type="checkbox" value="${member.userId}"
                       ${selected.has(member.userId) ? 'checked' : ''}
                       ${member.active ? '' : 'disabled'}>
                <span>${member.name}${member.active ? '' : ' (desligado)'}</span>
              </label>`,
          )
          .join('')
      : '<p class="settings-hint">Ninguém mais neste workspace ainda.</p>';
  }

  function chosenParticipants() {
    return [...container.querySelectorAll('#event-participants input:checked')].map(
      (input) => input.value,
    );
  }

  function openEventDrawer(event) {
    eventForm.clear();
    renderParticipants(event?.participants ?? []);

    editingEventId = event?.id ?? null;

    const fields = event ? fieldsOf(event) : null;

    container.querySelector('#event-drawer-title').textContent = event
      ? 'Editar evento'
      : 'Novo evento';
    container.querySelector('#event-title').value = event?.title ?? '';
    container.querySelector('#event-description').value = event?.description ?? '';
    container.querySelector('#event-start-date').value = fields?.date ?? '';
    container.querySelector('#event-start-time').value = fields?.time ?? '';
    container.querySelector('#event-end-date').value = fields?.endDate ?? '';
    container.querySelector('#event-end-time').value = fields?.endTime ?? '';
    eventProject.setOptions(projectOptions(), event?.projectId ?? '');
    container.querySelector('#event-all-day').checked = event?.allDay ?? false;

    container.querySelector('#event-overlay').classList.add('active');
    container.querySelector('#event-drawer').classList.add('active');
  }

  function closeEventDrawer() {
    container.querySelector('#event-overlay').classList.remove('active');
    container.querySelector('#event-drawer').classList.remove('active');
  }

  function projectOptions() {
    return [
      { value: '', label: 'Sem projeto' },
      ...workspaceContext.projects.map((project) => ({
        value: project.id,
        label: project.name,
      })),
    ];
  }

  function bindEventDrawer() {
    const trigger = container.querySelector('#btn-save-event');
    const saveButton = new PendingButton(trigger);

    eventProject = new Dropdown(container.querySelector('#event-project'), {
      options: projectOptions(),
      value: '',
    });

    renderParticipants([]);

    eventForm = new FormFields(container.querySelector('#event-drawer'), [
      { name: 'title', required: true, message: 'Informe o título do evento.' },
      { name: 'startDate', required: true, message: 'Informe a data de início.' },
    ]);

    container.querySelector('#btn-close-event').addEventListener('click', closeEventDrawer);
    container.querySelector('#btn-cancel-event').addEventListener('click', closeEventDrawer);
    container.querySelector('#event-overlay').addEventListener('click', closeEventDrawer);

    trigger.addEventListener('click', () => {
      if (!eventForm.validate()) {
        return;
      }

      const allDay = container.querySelector('#event-all-day').checked;

      const data = {
        title: container.querySelector('#event-title').value.trim(),
        allDay,
        startsAt: toIso(
          container.querySelector('#event-start-date').value,
          container.querySelector('#event-start-time').value,
          allDay,
        ),
      };

      const description = container.querySelector('#event-description').value.trim();
      const projectId = eventProject.value;
      const participantIds = chosenParticipants();
      const endsAt = toIso(
        container.querySelector('#event-end-date').value,
        container.querySelector('#event-end-time').value,
        allDay,
      );

      if (editingEventId) {
        data.description = description || null;
        data.projectId = projectId || null;
        data.participantIds = participantIds;
      } else {
        if (description) data.description = description;
        if (projectId) data.projectId = projectId;
        if (participantIds.length > 0) data.participantIds = participantIds;
      }
      if (endsAt) data.endsAt = endsAt;

      const operation = editingEventId
        ? () => eventApi.update(workspaceContext.workspaceId, editingEventId, data)
        : () => eventApi.create(workspaceContext.workspaceId, data);

      void saveButton
        .during(operation)
        .then(() => {
          closeEventDrawer();

          return refreshAgenda();
        })
        .catch((error) => pageFeedback.fail(error));
    });
  }

  function bindEventRows() {
    container.querySelectorAll('.agenda-row').forEach((row) => {
      const eventId = row.dataset.id;
      const event = events.find((candidate) => candidate.id === eventId);
      const editButton = row.querySelector('.btn-event-edit');
      const shareButton = row.querySelector('.btn-event-share');
      const deleteButton = row.querySelector('.btn-event-delete');

      if (!editButton || !shareButton || !deleteButton) {
        return;
      }

      editButton.addEventListener('click', () => openEventDrawer(event));

      const sharePendingButton = new PendingButton(shareButton);

      shareButton.addEventListener('click', () => {
        const next = event.visibility === 'PROJECT' ? 'PRIVATE' : 'PROJECT';

        void sharePendingButton
          .during(() => eventApi.setVisibility(workspaceContext.workspaceId, eventId, next))
          .then(() => refreshAgenda())
          .catch((error) => pageFeedback.fail(error));
      });

      const deletePendingButton = new PendingButton(deleteButton);

      deleteButton.addEventListener('click', () => {
        void confirmDialog
          .ask({
            title: 'Excluir evento',
            message: `"${event.title}" será removido da agenda.`,
            confirmLabel: 'Excluir',
            danger: true,
          })
          .then((confirmed) =>
            confirmed
              ? deletePendingButton
                  .during(() => eventApi.remove(workspaceContext.workspaceId, eventId))
                  .then(() => refreshAgenda())
              : null,
          )
          .catch((error) => pageFeedback.fail(error));
      });
    });
  }

  async function refreshHabits() {
    await regionLoader.during(container.querySelector('#routine-body'), async () => {
      try {
        const all = await habitApi.list(workspaceContext.workspaceId, habitView === 'archived');

        habits = all.filter((habit) => habit.archived === (habitView === 'archived'));

        const window = lastDays(30);
        const from = isoOf(window[0]);
        const to = isoOf(window[window.length - 1]);

        const entries = await Promise.all(
          habits.map(async (habit) => [
            habit.id,
            new Set(
              (await habitApi.logs(workspaceContext.workspaceId, habit.id, from, to)).map((log) =>
                log.date.slice(0, 10),
              ),
            ),
          ]),
        );

        habitLogs = new Map(entries);
        renderHabits();
      } catch (error) {
        pageFeedback.fail(error);
      }
    });
  }

  function renderHabits() {
    const body = container.querySelector('#routine-body');

    body.innerHTML = `
      <div class="routine-toolbar">
        <div class="habit-views">
          <button class="habit-view ${habitView === 'active' ? 'active' : ''}" data-view="active">Ativos</button>
          <button class="habit-view ${habitView === 'archived' ? 'active' : ''}" data-view="archived">Arquivados</button>
        </div>
        ${
          habitView === 'active'
            ? `<div class="habit-field" data-field="name">
                 <input type="text" class="habit-input" id="habit-name" placeholder="Novo hábito" maxlength="80">
               </div>
               <button class="btn-create-task" id="btn-new-habit"><i data-lucide="plus"></i> Criar</button>`
            : ''
        }
      </div>
      <div class="habit-list" id="habit-list"></div>
    `;

    const list = body.querySelector('#habit-list');

    list.innerHTML = habits.length
      ? habits.map(renderHabitRow).join('')
      : emptyStateHtml({
          icon: 'repeat',
          message:
            habitView === 'archived'
              ? 'Nenhum hábito arquivado.'
              : 'Nenhum hábito ainda.',
        });

    bindHabitEvents();
    createIcons({ icons });
  }

  function renderHabitRow(habit) {
    const done = habitLogs.get(habit.id) ?? new Set();
    const week = lastDays(7);
    const history = lastDays(30);

    return `
      <div class="habit-row" data-id="${habit.id}">
        <div class="habit-identity">
          <span class="habit-color" style="background: ${habit.color ?? '#8b5cf6'}"></span>
          <strong>${habit.name}</strong>
        </div>
        <div class="habit-week">
          ${week
            .map((day) => {
              const iso = isoOf(day);

              return `
                <button class="habit-day ${done.has(iso) ? 'is-done' : ''}"
                        data-date="${iso}" title="${iso}">
                  ${WEEKDAY_LABELS[day.getDay()]}
                </button>`;
            })
            .join('')}
        </div>
        <div class="habit-history" title="Últimos 30 dias">
          ${history
            .map((day) => `<span class="habit-tick ${done.has(isoOf(day)) ? 'is-done' : ''}"></span>`)
            .join('')}
        </div>
        ${
          habitView === 'archived'
            ? `<button class="action-btn btn-habit-unarchive" title="Desarquivar"><i data-lucide="archive-restore"></i></button>`
            : `<button class="action-btn btn-habit-archive" title="Arquivar"><i data-lucide="archive"></i></button>
               <button class="action-btn btn-habit-delete" title="Excluir"><i data-lucide="trash-2"></i></button>`
        }
      </div>
    `;
  }

  function bindHabitEvents() {
    const trigger = container.querySelector('#btn-new-habit');

    if (trigger) {
      const createButton = new PendingButton(trigger);
      const habitForm = new FormFields(container.querySelector('.routine-toolbar'), [
        { name: 'name', required: true, message: 'Informe o nome do hábito.' },
      ]);

      trigger.addEventListener('click', () => {
        if (!habitForm.validate()) {
          return;
        }

        const input = container.querySelector('#habit-name');
        const { name } = habitForm.values();

        void createButton
          .during(() => habitApi.create(workspaceContext.workspaceId, { name }))
          .then(() => {
            input.value = '';

            return refreshHabits();
          })
          .catch((error) => pageFeedback.fail(error));
      });
    }

    container.querySelectorAll('.habit-view').forEach((button) => {
      button.addEventListener('click', () => {
        habitView = button.dataset.view;
        void refreshHabits();
      });
    });

    container.querySelectorAll('.btn-habit-unarchive').forEach((button) => {
      const unarchiveButton = new PendingButton(button);
      const habitId = button.closest('[data-id]').dataset.id;

      button.addEventListener('click', () => {
        void unarchiveButton
          .during(() => habitApi.update(workspaceContext.workspaceId, habitId, { archived: false }))
          .then(() => refreshHabits())
          .catch((error) => pageFeedback.fail(error));
      });
    });

    container.querySelectorAll('.habit-day').forEach((day) => {
      day.addEventListener('click', () => {
        const habitId = day.closest('[data-id]').dataset.id;
        const date = day.dataset.date;
        const key = `${habitId}:${date}`;

        if (pendingHabitDays.has(key)) {
          return;
        }

        const wasDone = day.classList.contains('is-done');

        const operation = wasDone
          ? habitApi.unmark(workspaceContext.workspaceId, habitId, date)
          : habitApi.mark(workspaceContext.workspaceId, habitId, date);

        pendingHabitDays.add(key);
        day.classList.toggle('is-done');
        day.classList.add('is-saving');

        void operation
          .catch((error) => {
            day.classList.toggle('is-done');
            pageFeedback.fail(error);
          })
          .finally(() => {
            day.classList.remove('is-saving');
            pendingHabitDays.delete(key);
          });
      });
    });

    container.querySelectorAll('.btn-habit-archive').forEach((button) => {
      const archiveButton = new PendingButton(button);
      const habitId = button.closest('[data-id]').dataset.id;

      button.addEventListener('click', () => {
        void archiveButton
          .during(() => habitApi.update(workspaceContext.workspaceId, habitId, { archived: true }))
          .then(() => refreshHabits())
          .catch((error) => pageFeedback.fail(error));
      });
    });

    container.querySelectorAll('.btn-habit-delete').forEach((button) => {
      const deleteButton = new PendingButton(button);
      const habitId = button.closest('[data-id]').dataset.id;

      button.addEventListener('click', () => {
        void confirmDialog
          .ask({
            title: 'Excluir hábito',
            message: 'Todo o histórico deste hábito será apagado. Para parar de acompanhar sem perder o histórico, use Arquivar.',
            confirmLabel: 'Excluir',
            danger: true,
          })
          .then((confirmed) =>
            confirmed
              ? deleteButton
                  .during(() => habitApi.remove(workspaceContext.workspaceId, habitId))
                  .then(() => refreshHabits())
              : null,
          )
          .catch((error) => pageFeedback.fail(error));
      });
    });
  }

  workspaceContext.onChange(() => void refresh());

  renderShell();
  void refresh();

  return container;
}
