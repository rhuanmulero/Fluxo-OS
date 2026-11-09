import { createIcons, icons } from 'lucide';
import '../styles/components/note-content.css';
import '../styles/pages/playground.css';
import { dashboardApi } from '../api/dashboard-api.js';
import { noteApi } from '../api/note-api.js';
import { habitApi } from '../api/habit-api.js';
import { workspaceContext } from '../core/workspace-context.js';
import { session } from '../core/session-store.js';
import { ApiError } from '../core/api-error.js';
import { theme } from '../core/theme-controller.js';
import { settings } from '../core/settings-store.js';
import { PendingButton } from '../components/pending-button.js';
import { regionLoader } from '../components/region-loader.js';

const SHORT_DATE = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

function localIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

const WEATHER_ICONS = new Map([
    [0, 'sun'],
    [1, 'cloud-sun'], [2, 'cloud-sun'],
    [3, 'cloud'],
    [45, 'cloud-fog'], [48, 'cloud-fog'],
    [51, 'cloud-drizzle'], [53, 'cloud-drizzle'], [55, 'cloud-drizzle'],
    [56, 'cloud-drizzle'], [57, 'cloud-drizzle'],
    [61, 'cloud-rain'], [63, 'cloud-rain'], [65, 'cloud-rain'],
    [66, 'cloud-rain'], [67, 'cloud-rain'],
    [80, 'cloud-rain'], [81, 'cloud-rain'], [82, 'cloud-rain'],
    [71, 'cloud-snow'], [73, 'cloud-snow'], [75, 'cloud-snow'], [77, 'cloud-snow'],
    [85, 'cloud-snow'], [86, 'cloud-snow'],
    [95, 'cloud-lightning'], [96, 'cloud-lightning'], [99, 'cloud-lightning'],
]);

