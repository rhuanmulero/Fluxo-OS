import { workspaceContext } from '../../core/workspace-context.js';
import { includesProjectContext, setProjectContextPreference } from '../../core/nami-project-preference.js';
import { namiApi } from '../../api/nami-api.js';

export class NamiSection {
  id = 'nami';
  icon = 'sparkles';
  label = 'Nami';

  render(content) {
    content.innerHTML = `
      <h3>Nami · Gemini</h3>
      <p class="settings-hint">As mensagens desta conversa são enviadas ao Google Gemini para gerar respostas. O histórico é privado e fica salvo na sua conta do Fluxo.</p>
      <div class="nami-context-settings">
        <h3>Contexto do projeto</h3>
        <label class="nami-context-checkbox">
          <input type="checkbox" class="custom-checkbox" data-project-context aria-describedby="nami-context-hint">
          <span>Enviar contexto do projeto ao Gemini</span>
        </label>
        <p class="settings-hint" id="nami-context-hint" data-context-hint></p>
      </div>
      <form class="nami-settings-form">
        <label>Chave da API do Gemini
          <input name="apiKey" type="password" class="settings-input" autocomplete="off" maxlength="256" placeholder="Cole sua chave para configurar ou substituir">
        </label>
        <p class="settings-hint">Crie sua chave no <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>. O uso depende da cota e do plano da sua conta.</p>
        <label>Modelo
          <input name="model" class="settings-input" required maxlength="100" pattern="gemini-[a-z0-9.\\-]+" value="gemini-3.5-flash-lite">
        </label>
        <p class="settings-hint">Com uma chave já salva, deixe o campo da chave vazio para manter a atual.</p>
        <div class="settings-row">
          <button type="submit" class="btn-primary">Salvar configuração</button>
          <button type="button" class="btn-secondary" data-remove-key>Remover chave</button>
        </div>
        <p role="status" class="settings-hint" data-nami-status>Carregando configuração…</p>
      </form>`;
    const project = workspaceContext.project;
    const toggle = content.querySelector('[data-project-context]');
    toggle.disabled = !project;
    toggle.checked = includesProjectContext(project?.id);
    toggle.addEventListener('change', () => {
      setProjectContextPreference(project?.id, toggle.checked);
    });
    content.querySelector('[data-context-hint]').textContent = project
      ? 'Quando ativado, as mensagens incluem dados de ' + project.name + ' que você tem permissão para consultar. A preferência é salva neste navegador.'
      : 'Selecione um projeto para ativar o envio de contexto.';

    const form = content.querySelector('form');
    const feedback = content.querySelector('[data-nami-status]');
    const key = form.elements.apiKey;
    const model = form.elements.model;
    const buttons = [...form.querySelectorAll('button')];
    let configured = false;
    const syncKeyMask = () => {
      key.placeholder = configured ? '••••••••••••••••' : 'Cole sua chave para configurar ou substituir';
    };
    let ready = false;
    const pending = value => buttons.forEach(button => button.disabled = value);
    pending(true);
    void namiApi.settings().then(settings => {
      configured = settings.configured;
      syncKeyMask();
      model.value = settings.model;
      feedback.textContent = configured ? 'Chave configurada. O valor salvo não é exibido.' : 'Configure sua chave para começar.';
      ready = true;
      pending(false);
    }).catch(error => { feedback.textContent = error.message; });
    const run = async action => {
      if (!ready) return;
      pending(true);
      try { await action(); }
      catch (error) { feedback.textContent = error.message; }
      finally { pending(false); }
    };
    form.addEventListener('submit', event => {
      event.preventDefault();
      void run(async () => {
        if (!configured && !key.value.trim()) throw new Error('Informe sua chave do Gemini.');
        await namiApi.saveSettings({ model: model.value.trim(), ...(key.value.trim() ? { apiKey: key.value.trim() } : {}) });
        configured = true;
        key.value = '';
        syncKeyMask();
        feedback.textContent = 'Configuração salva. A chave será verificada ao enviar uma mensagem.';
        document.dispatchEvent(new CustomEvent('nami-settings-changed', { detail: { configured } }));
      });
    });
    content.querySelector('[data-remove-key]').addEventListener('click', () => void run(async () => {
      await namiApi.removeKey();
      configured = false;
      key.value = '';
      syncKeyMask();
      feedback.textContent = 'Chave removida. Seu histórico foi mantido.';
      document.dispatchEvent(new CustomEvent('nami-settings-changed', { detail: { configured } }));
    }));
  }
}
