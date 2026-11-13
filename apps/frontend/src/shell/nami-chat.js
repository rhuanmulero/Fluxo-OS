import { createFromNami, findNamiItems, prepareNamiEdit } from './nami-create.js';
import { NavigationTooltip } from './navigation-tooltip.js';
import { includesProjectContext } from '../core/nami-project-preference.js';
import { workspaceContext } from '../core/workspace-context.js';
import { createIcons, icons } from 'lucide';
import { renderNamiMarkdown } from './nami-markdown.js';
import { namiApi } from '../api/nami-api.js';
import '../styles/components/nami.css';

const blockingPanels = [
  '.task-drawer.active', '.custom-modal.active', '.settings-overlay.active',
  '.confirm-overlay.active', '.modal-overlay.active', '.steam-profile-modal.active',
  'dialog[open]',
].join(', ');

export class NamiChat {
  #element;
  #tooltip;
  #panel;
  #messages;
  #history;
  #form;
  #feedback;
  #content;
  #status;
  #welcome;
  #settingsCheck = 0;
  #opening = false;
  #conversation = null;
  #creation = null;
  #busy = false;
  #opener;

  mount(container, onOpenSettings) {
    this.#element = document.createElement('div');
    this.#element.className = 'nami-widget';
    this.#element.innerHTML = `
        <button type="button" id="mascot" class="mascot-container" data-label="Conversar com a Nami" aria-label="Conversar com a Nami" aria-expanded="false" aria-controls="nami-chat-panel">
            <svg class="cat-pixel-art" viewBox="0 0 16 16" width="32" height="32" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M2 3h2v1h1v1h6V4h1V3h2v4h1v6h-1v2H2v-2H1V7h1V3z"/>
                <rect class="cat-eye" x="4" y="8" width="2" height="1"/>
                <rect class="cat-eye" x="10" y="8" width="2" height="1"/>
                <rect fill="#FF8A8A" x="7" y="10" width="2" height="1"/>
            </svg>
        </button>
      <section id="nami-chat-panel" class="nami-panel" role="dialog" aria-label="Chat da Nami" aria-modal="false" hidden>
        <header class="nami-header">
          <div class="nami-header-label"><strong data-title>Nami</strong><small data-subtitle>Sua assistente com Gemini</small></div>
          <div class="nami-header-actions">
            <button type="button" class="btn-icon-small" data-new aria-label="Nova conversa" data-label="Nova conversa" hidden><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>
            <button type="button" class="btn-icon-small" data-history aria-label="Histórico" data-label="Histórico" hidden><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></button>
            <button type="button" class="btn-icon-small" data-back aria-label="Voltar ao chat" data-label="Voltar ao chat" hidden><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m12 19-7-7 7-7M5 12h14"/></svg></button>
            <button type="button" class="btn-icon-small nami-expand" data-expand aria-label="Tela cheia" aria-pressed="false" data-label="Expandir chat">
              <svg class="nami-expand-icon" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/></svg>
              <svg class="nami-restore-icon" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h4V4m12 4h-4V4M4 16h4v4m12-4h-4v4"/></svg>
            </button>
            <button type="button" class="btn-icon-small" data-close aria-label="Fechar chat da Nami" data-label="Fechar"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m18 6-12 12M6 6l12 12"/></svg></button>
          </div>
        </header>
        <p class="nami-status" role="status" hidden></p>
        <div class="nami-welcome" hidden>
          <h2>Oi, eu sou a Nami!</h2>
          <p>Para começarmos a conversar, adicione sua chave do Gemini em <button type="button" class="nami-settings-link">Configurações</button>.</p>
        </div>
        <aside class="nami-sidebar" aria-label="Histórico da Nami" hidden>
          <div class="nami-sidebar-header">
            <button type="button" class="btn-secondary" data-sidebar-new>+ Nova conversa</button>
            <strong>Histórico</strong>
          </div>
          <div class="nami-history" aria-label="Conversas anteriores"></div>
        </aside>
        <div class="nami-content" hidden>
          <div class="nami-messages" role="log" aria-label="Mensagens" aria-live="polite"></div>
          <p class="nami-feedback" role="status"></p>
          <form class="nami-compose">
            <h2 class="nami-start-title" hidden>No que vamos trabalhar?</h2>
            <div class="nami-composer">
              <textarea id="nami-message" aria-label="Mensagem para a Nami" maxlength="8000" rows="1" required placeholder="Escreva sua dúvida…"></textarea>
              <button type="submit" class="nami-send" aria-label="Enviar" data-label="Enviar">
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>
              </button>
            </div>
            <small>As mensagens são enviadas ao Google Gemini. A Nami pode cometer erros.</small>
          </form>
        </div>
      </section>`;
    container.append(this.#element);
    const tooltip = this.#tooltip = new NavigationTooltip();
    tooltip.mount(this.#element);
    const targetFor = event => event.target.closest('[data-label]');
    this.#element.addEventListener('pointerover', event => {
      if (event.pointerType === 'touch') return;
      const target = targetFor(event);
      if (!target || target.contains(event.relatedTarget)) return;
      if (target.matches('[data-subtitle], .nami-history-title, .nami-history-delete-title')
          && target.scrollWidth <= target.clientWidth) return;
      const edge = target.closest('.nami-header') ? 'top' : 'bottom';
      tooltip.show(target, edge);
    });
    this.#element.addEventListener('pointerout', event => {
      const target = targetFor(event);
      if (target && !target.contains(event.relatedTarget)) tooltip.hide();
    });
    this.#element.addEventListener('click', () => tooltip.hide(), { capture: true });
    this.#element.addEventListener('scroll', () => tooltip.hide(), { capture: true });
    const query = selector => this.#element.querySelector(selector);
    this.#panel = query('.nami-panel');
    this.#messages = query('.nami-messages');
    this.#history = query('.nami-history');
    this.#form = query('form');
    this.#feedback = query('.nami-feedback');
    this.#content = query('.nami-content');
    this.#status = query('.nami-status');
    this.#welcome = query('.nami-welcome');
    const mascotButton = query('.mascot-container');
    const syncPanels = () => {
      const blocked = [...document.querySelectorAll(blockingPanels)]
        .some(panel => panel.getClientRects().length > 0);
      if (blocked) this.close({ restoreFocus: false });
      if (mascotButton.hidden !== blocked) mascotButton.hidden = blocked;
    };
    new MutationObserver(syncPanels).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'open', 'hidden', 'style'],
    });
    query('.nami-settings-link').addEventListener('click', onOpenSettings);
    const expandButton = query('[data-expand]');
    expandButton.addEventListener('click', () => {
      const expanded = this.#panel.classList.toggle('nami-fullscreen');
      expandButton.setAttribute('aria-pressed', String(expanded));
      expandButton.dataset.label = expanded ? 'Voltar ao tamanho normal' : 'Expandir chat';
      if (this.#welcome.hidden && this.#status.hidden) {
        this.#showView('chat');
        if (expanded) void this.#loadHistory();
      }
    });
    query('[data-close]').addEventListener('click', () => this.close());
    const newConversation = () => {
      if (this.#busy) return;
      this.#conversation = null;
      this.#creation = null;
      this.#history.querySelector('[aria-current]')?.removeAttribute('aria-current');
      this.#renderMessages([]);
      this.#feedback.textContent = '';
      this.#form.reset();
      this.#form.querySelector('textarea').focus();
    };
    query('[data-new]').addEventListener('click', newConversation);
    query('[data-sidebar-new]').addEventListener('click', newConversation);
    query('[data-history]').addEventListener('click', async () => {
      const check = this.#settingsCheck;
      this.#pending(true);
      try {
        await this.#loadHistory();
        if (check !== this.#settingsCheck || this.#panel.hidden) return;
        this.#showView('history');
      } finally {
        this.#pending(false);
      }
      query('[data-back]').focus();
    });
    query('[data-back]').addEventListener('click', () => {
      this.#showView('chat');
      this.#form.querySelector('textarea').focus();
    });
    this.#form.addEventListener('submit', event => { event.preventDefault(); void this.#send(); });
    this.#form.querySelector('textarea').addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      if (!event.repeat && !this.#busy && event.target.value.trim()) this.#form.requestSubmit();
    });
    this.#panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); }
    });
    container.addEventListener('click', event => {
      const mascot = event.target.closest('.mascot-container');
      if (mascot) {
        this.#opener = mascot;
        if (this.#panel.hidden && !this.#opening) void this.open();
        else this.close();
      }
    });
    document.addEventListener('click', event => {
      if (this.#panel.contains(event.target) || mascotButton.contains(event.target)) return;
      this.close({ restoreFocus: false });
    }, { capture: true });
    document.addEventListener('nami-settings-changed', event => {
      if (this.#panel.hidden) return;
      this.#settingsCheck++;
      this.#showAvailability(event.detail.configured);
      if (this.#panel.classList.contains('nami-with-sidebar')) void this.#loadHistory();
    });
    this.#renderMessages([]);
  }

  #showAvailability(configured, message = '') {
    this.#showView(configured ? 'chat' : 'unavailable');
    this.#welcome.hidden = configured || Boolean(message);
    this.#status.hidden = configured || !message;
    this.#status.textContent = message;
  }

  #showView(view) {
    const history = view === 'history';
    const chat = view === 'chat';
    const sidebar = chat && this.#panel.classList.contains('nami-fullscreen');
    this.#panel.classList.toggle('nami-with-sidebar', sidebar);
    this.#history.parentElement.hidden = !history && !sidebar;
    this.#content.hidden = !chat;
    this.#panel.querySelector('[data-title]').textContent = history ? 'Histórico' : 'Nami';
    this.#panel.querySelector('[data-subtitle]').hidden = history;
    this.#panel.querySelector('[data-new]').hidden = !chat || sidebar;
    this.#panel.querySelector('[data-history]').hidden = !chat || sidebar;
    this.#panel.querySelector('[data-back]').hidden = !history;
  }

  async open() {
    const check = ++this.#settingsCheck;
    this.#opening = true;
    let configured = false;
    let message = '';
    try {
      ({ configured } = await namiApi.settings());
    } catch {
      message = 'Não foi possível verificar a configuração da Nami. Feche o chat e tente novamente.';
    }
    if (check !== this.#settingsCheck) return;
    this.#opening = false;
    this.#showAvailability(configured, message);
    if (configured && this.#panel.classList.contains('nami-with-sidebar')) void this.#loadHistory();
    this.#panel.hidden = false;
    this.#renderCreation();
    this.#opener?.setAttribute('aria-expanded', 'true');
    const focusTarget = configured && !this.#busy ? 'textarea' : '[data-close]';
    this.#panel.querySelector(focusTarget).focus();
  }

  close({ restoreFocus = true } = {}) {
    if (this.#panel.hidden && !this.#opening) return;
    this.#tooltip.hide();
    this.#settingsCheck++;
    this.#opening = false;
    this.#panel.hidden = true;
    this.#opener?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) this.#opener?.focus();
  }

  #pending(value) {
    this.#busy = value;
    this.#panel.setAttribute('aria-busy', String(value));
    for (const button of this.#panel.querySelectorAll('[data-new], [data-sidebar-new], [data-history], [data-back], .nami-history button, .nami-compose button')) button.disabled = value;
    for (const field of this.#form.querySelectorAll('textarea, input')) field.disabled = value;
  }

  #syncConversationTitle() {
    const subtitle = this.#panel.querySelector('[data-subtitle]');
    const title = this.#conversation?.title;
    subtitle.textContent = title || 'Sua assistente com Gemini';
    subtitle.dataset.label = title || '';
  }

  #renderMessages(messages) {
    this.#syncConversationTitle();
    this.#messages.replaceChildren();
    const empty = messages.length === 0;
    this.#content.classList.toggle('nami-empty-chat', empty);
    this.#messages.hidden = empty;
    this.#form.querySelector('.nami-start-title').hidden = !empty;
    for (const message of messages) {
      const article = document.createElement('article');
      article.className = `nami-message ${message.role === 'user' ? 'nami-user' : 'nami-assistant'}`;
      const label = document.createElement('strong');
      label.textContent = message.role === 'user' ? 'Você' : 'Nami';
      const body = document.createElement('div');
      if (message.role === 'model') {
        body.className = 'nami-markdown';
        renderNamiMarkdown(body, message.content);
      } else {
        body.textContent = message.content;
      }
      article.append(label, body);
      this.#messages.append(article);
    }
    this.#messages.scrollTop = this.#messages.scrollHeight;
  }

  #typingBubble() {
    const bubble = document.createElement('article');
    bubble.className = 'nami-message nami-assistant nami-typing';
    bubble.setAttribute('aria-label', 'Nami está digitando');
    bubble.innerHTML = '<strong>Nami</strong><div class="nami-typing-dots" aria-hidden="true"><span></span><span></span><span></span></div>';
    this.#messages.append(bubble);
    this.#messages.scrollTop = this.#messages.scrollHeight;
  }

  async #revealReply(messages) {
    this.#renderMessages(messages);
    const reply = this.#messages.lastElementChild?.querySelector('.nami-markdown');
    if (!reply || this.#panel.hidden) return;

    const walker = document.createTreeWalker(reply, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const steps = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType === Node.ELEMENT_NODE) {
        node.hidden = true;
        steps.push({ node });
      } else {
        for (const word of node.data.match(/\S+\s*|\s+/g) ?? []) steps.push({ node, word });
        node.data = '';
      }
    }

    reply.setAttribute('aria-busy', 'true');
    for (let index = 0; index < steps.length;) {
      const atBottom = this.#messages.scrollHeight - this.#messages.scrollTop - this.#messages.clientHeight < 24;
      while (index < steps.length) {
        const { node, word } = steps[index++];
        if (word === undefined) {
          node.hidden = false;
        } else {
          node.appendData(word);
          if (!this.#panel.hidden && word.trim()) break;
        }
      }
      if (atBottom) this.#messages.scrollTop = this.#messages.scrollHeight;
      if (index < steps.length) await new Promise(resolve => setTimeout(resolve, 65));
    }
    reply.removeAttribute('aria-busy');
  }

  #renderLookup(pending) {
    const box = document.createElement('section');
    box.className = 'nami-message nami-assistant nami-creation';
    this.#messages.append(box);
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = 'Consultando o Fluxo…';
    box.append(status);
    const display = item => {
      const name = item.item.title ?? item.item.name;
      const details = [item.parent, item.item.status, item.item.priority, item.item.dueDate?.slice(0, 10)].filter(Boolean);
      return details.length ? name + ' · ' + details.join(' · ') : name;
    };
    void (async () => {
      try {
        const options = await findNamiItems(pending.proposal.data, pending.scope);
        if (!box.isConnected) return;
        const editing = pending.proposal.kind === 'edit';
        const reorderColumns = editing && pending.proposal.data.resource === 'column' && pending.proposal.data.changes.order;
        if (!options.length && !reorderColumns) {
          status.textContent = 'Não encontrei esse item entre os registros disponíveis em ' +
            (pending.scope.projectName || pending.scope.workspaceName || 'seus espaços') + '.';
          return;
        }
        const showEdit = async selected => {
          box.replaceChildren(status);
          status.textContent = 'Preparando a revisão…';
          try {
            const edit = await prepareNamiEdit(pending.proposal, pending.scope, selected);
            if (!box.isConnected || this.#creation !== pending) return;
            pending.edit = edit;
            pending.selected = selected.item.title ?? selected.item.name;
            this.#renderCreation();
          } catch (error) { status.textContent = error.message; }
        };
        if (reorderColumns) {
          await showEdit({ item: { name: 'Ordem das colunas' } });
          return;
        }
        status.textContent = editing ? 'Selecione o item que deseja editar.' :
          options.length + (options.length === 1 ? ' item encontrado.' : ' itens encontrados.');
        const list = document.createElement('ul');
        for (const option of options.slice(0, 20)) {
          const row = document.createElement('li');
          if (editing) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn-secondary';
            button.textContent = display(option);
            button.addEventListener('click', () => void showEdit(option));
            row.append(button);
          } else row.textContent = display(option);
          list.append(row);
        }
        box.append(list);
        if (options.length > 20) box.append('Refine a busca para ver os outros resultados.');
        this.#messages.scrollTop = this.#messages.scrollHeight;
      } catch (error) { status.textContent = error.message; }
    })();
  }

  #renderCreation() {
    this.#messages.querySelector('.nami-creation')?.remove();
    const pending = this.#creation;
    if (!pending || pending.conversationId !== this.#conversation?.id) return;
    const { proposal, scope } = pending;
    if (proposal.kind === 'lookup' || (proposal.kind === 'edit' && !pending.edit)) {
      this.#renderLookup(pending);
      return;
    }
    const box = document.createElement('section');
    box.className = 'nami-message nami-assistant nami-creation';
    const title = document.createElement('strong');
    const destination = ['workspace', 'project', 'invite'].includes(proposal.kind) ||
      (['bookmark', 'document'].includes(proposal.kind) && proposal.data.scope !== 'PROJECT')
      ? scope.workspaceName : scope.projectName || scope.workspaceName;
    title.textContent = proposal.label + (pending.selected ? ': ' + pending.selected : '') + (proposal.kind !== 'workspace' && destination ? ' · ' + destination : '');
    const labels = {
      participantNames: 'Participantes', order: 'Ordem', logDate: 'Data do registro', logValue: 'Conclusões', logNote: 'Nota do registro',
      assigneeName: 'Responsável', columnName: 'Coluna', visibility: 'Visibilidade', archived: 'Arquivado',
      title: 'Título', name: 'Nome', description: 'Descrição', shortDescription: 'Resumo',
      priority: 'Prioridade', type: 'Tipo', status: 'Status', dueDate: 'Prazo',
      folder: 'Pasta', tags: 'Etiquetas', estimatedHours: 'Horas estimadas',
      recurrence: 'Recorrência', color: 'Cor', goal: 'Meta', points: 'Pontos',
      body: 'Conteúdo', startsAt: 'Início', endsAt: 'Fim', allDay: 'Dia inteiro',
      frequency: 'Frequência', targetPerPeriod: 'Meta por período', url: 'Endereço',
      scope: 'Visibilidade', language: 'Linguagem', code: 'Código', role: 'Papel',
      email: 'E-mail', mode: 'Modo', startedAt: 'Início', endedAt: 'Fim',
      durationMinutes: 'Duração em minutos', isPinned: 'Fixado', column: 'Coluna', roadmap: 'Roadmap',
    };
    const values = {
      LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', FEATURE: 'Funcionalidade', BUG: 'Bug',
      DESIGN: 'Design', REFACTOR: 'Refatoração', OTHER: 'Outro', TODO: 'A fazer',
      IN_PROGRESS: 'Em progresso', DONE: 'Concluído', PLANNED: 'Planejado',
      PRIVATE: 'Privado', PROJECT: 'Projeto', WORKSPACE: 'Workspace',
      NONE: 'Nenhuma', DAILY: 'Diária', WEEKLY: 'Semanal', MONTHLY: 'Mensal',
      SUPERADMIN: 'Superadmin', ADMIN: 'Admin', MEMBER: 'Membro',
      FOCUS: 'Foco', SHORT_BREAK: 'Pausa curta', LONG_BREAK: 'Pausa longa',
    };
    const enumFields = new Set(['priority', 'type', 'status', 'scope', 'frequency', 'recurrence', 'role', 'mode']);
    const details = document.createElement('dl');
    details.className = 'nami-creation-details';
    const fields = pending.edit ? pending.edit.after : {
      ...(proposal.kind === 'renameTask'
        ? { 'Título atual': proposal.data.title, 'Novo título': proposal.data.newTitle }
        : proposal.data),
      ...(proposal.kind === 'assignSelf' ? { 'Responsável': 'Você' } : {}),
      ...(proposal.columnName ? { column: proposal.columnName } : {}),
      ...(proposal.roadmapTitle ? { roadmap: proposal.roadmapTitle } : {}),
    };
    for (const [field, value] of Object.entries(fields)) {
      if (!pending.edit && (value === null || value === '')) continue;
      const row = document.createElement('div');
      const label = document.createElement('dt');
      const description = document.createElement('dd');
      label.textContent = labels[field] ?? field;
      description.textContent = typeof value === 'boolean' ? (value ? 'Sim' : 'Não')
        : Array.isArray(value) ? value.join(', ')
        : enumFields.has(field) ? (values[value] ?? String(value)) : String(value);
      if (pending.edit) {
        const prior = pending.edit.before[field];
        description.textContent = (prior == null || prior === '' ? 'Não definido' : String(values[prior] ?? prior))
          + ' → ' + (description.textContent || 'Em branco');
      }
      row.append(label, description);
      details.append(row);
    }
    const actions = document.createElement('div');
    actions.className = 'settings-row nami-creation-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn-secondary';
    cancel.textContent = 'Cancelar';
    const confirm = document.createElement('button');
    confirm.className = 'btn-primary';
    confirm.textContent = pending.edit ? 'Confirmar edição' : proposal.kind === 'assignSelf' ? 'Confirmar atribuição' : proposal.kind === 'renameTask' ? 'Confirmar novo título' : 'Confirmar criação';
    const feedback = document.createElement('p');
    feedback.setAttribute('role', 'status');
    const file = document.createElement('input');
    file.type = 'file';
    file.setAttribute('aria-label', 'Arquivo do documento');
    box.append(title, details);
    if (proposal.kind === 'document') {
      confirm.disabled = true;
      file.addEventListener('change', () => { confirm.disabled = !file.files.length; });
      box.append(file);
    }
    actions.append(cancel, confirm);
    box.append(actions, feedback);
    this.#messages.append(box);
    this.#messages.scrollTop = this.#messages.scrollHeight;
    cancel.addEventListener('click', () => {
      this.#creation = null;
      box.remove();
    });
    confirm.addEventListener('click', async () => {
      if (this.#busy || confirm.disabled || this.#creation !== pending) return;
      this.#pending(true);
      confirm.disabled = cancel.disabled = file.disabled = true;
      try {
        await (pending.edit ? pending.edit.save() : createFromNami(proposal, scope, file.files[0]));
        this.#creation = null;
        box.replaceChildren();
        const result = document.createElement('p');
        result.textContent = pending.edit ? 'Alteração salva com sucesso.' : proposal.kind === 'assignSelf' ? 'Demanda atribuída a você.' : proposal.kind === 'renameTask' ? 'Demanda renomeada com sucesso.' : proposal.label + ' salvo com sucesso.';
        box.append(result);
        if (proposal.kind !== 'workspace') {
          void workspaceContext.reload().catch(() => {
            result.textContent += ' Atualize a página para ver a mudança.';
          });
        }
      } catch (error) {
        feedback.textContent = error.message;
        confirm.disabled = cancel.disabled = file.disabled = false;
      } finally {
        this.#pending(false);
      }
    });
  }

  async #send() {
    const input = this.#form.querySelector('textarea');
    const message = input.value.trim();
    if (this.#busy || this.#content.hidden || !message) return;
    const draft = input.value;
    const scope = {
      workspaceId: workspaceContext.workspaceId,
      workspaceName: workspaceContext.workspaceName,
      projectId: workspaceContext.projectId,
      projectName: workspaceContext.project?.name,
    };
    const previousMessages = this.#conversation?.messages ?? [];
    this.#pending(true);
    input.value = '';
    this.#renderMessages([...previousMessages, { role: 'user', content: message }]);
    this.#feedback.textContent = '';
    this.#typingBubble();
    try {
      const projectId = includesProjectContext(workspaceContext.projectId) ? workspaceContext.projectId : null;
      const result = await namiApi.send({
        message,
        ...(this.#conversation ? { conversationId: this.#conversation.id } : {}),
        ...(projectId ? { projectId } : {}),
      });
      this.#conversation = result;
      this.#creation = result.creation ? { proposal: result.creation, scope, conversationId: result.id } : null;
      if (this.#panel.classList.contains('nami-with-sidebar')) void this.#loadHistory();
      await this.#revealReply(result.messages);
      this.#renderCreation();
      this.#feedback.textContent = '';
    } catch (error) {
      this.#renderMessages(previousMessages);
      input.value = draft;
      this.#feedback.textContent = error.message;
    }
    finally { this.#pending(false); if (!this.#panel.hidden) input.focus(); }
  }

  async #loadHistory() {
    try {
      const conversations = await namiApi.list();
      const rows = document.createDocumentFragment();
      if (!conversations.length) {
        const empty = document.createElement('p');
        empty.className = 'nami-history-empty';
        empty.textContent = 'Você ainda não tem conversas salvas.';
        rows.append(empty);
      }
      for (const conversation of conversations) {
        const row = document.createElement('div');
        row.className = 'nami-history-row';
        const title = document.createElement('button');
        title.type = 'button';
        title.className = 'btn-secondary nami-history-title';
        title.textContent = conversation.title;
        title.dataset.label = conversation.title;
        if (this.#conversation?.id === conversation.id) title.setAttribute('aria-current', 'true');
        title.addEventListener('click', () => void this.#loadConversation(conversation.id, title));
        const pin = this.#historyAction('pin', conversation.pinned ? 'Desafixar conversa' : 'Fixar conversa', () => {
          void this.#changeHistory(row, () => namiApi.update(conversation.id, { pinned: !conversation.pinned }));
        });
        pin.setAttribute('aria-pressed', String(Boolean(conversation.pinned)));
        const rename = this.#historyAction('pencil', 'Renomear conversa', () => {
          this.#editHistoryRow(row, conversation, false);
        });
        const remove = this.#historyAction('trash-2', 'Excluir conversa', () => {
          this.#editHistoryRow(row, conversation, true);
        });
        row.append(title, pin, rename, remove);
        rows.append(row);
      }
      createIcons({ icons, root: rows });
      this.#history.replaceChildren(rows);
    } catch (error) { this.#history.textContent = error.message; }
  }

  #historyAction(icon, label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-icon-small';
    button.dataset.label = label;
    button.setAttribute('aria-label', label);
    const glyph = document.createElement('i');
    glyph.dataset.lucide = icon;
    button.append(glyph);
    button.addEventListener('click', action);
    return button;
  }

  #editHistoryRow(row, conversation, deleting) {
    const form = document.createElement('form');
    form.className = 'nami-history-edit';
    const input = document.createElement('input');
    input.className = 'settings-input';
    input.setAttribute('aria-label', 'Nome da conversa');
    input.value = conversation.title;
    input.maxLength = 80;
    input.required = true;
    const prompt = document.createElement('p');
    prompt.className = 'nami-history-delete-title';
    prompt.textContent = conversation.title;
    prompt.dataset.label = conversation.title;
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-secondary';
    cancel.textContent = 'Cancelar';
    cancel.addEventListener('click', () => {
      form.replaceWith(row);
      row.querySelector(deleting ? '[aria-label="Excluir conversa"]' : '[aria-label="Renomear conversa"]').focus();
    });
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn-primary';
    submit.textContent = deleting ? 'Excluir' : 'Salvar';
    if (deleting) submit.dataset.label = 'Excluir permanentemente';
    form.append(deleting ? prompt : input, cancel, submit);
    row.replaceWith(form);
    (deleting ? cancel : input).focus();
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!deleting && !input.value.trim()) return;
      void this.#changeHistory(form, async () => {
        if (deleting) {
          await namiApi.remove(conversation.id);
          if (this.#conversation?.id === conversation.id) {
            this.#conversation = null;
            this.#form.reset();
            this.#feedback.textContent = '';
            this.#renderMessages([]);
          }
        } else {
          const title = input.value.trim();
          await namiApi.update(conversation.id, { title });
          if (this.#conversation?.id === conversation.id) {
            this.#conversation.title = title;
            this.#syncConversationTitle();
          }
        }
      });
    });
  }

  async #changeHistory(row, action) {
    if (this.#busy) return;
    this.#pending(true);
    try {
      await action();
      await this.#loadHistory();
    } catch (error) {
      row.querySelector('.nami-history-error')?.remove();
      const feedback = document.createElement('p');
      feedback.className = 'nami-history-error';
      feedback.setAttribute('role', 'alert');
      feedback.textContent = error.message;
      row.append(feedback);
    } finally {
      this.#pending(false);
    }
  }

  async #loadConversation(id, title) {
    if (this.#busy) return;
    this.#pending(true);
    try {
      const conversation = await namiApi.conversation(id);
      this.#conversation = conversation;
      this.#history.querySelector('[aria-current]')?.removeAttribute('aria-current');
      title.setAttribute('aria-current', 'true');
      this.#renderMessages(conversation.messages);
      this.#renderCreation();
      this.#form.reset();
      this.#feedback.textContent = '';
      this.#showView('chat');
    } catch (error) {
      this.#history.textContent = error.message;
    } finally {
      this.#pending(false);
      if (!this.#panel.hidden && !this.#content.hidden) this.#form.querySelector('textarea').focus();
    }
  }
}