export default function Playground() {
    const playgroundContainer = document.createElement('main');
    playgroundContainer.className = 'playground-area';

    // REMOVIDOS DAQUI: <div id="dynamic-bg"> e <div class="bg-vignette-overlay">

    playgroundContainer.innerHTML = `
        <button type="button" id="mascot" class="mascot-container" title="Conversar com a Nami" aria-label="Conversar com a Nami" aria-expanded="false" aria-controls="nami-chat-panel">
            <svg class="cat-pixel-art" viewBox="0 0 16 16" width="32" height="32" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M2 3h2v1h1v1h6V4h1V3h2v4h1v6h-1v2H2v-2H1V7h1V3z"/>
                <rect class="cat-eye" x="4" y="8" width="2" height="1"/>
                <rect class="cat-eye" x="10" y="8" width="2" height="1"/>
                <rect fill="#FF8A8A" x="7" y="10" width="2" height="1"/>
            </svg>
        </button>

        <input type="file" id="bg-upload-input" accept="image/*" style="display: none;">

        <div id="vibe-context-menu" class="context-menu">
            <div class="menu-group-label">Estilo de Fundo</div>
            <div class="menu-item" data-type="color" data-value="#000000">
                <i data-lucide="moon" class="menu-icon"></i><span>OLED Black</span>
            </div>
            <div class="menu-item" data-type="color" data-value="#F8F9FA">
                <i data-lucide="sun" class="menu-icon"></i><span>Light Minimal (Branco)</span>
            </div>
            <div class="menu-item" data-type="css" data-value="aurora">
                <i data-lucide="sparkles" class="menu-icon"></i><span>Aurora (CSS Puro)</span>
            </div>
            
            <div class="context-divider"></div>
            
            <div class="menu-group-label">Wallpapers</div>
            <div class="menu-item" data-type="image" data-value="url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')">
                <i data-lucide="aperture" class="menu-icon"></i><span>Liquid Mesh</span>
            </div>
            <div class="menu-item" data-type="upload" data-value="">
                <i data-lucide="upload" class="menu-icon"></i><span>Fazer Upload Local...</span>
            </div>
            <div class="menu-item" data-type="custom" data-value="">
                <i data-lucide="link" class="menu-icon"></i><span>Usar URL Customizada...</span>
            </div>
        </div>

        <div id="url-modal-overlay" class="modal-overlay">
            <div class="modal-content">
                <h3>Adicionar Fundo via URL</h3>
                <input type="text" id="custom-url-input" placeholder="https://exemplo.com/imagem.jpg" autocomplete="off">
                <div class="modal-actions">
                    <button id="btn-cancel-url" class="btn-secondary">Cancelar</button>
                    <button id="btn-apply-url" class="btn-primary">Aplicar Imagem</button>
                </div>
            </div>
        </div>

        <div id="dashboard-panel" class="dashboard-panel glass-panel" style="display: none;"></div>

        <div class="central-widget-wrapper" id="central-widget" title="Arraste para mover">
            <div class="date-display text-glow" id="date-display">Carregando data...</div>
            <h1 id="clock-display" class="clock-huge text-glow" title="Clique para mudar o formato">00:00</h1>
            
            <div class="greeting-container text-glow">
                <span id="greeting-text">Boa noite, </span>
                <span id="user-name">Criador</span>
            </div>

            <div class="weather-widget glass-panel" id="weather-widget" title="Clique para mudar ºC / ºF">
                <i data-lucide="cloud" id="weather-icon" style="width: 18px; height: 18px;"></i>
                <span id="weather-text">Localizando...</span>
            </div>
        </div>
    `;

    // 1. Relógio, Data e Saudação
    const clockElement = playgroundContainer.querySelector('#clock-display');
    const dateElement = playgroundContainer.querySelector('#date-display');
    const greetingText = playgroundContainer.querySelector('#greeting-text');
    let use12h = settings.clock12h;

    clockElement.addEventListener('click', () => { use12h = !use12h; settings.clock12h = use12h; updateTime(); });

    function updateTime() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        if (use12h) { hours = hours % 12 || 12; clockElement.textContent = `${hours}:${minutes} ${ampm}`; } 
        else { clockElement.textContent = `${String(hours).padStart(2, '0')}:${minutes}`; }

        dateElement.textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);

        const hr = now.getHours();
        if (hr >= 5 && hr < 12) greetingText.textContent = "Bom dia, ";
        else if (hr >= 12 && hr < 18) greetingText.textContent = "Boa tarde, ";
        else greetingText.textContent = "Boa noite, ";
    }
    updateTime(); setInterval(updateTime, 1000);

    const userNameElement = playgroundContainer.querySelector('#user-name');
    userNameElement.textContent = session.user?.name ?? 'Criador';

    // 2. Widget de Clima
    const weatherWidget = playgroundContainer.querySelector('#weather-widget');
    const weatherText = playgroundContainer.querySelector('#weather-text');
    let useFahrenheit = settings.fahrenheit;
    let currentTempC = null; let currentCity = ""; let currentCode = null;

    weatherWidget.addEventListener('click', () => { useFahrenheit = !useFahrenheit; settings.fahrenheit = useFahrenheit; renderWeather(); });

    function renderWeather() {
        if (currentTempC === null) return;
        const temp = useFahrenheit ? Math.round((currentTempC * 9/5) + 32) : currentTempC;
        const unit = useFahrenheit ? '°F' : '°C';
        weatherText.innerHTML = `${temp}${unit} &bull; ${currentCity}`;

        const icon = playgroundContainer.querySelector('#weather-icon');
        icon.setAttribute('data-lucide', WEATHER_ICONS.get(currentCode) ?? 'cloud');
        icon.removeAttribute('class');
        createIcons({ icons });
    }

    async function fetchWeatherSilently() {
        try {
            const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
            const geoData = await geoRes.json();
            currentCity = geoData.city || geoData.region || geoData.country || "Desconhecido";
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geoData.latitude}&longitude=${geoData.longitude}&current_weather=true`);
            const weatherData = await weatherRes.json();
            currentTempC = Math.round(weatherData.current_weather.temperature);
            currentCode = weatherData.current_weather.weathercode;
            renderWeather();
        } catch (e) { weatherText.innerHTML = `Clima indisponível`; }
    }
    fetchWeatherSilently();

    const centralWidget = playgroundContainer.querySelector('#central-widget');
    setupWidgetDraggable(centralWidget);

    // 4. Menu de Contexto e TEMAS GLOBAIS
    const contextMenu = playgroundContainer.querySelector('#vibe-context-menu');

    playgroundContainer.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.weather-widget') || e.target.closest('.mascot-container') || e.target.closest('.sticky-note-widget')) return;
        e.preventDefault();
        let x = e.clientX; let y = e.clientY;
        if (x + 220 > window.innerWidth) x = window.innerWidth - 230;
        if (y + 200 > window.innerHeight) y = window.innerHeight - 210;
        contextMenu.style.left = `${x}px`; contextMenu.style.top = `${y}px`;
        contextMenu.classList.add('active');
    });
    document.addEventListener('click', () => contextMenu.classList.remove('active'));

    const modalOverlay = playgroundContainer.querySelector('#url-modal-overlay');
    const urlInput = playgroundContainer.querySelector('#custom-url-input');
    const btnCancel = playgroundContainer.querySelector('#btn-cancel-url');
    const btnApply = playgroundContainer.querySelector('#btn-apply-url');
    
    function openUrlModal() { contextMenu.classList.remove('active'); modalOverlay.classList.add('active'); urlInput.value = ''; setTimeout(() => urlInput.focus(), 100); }
    btnCancel.addEventListener('click', () => modalOverlay.classList.remove('active'));
    btnApply.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (url) theme.apply('image', `url('${url}')`);
        modalOverlay.classList.remove('active');
    });

    const uploadInput = playgroundContainer.querySelector('#bg-upload-input');
    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas'); const MAX_WIDTH = 1920; let scaleSize = 1;
                if(img.width > MAX_WIDTH) scaleSize = MAX_WIDTH / img.width;
                canvas.width = img.width * scaleSize; canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                theme.apply('image', `url('${canvas.toDataURL('image/jpeg', 0.85)}')`);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    playgroundContainer.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            if (item.dataset.type === 'custom') return openUrlModal();
            if (item.dataset.type === 'upload') { contextMenu.classList.remove('active'); return uploadInput.click(); }
            
            theme.apply(item.dataset.type, item.dataset.value);
        });
    });

    // 5. INTEGRACAO WIDGETS
    async function loadDashboard() {
        const panel = playgroundContainer.querySelector('#dashboard-panel');

        panel.style.display = 'flex';

        await regionLoader.during(panel, async () => {
            try {
                const data = await dashboardApi.of(
                    workspaceContext.workspaceId,
                    workspaceContext.projectId ?? undefined,
                );

                renderDashboard(panel, data);
            } catch (error) {
                panel.style.display = 'none';

                if (!(error instanceof ApiError)) {
                    throw error;
                }
            }
        });
    }

    function renderDashboard(panel, data) {
        const { completed, pending, overdue } = data.metrics;
        const total = completed + pending;
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

        panel.innerHTML = `
            <div class="dashboard-metrics">
                <div class="metric"><strong>${completed}</strong><span>concluídas</span></div>
                <div class="metric"><strong>${pending}</strong><span>pendentes</span></div>
                <div class="metric"><strong>${overdue}</strong><span>atrasadas</span></div>
                <div class="metric"><strong>${data.pomodoro.completedCycles}</strong><span>ciclos</span></div>
            </div>
            <div class="dashboard-progress" role="progressbar"
                 aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
                <div class="dashboard-progress-fill" style="width: ${percent}%"></div>
            </div>
            <section class="dashboard-block">
              <header class="dashboard-block-header">
                <h3>Para hoje</h3>
                <span class="dashboard-count">${data.todayTasks.length}</span>
              </header>
              <ul class="dashboard-today"></ul>
            </section>
            <section class="dashboard-block">
              <header class="dashboard-block-header">
                <h3>Próximos eventos</h3>
                <span class="dashboard-count">${data.upcomingEvents.length}</span>
              </header>
              <ul class="dashboard-events"></ul>
            </section>
            <section class="dashboard-block">
              <header class="dashboard-block-header">
                <h3>Hábitos de hoje</h3>
                <span class="dashboard-count">${data.pendingHabits.length}</span>
              </header>
              <ul class="dashboard-habits"></ul>
            </section>
            <p class="settings-error" id="dashboard-habit-error"></p>
        `;

        const list = panel.querySelector('.dashboard-today');

        if (data.todayTasks.length === 0) {
            list.innerHTML = '<li class="empty">Nada com prazo para hoje.</li>';
        } else {
            for (const task of data.todayTasks) {
                const item = document.createElement('li');
                item.className = `dashboard-task priority-${task.priority.toLowerCase()}`;
                item.textContent = task.title;
                list.appendChild(item);
            }
        }

        const eventList = panel.querySelector('.dashboard-events');

        eventList.innerHTML = data.upcomingEvents.length
            ? data.upcomingEvents
                  .map(
                      (event) => `
                      <li class="dashboard-event">
                          <span>${SHORT_DATE.format(new Date(event.startsAt))}</span>
                          ${event.title}
                      </li>`,
                  )
                  .join('')
            : '<li class="empty">Nada nos próximos sete dias.</li>';

        const habitList = panel.querySelector('.dashboard-habits');

        habitList.innerHTML = data.pendingHabits.length
            ? data.pendingHabits
                  .map(
                      (habit) => `
                      <li class="dashboard-habit" data-habit="${habit.id}">
                          <button class="dashboard-habit-check"><i data-lucide="circle"></i></button>
                          ${habit.name}
                      </li>`,
                  )
                  .join('')
            : '<li class="empty">Tudo em dia.</li>';

        const habitError = panel.querySelector('#dashboard-habit-error');

        habitList.querySelectorAll('.dashboard-habit-check').forEach((button) => {
            const pendingButton = new PendingButton(button);

            button.addEventListener('click', () => {
                const habitId = button.closest('[data-habit]').dataset.habit;
                const today = localIsoDate(new Date());

                void pendingButton
                    .during(() => habitApi.mark(workspaceContext.workspaceId, habitId, today))
                    .then(() => loadDashboard())
                    .catch((error) => {
                        habitError.textContent =
                            error instanceof ApiError ? error.message : 'Não foi possível concluir o hábito.';
                    });
            });
        });

        createIcons({ icons });
    }

    async function renderPinnedNotes() {
        playgroundContainer.querySelectorAll('.sticky-note-widget').forEach(el => el.remove());

        if (!workspaceContext.workspaceId) return;

        let pinnedNotes = [];

        try {
            const notes = await noteApi.list(workspaceContext.workspaceId);
            pinnedNotes = notes.filter(n => n.isPinned && n.authorId === session.user?.id);
        } catch (error) {
            if (!(error instanceof ApiError)) throw error;
            return;
        }

        pinnedNotes.forEach((note, index) => {
            const noteEl = document.createElement('div'); noteEl.className = 'sticky-note-widget glass-panel';

            if (note.color) {
                noteEl.classList.add('has-color');
                noteEl.style.setProperty('--note-color', note.color);
            }

            const savedLeft = localStorage.getItem(`fluxo.sticky.${note.id}.left`); const savedTop = localStorage.getItem(`fluxo.sticky.${note.id}.top`);
            noteEl.style.left = savedLeft ? savedLeft : `${80 + (index * 30)}px`; noteEl.style.top = savedTop ? savedTop : `${200 + (index * 30)}px`; noteEl.style.position = 'absolute';

            noteEl.innerHTML = `
                <div class="sticky-header drag-handle-note" title="Arraste a nota">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <i data-lucide="file-text" style="width:12px; color: var(--text-muted);"></i>
                        <span style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--text-muted);">${note.title}</span>
                    </div>
                    <button class="btn-unpin-sticky" title="Desafixar do Playground"><i data-lucide="x" style="width:14px;"></i></button>
                </div>
                <div class="sticky-content note-content">${note.body}</div>
            `;
            playgroundContainer.appendChild(noteEl);
            setupStickyDraggable(noteEl, note.id);

            noteEl.querySelector('.btn-unpin-sticky').addEventListener('click', () => {
                void noteApi
                    .update(workspaceContext.workspaceId, note.id, { isPinned: false })
                    .then(() => renderPinnedNotes())
                    .catch(() => undefined);
            });
        });
        createIcons({ icons });
    }

    function refreshWidgets() {
        void loadDashboard().catch(() => undefined);
        void renderPinnedNotes().catch(() => undefined);
    }

    workspaceContext.onChange(refreshWidgets);
    refreshWidgets();

    return playgroundContainer;
}

// ARRASTES
function setupWidgetDraggable(element) {
    let isDragging = false, offsetX, offsetY;
    let savedLeft = localStorage.getItem('fluxo.widget.left'); let savedTop = localStorage.getItem('fluxo.widget.top');
    if (savedLeft && savedTop) { const l = parseFloat(savedLeft); const t = parseFloat(savedTop); if (l < -100 || l > window.innerWidth || t < -100 || t > window.innerHeight) { savedLeft = null; savedTop = null; } else { element.style.position = 'absolute'; element.style.left = savedLeft; element.style.top = savedTop; element.style.transform = 'none'; } }
    element.addEventListener('mousedown', (e) => {
        if(e.target.tagName === 'SPAN' || e.target.closest('.weather-widget') || e.target.closest('.clock-huge')) return; 
        isDragging = true; element.style.cursor = 'grabbing';
        const rect = element.getBoundingClientRect(); offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        if (element.style.position !== 'absolute') { element.style.position = 'absolute'; element.style.left = `${rect.left}px`; element.style.top = `${rect.top}px`; element.style.transform = 'none'; }
        document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
    });
    function onMouseMove(e) {
        if (!isDragging) return; let newX = e.clientX - offsetX; let newY = e.clientY - offsetY; const padding = 20; const ww = window.innerWidth; const wh = window.innerHeight; const elW = element.offsetWidth; const elH = element.offsetHeight;
        newX = Math.max(padding, Math.min(newX, ww - elW - padding)); newY = Math.max(padding, Math.min(newY, wh - elH - padding));
        element.style.left = `${newX}px`; element.style.top = `${newY}px`;
    }
    function onMouseUp() {
        if (!isDragging) return; isDragging = false; element.style.cursor = 'grab';
        document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp);
        localStorage.setItem('fluxo.widget.left', element.style.left); localStorage.setItem('fluxo.widget.top', element.style.top);
    }
}

function setupStickyDraggable(element, noteId) {
    const handle = element.querySelector('.drag-handle-note');
    let isDragging = false, offsetX, offsetY;
    handle.addEventListener('mousedown', (e) => {
        isDragging = true; element.style.cursor = 'grabbing'; element.style.zIndex = 1000;
        const rect = element.getBoundingClientRect(); offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
    });
    function onMouseMove(e) { if (!isDragging) return; element.style.left = `${e.clientX - offsetX}px`; element.style.top = `${e.clientY - offsetY}px`; }
    function onMouseUp() {
        if (!isDragging) return; isDragging = false; element.style.cursor = 'grab'; element.style.zIndex = 20;
        document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp);
        localStorage.setItem(`fluxo.sticky.${noteId}.left`, element.style.left); localStorage.setItem(`fluxo.sticky.${noteId}.top`, element.style.top);
    }
}