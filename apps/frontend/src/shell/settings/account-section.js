import { session } from '../../core/session-store.js';
import { PendingButton } from '../../components/pending-button.js';
import { confirmDialog } from '../../components/confirm-dialog.js';

const MIN_PASSWORD = 8;

export class AccountSection {
  id = 'account';
  icon = 'user-cog';
  label = 'Conta';

  render(content) {
    const user = session.user;

    content.innerHTML = `
      <h3>Nome exibido</h3>
      <div class="settings-row">
        <input type="text" id="account-name" class="settings-input settings-row-grow"
               value="${user?.name ?? ''}" minlength="2" maxlength="80" autocomplete="name">
        <button class="btn-primary" id="btn-save-account-name">Salvar</button>
      </div>

      <h3>E-mail de acesso</h3>
      <div class="settings-row">
        <input type="email" id="account-email" class="settings-input settings-row-grow"
               value="${user?.email ?? ''}" readonly disabled>
      </div>
      <p class="settings-hint">É com este e-mail que você entra no Fluxo. Para trocá-lo, fale com o suporte.</p>

      <h3>Senha</h3>
      <div class="settings-row">
        <input type="password" id="account-current-password" class="settings-input settings-row-grow"
               placeholder="Senha atual" autocomplete="current-password">
      </div>
      <div class="settings-row" style="margin-top: 8px;">
        <input type="password" id="account-new-password" class="settings-input settings-row-grow"
               placeholder="Nova senha" minlength="${MIN_PASSWORD}" autocomplete="new-password">
        <button class="btn-primary" id="btn-save-account-password">Trocar</button>
      </div>
      <p class="settings-hint">Trocar a senha encerra as outras sessões automaticamente.</p>

      <h3>Sessões</h3>
      <div class="settings-danger">
        <button class="btn-secondary" id="btn-revoke-sessions">Encerrar sessões nos outros dispositivos</button>
      </div>

      <p class="settings-error" id="account-feedback"></p>
    `;

    this.#bind(content);
  }

  #bind(content) {
    const feedback = content.querySelector('#account-feedback');
    const say = (message) => {
      feedback.textContent = message;
    };

    this.#wire(content, '#btn-save-account-name', say, async () => {
      const name = content.querySelector('#account-name').value.trim();

      if (name.length < 2) {
        throw new Error('Informe um nome com ao menos 2 caracteres.');
      }

      await session.updateName(name);

      return 'Nome atualizado.';
    });

    this.#wire(content, '#btn-save-account-password', say, async () => {
      const current = content.querySelector('#account-current-password');
      const next = content.querySelector('#account-new-password');

      if (next.value.length < MIN_PASSWORD) {
        throw new Error(`A senha deve ter ao menos ${MIN_PASSWORD} caracteres.`);
      }

      await session.changePassword(current.value, next.value);

      current.value = '';
      next.value = '';

      return 'Senha trocada.';
    });

    this.#wire(content, '#btn-revoke-sessions', say, async () => {
      const confirmed = await confirmDialog.ask({
        title: 'Encerrar outras sessões',
        message: 'Você continua conectado aqui. Nos outros navegadores e dispositivos será preciso entrar de novo.',
        confirmLabel: 'Encerrar',
        danger: true,
      });

      if (!confirmed) {
        return '';
      }

      await session.revokeOtherSessions();

      return 'Outras sessões encerradas.';
    });
  }

  #wire(content, selector, say, action) {
    const trigger = content.querySelector(selector);
    const button = new PendingButton(trigger);

    trigger.addEventListener('click', () => {
      say('');

      void button
        .during(action)
        .then((message) => say(message))
        .catch((error) => say(error.message));
    });
  }
}
