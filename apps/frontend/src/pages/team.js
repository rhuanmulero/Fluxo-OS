import { createIcons, icons } from 'lucide';
import '../styles/pages/team.css';
import { workspaceApi } from '../api/workspace-api.js';
import { workspaceContext } from '../core/workspace-context.js';
import { pageFeedback } from '../core/page-feedback.js';
import { regionLoader } from '../components/region-loader.js';
import { focusTimer } from '../core/focus-timer.js';
import { presence } from '../core/presence-service.js';
import { PendingButton } from '../components/pending-button.js';
import { Dropdown } from '../components/dropdown.js';

const ROLE_LABELS = {
  OWNER: 'Dono',
  SUPERADMIN: 'Superadministrador',
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
};

const STATUS_LABELS = {
  ONLINE: 'Disponível',
  DEEP_WORK: 'Em Foco',
  AWAY: 'Ausente',
  OFFLINE: 'Offline',
};

const STATUS_CLASSES = {
  ONLINE: 'status-online',
  DEEP_WORK: 'status-deepwork',
  AWAY: 'status-away',
  OFFLINE: 'status-offline',
};

const DEFAULT_BANNER =
  'https://images.unsplash.com/photo-1550439062-609e1531270e?q=80&w=1000&auto=format&fit=crop';
const DEFAULT_COLOR = '#8b5cf6';

