import { namiApi } from '../api/nami-api.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import '../styles/components/nami.css';

export class NamiChat {
  #element;
  #panel;
  #messages;
  #history;
  #form;
  #feedback;
  #content;
  #status;
  #welcome;
  #settingsCheck = 0;
  #conversation = null;
  #busy = false;
  #opener;

  mount(container, onOpenSettings) {
    this.#element = document.createElement('div');
    this.#element.className = 'nami-widget';
    this.#element.innerHTML = `
      <section id="nami-chat-panel" class="nami-panel" role="dialog" aria-label="Chat da Nami" aria-modal="false" hidden>
        <header class="nami-header"><div><strong>Nami</strong><small>Sua assistente com Gemini</small></div><button type="button" class="btn-secondary" data-close aria-label="Fechar chat da Nami">Fechar</button></header>
        <p class="nami-status" role="status" hidden></p>
        <div class="nami-welcome" hidden>
          <h2>Oi, eu sou a Nami!</h2>
          <p>Para começarmos a conversar, adicione sua chave do Gemini em <button type="button" class="nami-settings-link">Configurações</button>.</p>
        </div>
        <div class="nami-content" hidden>
          <div class="nami-toolbar">
            <button type="button" class="btn-secondary" data-new>Nova conversa</button>
            <button type="button" class="btn-secondary" data-history aria-expanded="false">Histórico</button>
            <button type="button" class="btn-secondary" data-delete disabled>Excluir conversa</button>
          </div>
          <div class="nami-history" aria-label="Conversas anteriores" hidden></div>
          <div class="nami-messages" role="log" aria-label="Mensagens" aria-live="polite"></div>
          <p class="nami-feedback" role="status"></p>
          <form class="nami-compose">
            <label for="nami-message">Mensagem para a Nami</label>
            <textarea id="nami-message" maxlength="8000" rows="3" required placeholder="Escreva sua dúvida…"></textarea>
            <button type="submit" class="btn-primary">Enviar</button>
            <small>As mensagens são enviadas ao Google Gemini. A Nami pode cometer erros.</small>
          </form>
        </div>
      </section>`;
    container.append(this.#element);
    const query = selector => this.#element.querySelector(selector);
    this.#panel = query('.nami-panel');
    this.#messages = query('.nami-messages');
    this.#history = query('.nami-history');
    this.#form = query('form');
    this.#feedback = query('.nami-feedback');
    this.#content = query('.nami-content');
    this.#status = query('.nami-status');
    this.#welcome = query('.nami-welcome');
    query('.nami-settings-link').addEventListener('click', onOpenSettings);
    query('[data-close]').addEventListener('click', () => this.close());
    query('[data-new]').addEventListener('click', () => {
      if (this.#busy) return;
      this.#conversation = null;
      this.#renderMessages([]);
      this.#feedback.textContent = '';
      this.#form.reset();
      this.#form.querySelector('textarea').focus();
    });
    query('[data-history]').addEventListener('click', () => {
      this.#history.hidden = !this.#history.hidden;
      query('[data-history]').setAttribute('aria-expanded', String(!this.#history.hidden));
      if (!this.#history.hidden) void this.#loadHistory();
    });
    query('[data-delete]').addEventListener('click', () => void this.#delete());
    this.#form.addEventListener('submit', event => { event.preventDefault(); void this.#send(); });
    this.#panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); }
    });
    container.addEventListener('click', event => {
      const mascot = event.target.closest('.mascot-container');
      if (mascot) {
        this.#opener = mascot;
        if (this.#panel.hidden) void this.open();
        else this.close();
      }
    });
    document.addEventListener('nami-settings-changed', event => {
      if (this.#panel.hidden) return;
      this.#settingsCheck++;
      this.#showAvailability(event.detail.configured);
    });
    this.#renderMessages([]);
  }

  #showAvailability(configured, message = '') {
    this.#content.hidden = !configured;
    this.#welcome.hidden = configured || Boolean(message);
    this.#status.hidden = configured || !message;
    this.#status.textContent = message;
  }

  async open() {
    const check = ++this.#settingsCheck;
    this.#panel.hidden = false;
    this.#opener?.setAttribute('aria-expanded', 'true');
    this.#showAvailability(false, 'Verificando a configuração da Nami…');
    const close = this.#panel.querySelector('[data-close]');
    close.focus();
    try {
      const { configured } = await namiApi.settings();
      if (check !== this.#settingsCheck) return;
      this.#showAvailability(configured);
      if (configured && !this.#busy && document.activeElement === close) {
        this.#form.querySelector('textarea').focus();
      }
    } catch {
      if (check === this.#settingsCheck) {
        this.#showAvailability(false, 'Não foi possível verificar a configuração da Nami. Feche o chat e tente novamente.');
      }
    }
  }

  close() {
    this.#settingsCheck++;
    this.#panel.hidden = true;
    this.#opener?.setAttribute('aria-expanded', 'false');
    this.#opener?.focus();
  }

  #pending(value) {
    this.#busy = value;
    this.#panel.setAttribute('aria-busy', String(value));
    for (const button of this.#panel.querySelectorAll('.nami-toolbar button, .nami-history button, .nami-compose button')) button.disabled = value;
    this.#element.querySelector('[data-delete]').disabled = value || !this.#conversation;
    this.#form.querySelector('textarea').disabled = value;
  }

  #renderMessages(messages) {
    this.#messages.replaceChildren();
    if (!messages.length) {
      const welcome = document.createElement('p');
      welcome.textContent = 'Olá! Sou a Nami. Posso ajudar com programação e organização do trabalho. Como posso ajudar?';
      this.#messages.append(welcome);
    }
    for (const message of messages) {
      const article = document.createElement('article');
      article.className = `nami-message ${message.role === 'user' ? 'nami-user' : 'nami-assistant'}`;
      const label = document.createElement('strong');
      label.textContent = message.role === 'user' ? 'Você' : 'Nami';
      const body = document.createElement('div');
      body.textContent = message.content;
      article.append(label, body);
      this.#messages.append(article);
    }
    this.#element.querySelector('[data-delete]').disabled = this.#busy || !this.#conversation;
    this.#messages.scrollTop = this.#messages.scrollHeight;
  }

  async #send() {
    const input = this.#form.querySelector('textarea');
    const message = input.value.trim();
    if (this.#busy || this.#content.hidden || !message) return;
    this.#pending(true);
    this.#feedback.textContent = 'Nami está pensando…';
    try {
      const result = await namiApi.send({ message, ...(this.#conversation ? { conversationId: this.#conversation.id } : {}) });
      this.#conversation = result;
      this.#renderMessages(result.messages);
      input.value = '';
      this.#feedback.textContent = '';
      if (!this.#history.hidden) await this.#loadHistory();
    } catch (error) { this.#feedback.textContent = error.message; }
    finally { this.#pending(false); if (!this.#panel.hidden) input.focus(); }
  }

  async #loadHistory() {
    this.#history.textContent = 'Carregando conversas…';
    try {
      const conversations = await namiApi.list();
      this.#history.replaceChildren();
      if (!conversations.length) this.#history.textContent = 'Você ainda não tem conversas salvas.';
      for (const conversation of conversations) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-secondary';
        button.textContent = conversation.title;
        button.disabled = this.#busy;
        button.addEventListener('click', () => void this.#loadConversation(conversation.id));
        this.#history.append(button);
      }
    } catch (error) { this.#history.textContent = error.message; }
  }

  async #loadConversation(id) {
    if (this.#busy) return;
    this.#pending(true);
    try {
      const conversation = await namiApi.conversation(id);
      this.#conversation = conversation;
      this.#renderMessages(conversation.messages);
      this.#form.reset();
      this.#feedback.textContent = '';
    } catch (error) { this.#feedback.textContent = error.message; }
    finally { this.#pending(false); }
  }

  async #delete() {
    if (this.#busy || !this.#conversation) return;
    this.#pending(true);
    try {
      const confirmed = await confirmDialog.ask({ title: 'Excluir conversa', message: 'O histórico desta conversa será excluído permanentemente.', confirmLabel: 'Excluir', danger: true });
      if (!confirmed) return;
      await namiApi.remove(this.#conversation.id);
      this.#conversation = null;
      this.#renderMessages([]);
      this.#feedback.textContent = 'Conversa excluída.';
      if (!this.#history.hidden) await this.#loadHistory();
    } catch (error) { this.#feedback.textContent = error.message; }
    finally { this.#pending(false); }
  }
}
