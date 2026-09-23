import { settings } from '../../core/settings-store.js';

export class ClockSection {
  id = 'clock';
  icon = 'clock';
  label = 'Relógio e clima';

  #panel;

  constructor(panel) {
    this.#panel = panel;
  }

  render(content) {
    content.innerHTML = `
      <h3>Formato do relógio</h3>
      <div class="settings-choices">
        <button class="settings-choice ${settings.clock12h ? '' : 'active'}" data-clock="24">24 horas</button>
        <button class="settings-choice ${settings.clock12h ? 'active' : ''}" data-clock="12">12 horas</button>
      </div>
      <h3>Temperatura</h3>
      <div class="settings-choices">
        <button class="settings-choice ${settings.fahrenheit ? '' : 'active'}" data-unit="c">Celsius</button>
        <button class="settings-choice ${settings.fahrenheit ? 'active' : ''}" data-unit="f">Fahrenheit</button>
      </div>
      <p class="settings-hint">As mudanças aparecem depois de recarregar a página.</p>
    `;

    for (const button of content.querySelectorAll('[data-clock]')) {
      button.addEventListener('click', () => {
        settings.clock12h = button.dataset.clock === '12';
        this.#panel.render();
      });
    }

    for (const button of content.querySelectorAll('[data-unit]')) {
      button.addEventListener('click', () => {
        settings.fahrenheit = button.dataset.unit === 'f';
        this.#panel.render();
      });
    }
  }
}