export default function TeamPage() {
  const container = document.createElement('div');
  container.className = 'team-container';

  let members = [];
  let me = null;
  let stats = null;
  let pendingOwnProfile = false;

  async function reload() {
    [members, me, stats] = await Promise.all([
      workspaceApi.members(workspaceContext.workspaceId),
      workspaceApi.me(),
      workspaceApi.stats(),
    ]);

    renderPage();

    if (pendingOwnProfile) {
      pendingOwnProfile = false;
      openOwnProfile();
    }
  }

  async function refresh() {
    await regionLoader.during(container, async () => {
      try {
        await reload();
      } catch (error) {
        pendingOwnProfile = false;
        pageFeedback.fail(error);
      }
    });
  }

  function openOwnProfile() {
    const card = container.querySelector(`.dev-card-mini[data-id="${me?.id}"]`);
    if (card) card.click();
  }

  function isMe(member) {
    return member.userId === me?.id;
  }

  const NO_BIO = 'Este membro ainda não escreveu uma bio.';

  function displayed(profile, member) {
    return {
      jobTitle: profile.jobTitle ?? ROLE_LABELS[member.role],
      vibe: profile.vibe ?? ROLE_LABELS[member.role],
      bannerUrl: profile.bannerUrl ?? DEFAULT_BANNER,
      bio: profile.bio ?? NO_BIO,
    };
  }

  function profileOf(member) {
    const profile = member.profile;

    return {
      jobTitle: profile.jobTitle,
      bio: profile.bio,
      stack: profile.stack,
      bannerUrl: profile.bannerUrl,
      themeColor: profile.themeColor ?? DEFAULT_COLOR,
      vibe: profile.vibe,
      status: profile.status,
    };
  }

  function currentQuest() {
    return focusTimer.selectedTaskId;
  }

  function renderPage() {
    container.innerHTML = `
            <main class="team-main">
                <header style="margin-bottom: 24px;">
                    <h1 style="font-size: 28px; margin-bottom: 8px;">A Guilda (Equipe)</h1>
                    <p style="color: var(--text-muted);">Membros reais deste workspace e seus papéis.</p>
                </header>
                <div class="team-grid" id="team-grid-container">
                    ${members.map(renderMiniCard).join('')}
                </div>
                <div id="steam-modal" class="steam-profile-modal">
                    <div class="sp-split-container" id="steam-content"></div>
                </div>
            </main>
        `;

    attachGridEvents();
    createIcons({ icons });
  }

  container.addEventListener('open-own-profile', () => {
    if (me) {
      openOwnProfile();
    } else {
      pendingOwnProfile = true;
    }
  });

  function renderMiniCard(member) {
    const profile = profileOf(member);
    const shown = displayed(profile, member);
    const initials = member.name.substring(0, 2).toUpperCase();

    return `
            <div class="dev-card-mini" data-id="${member.userId}">
                <div class="dev-card-hover-overlay">
                    <div class="hover-btn">
                        ${isMe(member) ? '<i data-lucide="edit-3" style="width:16px;"></i> Editar Perfil' : '<i data-lucide="user" style="width:16px;"></i> Ver Perfil'}
                    </div>
                </div>

                <div class="dev-card-banner" style="background-image: url('${shown.bannerUrl}')">
                    <div class="status-indicator ${STATUS_CLASSES[profile.status]}">
                        <div class="status-dot"></div>
                        ${STATUS_LABELS[profile.status]}
                    </div>
                </div>
                <div class="dev-card-body">
                    <div class="dev-avatar" style="background: ${profile.themeColor}">${initials}</div>
                    <div class="dev-name">${member.name}</div>
                    <div class="dev-role">${shown.jobTitle}</div>
                    ${member.active ? '' : '<div class="dev-inactive">Desligado</div>'}
                    <div class="dev-current-quest">
                        <span>Papel no workspace:</span>
                        <strong>${ROLE_LABELS[member.role]}</strong>
                    </div>
                </div>
            </div>
        `;
  }

  function renderLeftCardHTML(member) {
    const profile = profileOf(member);
    const shown = displayed(profile, member);
    const initials = member.name.substring(0, 2).toUpperCase();
    const mine = isMe(member);

    const statBoxes = mine
      ? `<div class="stat-box"><strong>${stats?.completedTasks ?? 0}</strong><span>tarefas concluídas</span></div>
                            <div class="stat-box"><strong>${stats?.pomodoroCycles ?? 0}</strong><span>ciclos de foco</span></div>
                            <div class="stat-box"><strong>${stats?.focusMinutes ?? 0}</strong><span>minutos de foco</span></div>
                            <div class="stat-box"><strong>${stats?.activeDays ?? 0}</strong><span>dias ativos</span></div>`
      : `<div class="stat-box"><strong>${ROLE_LABELS[member.role]}</strong><span>papel</span></div>`;

    return `
            <div class="sp-left-wrapper" id="sp-left-wrapper">
                <div class="sp-left-card" id="sp-left-card" style="--user-color: ${profile.themeColor}">
                    <div class="sp-left-banner" style="background-image: url('${shown.bannerUrl}')"></div>
                    <div class="sp-left-avatar">${initials}</div>

                    <div class="sp-left-info">
                        <div class="sp-left-name">${member.name}</div>
                        <div class="sp-left-role">${shown.jobTitle}</div>

                        <div class="sp-vibe-bubble">
                            ${shown.vibe}
                        </div>

                        <div class="sp-left-bio">${shown.bio}</div>

                        <div class="sp-dev-stats">
                            ${statBoxes}
                        </div>

                        <div class="sp-tech-stack">
                            ${profile.stack.map((item) => `<div class="sp-tech-item">${item}</div>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  function renderRightViewHTML(member) {
    const profile = profileOf(member);
    const shown = displayed(profile, member);
    const mine = isMe(member);
    const quest = currentQuest();

    return `
            <div class="sp-right-panel" id="sp-right-panel" style="--user-color: ${profile.themeColor}">
                <div class="sp-right-header">
                    <h2><i data-lucide="user" style="width:20px; color: var(--user-color)"></i> Detalhes do Perfil</h2>
                    <div class="sp-right-actions">
                        ${mine ? `<button class="btn-secondary" id="btn-go-edit" style="border: 1px solid var(--surface-border);"><i data-lucide="edit-3" style="width:14px; margin-right:6px;"></i> Editar</button>` : ''}
                        <button class="btn-secondary btn-close-modal"><i data-lucide="x" style="width:18px;"></i></button>
                    </div>
                </div>

                <div class="sp-right-content">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                        <div>
                            <div class="sp-section-title">Sobre</div>
                            <div class="sp-bio">${shown.bio}</div>
                        </div>
                        <div>
                            <div class="sp-section-title">Contato</div>
                            <div class="sp-bio">${member.email}</div>
                        </div>
                    </div>

                    <div>
                        <div class="sp-section-title">Missão Atual</div>
                        <div class="sp-glass-box quest-box" style="padding: 16px 24px; border-color: var(--user-color);">
                            <div class="quest-icon" style="color: var(--user-color);"><i data-lucide="target" style="width:24px;"></i></div>
                            <div class="quest-info">
                                <h4>${mine && quest ? 'Demanda vinculada ao Pomodoro' : 'Nenhuma demanda vinculada'}</h4>
                                <p>Selecionada na aba Pomodoro</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  function renderRightEditHTML(member) {
    const profile = profileOf(member);
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

    return `
            <div class="sp-right-panel" id="sp-right-panel">
                <div class="sp-right-header">
                    <h2><i data-lucide="settings" style="width:20px;"></i> Personalizar Perfil</h2>
                    <div class="sp-right-actions">
                        <button class="btn-secondary btn-close-modal"><i data-lucide="x" style="width:18px;"></i></button>
                    </div>
                </div>

                <div class="sp-right-content">
                    <div class="sp-edit-form">
                        <div class="sp-input-group">
                            <label>Cor da Aura (Tema)</label>
                            <div class="color-picker" id="sp-color-picker">
                                ${colors
                                  .map(
                                    (color) =>
                                      `<div class="color-option ${profile.themeColor === color ? 'selected' : ''}" style="background: ${color};" data-color="${color}"></div>`,
                                  )
                                  .join('')}
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div class="sp-input-group">
                                <label>Seu Cargo principal</label>
                                <input type="text" id="edit-role" class="sp-input" value="${profile.jobTitle ?? ''}">
                            </div>
                            <div class="sp-input-group">
                                <label>Status</label>
                                <div id="edit-status"></div>
                            </div>
                        </div>

                        <div class="sp-input-group">
                            <label>Status / Vibe</label>
                            <input type="text" id="edit-vibe" class="sp-input" value="${profile.vibe ?? ''}" placeholder="Ex: Ouvindo Lo-Fi">
                        </div>

                        <div class="sp-input-group">
                            <label>URL do Banner (Capa do Perfil)</label>
                            <input type="text" id="edit-banner" class="sp-input" value="${profile.bannerUrl ?? ''}" placeholder="https://...">
                        </div>
                        <div class="sp-input-group">
                            <label>Arsenal (Tags/Skills separadas por vírgula)</label>
                            <input type="text" id="edit-stack" class="sp-input" value="${profile.stack.join(', ')}">
                        </div>
                        <div class="sp-input-group">
                            <label>Sobre mim (Bio)</label>
                            <textarea id="edit-bio" class="sp-input" rows="3">${profile.bio ?? ''}</textarea>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: auto;">
                        <button class="btn-secondary" id="btn-cancel-edit">Cancelar</button>
                        <button class="btn-primary" id="btn-save-edit">Salvar Alterações</button>
                    </div>
                </div>
            </div>
        `;
  }

  function apply3DEffect() {
    const wrapper = document.getElementById('sp-left-wrapper');
    const card = document.getElementById('sp-left-card');
    if (!wrapper || !card) return;
    wrapper.addEventListener('mousemove', (e) => {
      const rect = wrapper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -15;
      const rotateY = ((x - centerX) / centerX) * 15;
      card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
    wrapper.addEventListener(
      'mouseleave',
      () => (card.style.transform = `rotateX(0deg) rotateY(0deg)`),
    );
  }

  function attachGridEvents() {
    const modal = container.querySelector('#steam-modal');
    const splitContent = container.querySelector('#steam-content');

    container.querySelectorAll('.dev-card-mini').forEach((card) => {
      card.addEventListener('click', (e) => {
        const member = members.find((item) => item.userId === e.currentTarget.dataset.id);
        if (!member) return;

        splitContent.innerHTML = renderLeftCardHTML(member) + renderRightViewHTML(member);
        attachViewEvents(member, modal, splitContent);

        createIcons({ icons });
        apply3DEffect();
        modal.classList.add('active');
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  function attachViewEvents(member, modal, splitContent) {
    splitContent
      .querySelector('.btn-close-modal')
      .addEventListener('click', () => modal.classList.remove('active'));

    const btnEdit = splitContent.querySelector('#btn-go-edit');

    if (btnEdit) {
      btnEdit.addEventListener('click', () => {
        const rightPanel = splitContent.querySelector('#sp-right-panel');
        rightPanel.outerHTML = renderRightEditHTML(member);
        createIcons({ icons });
        attachEditEvents(member, modal, splitContent);
      });
    }
  }

  function attachEditEvents(member, modal, splitContent) {
    const statusPicker = new Dropdown(splitContent.querySelector('#edit-status'), {
      options: [
        { value: 'AUTO', label: 'Automático' },
        ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
      ],
      value: presence.manual ?? 'AUTO',
    });

    splitContent
      .querySelector('.btn-close-modal')
      .addEventListener('click', () => modal.classList.remove('active'));

    splitContent.querySelector('#btn-cancel-edit').addEventListener('click', () => {
      const rightPanel = splitContent.querySelector('#sp-right-panel');
      rightPanel.outerHTML = renderRightViewHTML(member);
      createIcons({ icons });
      attachViewEvents(member, modal, splitContent);
    });

    let selectedColor = profileOf(member).themeColor;

    splitContent.querySelectorAll('.color-option').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        splitContent
          .querySelectorAll('.color-option')
          .forEach((c) => c.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        selectedColor = e.currentTarget.dataset.color;
        document.getElementById('sp-left-card').style.setProperty('--user-color', selectedColor);
      });
    });

    const saveEditButton = new PendingButton(splitContent.querySelector('#btn-save-edit'));

    splitContent.querySelector('#btn-save-edit').addEventListener('click', () => {
      const jobTitle = splitContent.querySelector('#edit-role').value.trim();
      const bannerUrl = splitContent.querySelector('#edit-banner').value.trim();
      const bio = splitContent.querySelector('#edit-bio').value.trim();
      const vibe = splitContent.querySelector('#edit-vibe').value.trim();
      const chosenStatus = statusPicker.value;

      const payload = {
        themeColor: selectedColor,
        stack: splitContent
          .querySelector('#edit-stack')
          .value.split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      };

      payload.jobTitle = jobTitle || null;
      payload.bannerUrl = bannerUrl || null;
      payload.bio = bio || null;
      payload.vibe = vibe || null;

      void saveEditButton
        .during(async () => {
          try {
            await workspaceApi.updateProfile(payload);
            await presence.choose(chosenStatus);
            await reload();
            modal.classList.remove('active');
          } catch (error) {
            pageFeedback.fail(error);
          }
        })
        .catch(() => undefined);
    });
  }

  workspaceContext.onChange(() => void refresh());

  renderPage();
  void refresh();

  return container;
}
