import { theme } from '../../core/theme-controller.js';

const BACKGROUNDS = [
  { type: 'color', value: '#000000', icon: 'moon', label: 'OLED Black' },
  { type: 'color', value: '#F8F9FA', icon: 'sun', label: 'Light Minimal' },
  { type: 'css', value: 'aurora', icon: 'sparkles', label: 'Aurora' },
];

export class AppearanceSection {
  id = 'appearance';
  icon = 'palette';
  label = 'Aparência';

  #panel;

  constructor(panel) {
    this.#panel = panel;
  }

  render(content) {
    content.innerHTML = `
      <h3>Fundo</h3>
      <div class="settings-choices">
        ${BACKGROUNDS.map(
          (option) => `
          <button class="settings-choice ${theme.value === option.value ? 'active' : ''}"
                  data-type="${option.type}" data-value="${option.value}">
            <i data-lucide="${option.icon}"></i><span>${option.label}</span>
          </button>`,
        ).join('')}
      </div>
      <h3>Imagem de fundo</h3>
      <div class="settings-row">
        <input type="text" id="settings-bg-url" class="settings-input"
               placeholder="https://exemplo.com/imagem.jpg">
        <button class="btn-primary" id="settings-bg-apply">Aplicar</button>
      </div>
    `;

    for (const button of content.querySelectorAll('[data-type]')) {
      button.addEventListener('click', () => {
        theme.apply(button.dataset.type, button.dataset.value);
        this.#panel.render();
      });
    }

    content.querySelector('#settings-bg-apply').addEventListener('click', () => {
      const url = content.querySelector('#settings-bg-url').value.trim();
      if (url) theme.apply('image', `url('${url}')`);
    });
  }
}
