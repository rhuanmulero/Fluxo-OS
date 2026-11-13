import { NamiChat } from './shell/nami-chat.js';
import { NamiSection } from './shell/settings/nami-section.js';
import { createIcons, icons } from 'lucide';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './styles/tokens.css';
import './styles/shell.css';
import './styles/components.css';

import { theme } from './core/theme-controller.js';
import { presence } from './core/presence-service.js';
import { session } from './core/session-store.js';
import { workspaceContext } from './core/workspace-context.js';
import { pageFeedback } from './core/page-feedback.js';
import { Navigation } from './shell/navigation.js';
import { KeyboardShortcuts } from './shell/keyboard-shortcuts.js';
import { UserMenu } from './shell/user-menu.js';
import { NotificationBell } from './shell/notification-bell.js';
import { SettingsPanel } from './shell/settings-panel.js';
import { AccountSection } from './shell/settings/account-section.js';
import { AppearanceSection } from './shell/settings/appearance-section.js';
import { ClockSection } from './shell/settings/clock-section.js';
import { NavigationSection } from './shell/settings/navigation-section.js';
import { PomodoroSection } from './shell/settings/pomodoro-section.js';
import { WorkspaceSection } from './shell/settings/workspace-section.js';
import { MembersSection } from './shell/settings/members-section.js';
import { InvitesSection } from './shell/settings/invites-section.js';
import { GovernanceSection } from './shell/settings/governance-section.js';
import Playground from './pages/playground.js';
import TasksPage from './pages/tasks.js';
import KanbanPage from './pages/kanban.js';
import NotesPage from './pages/notes.js';
import KnowledgePage from './pages/knowledge.js';
import TeamPage from './pages/team.js';
import PomodoroPage from './pages/pomodoro.js';
import RoutinePage from './pages/routine.js';
import RoadmapPage from './pages/roadmap.js';

const ROUTES = [
    { id: 'playground', icon: 'layout', label: 'Playground', shortcut: 'Alt+1' },
    { id: 'tasks', icon: 'check-square', label: 'Tarefas', shortcut: 'Alt+2' },
    { id: 'kanban', icon: 'columns-3', label: 'Kanban', shortcut: 'Alt+3' },
    { id: 'notes', icon: 'file-text', label: 'Anotações', shortcut: 'Alt+4' },
    { id: 'knowledge', icon: 'library', label: 'Biblioteca', shortcut: 'Alt+5' },
    { id: 'pomodoro', icon: 'timer', label: 'Pomodoro', shortcut: 'Alt+6' },
    { id: 'routine', icon: 'calendar-days', label: 'Rotina', shortcut: 'Alt+7' },
    { id: 'roadmap', icon: 'target', label: 'Metas', shortcut: 'Alt+8' },
    { id: 'team', icon: 'users', label: 'A Guilda', shortcut: 'Alt+9', dividerBefore: true },
];

export default function App() {
    const container = document.createElement('div');
    container.className = 'app-container';

    const globalBg = document.createElement('div');
    globalBg.id = 'global-bg';
    globalBg.className = 'dynamic-bg';
    container.appendChild(globalBg);

    const vignette = document.createElement('div');
    vignette.className = 'bg-vignette-overlay';
    container.appendChild(vignette);

    theme.attach(globalBg);
    presence.start(session.user?.profile?.status ?? 'ONLINE');

    const mainWrapper = document.createElement('div');
    mainWrapper.className = 'main-wrapper';

    mainWrapper.addEventListener('navigate', (event) => navigateTo(event.detail));

    const pagesCache = {};

    const namiChat = new NamiChat();
    let activePage;

    function navigateTo(pageName) {
        if (activePage !== undefined && activePage !== pageName) {
            namiChat.close({ restoreFocus: false });
        }
        activePage = pageName;
        Array.from(mainWrapper.children).forEach(child => child.style.display = 'none');

        if (!pagesCache[pageName]) {
            if (pageName === 'tasks') { pagesCache[pageName] = TasksPage(); }
            else if (pageName === 'kanban') { pagesCache[pageName] = KanbanPage(); }
            else if (pageName === 'notes') { pagesCache[pageName] = NotesPage(); }
            else if (pageName === 'knowledge') { pagesCache[pageName] = KnowledgePage(); }
            else if (pageName === 'team') { pagesCache[pageName] = TeamPage(); }
            else if (pageName === 'pomodoro') { pagesCache[pageName] = PomodoroPage(); }
            else if (pageName === 'routine') { pagesCache[pageName] = RoutinePage(); }
            else if (pageName === 'roadmap') { pagesCache[pageName] = RoadmapPage(); }
            else { pagesCache[pageName] = Playground(); }

            mainWrapper.appendChild(pagesCache[pageName]);
        }

        pagesCache[pageName].style.display = '';

        navigation.setActive(pageName);

        createIcons({ icons });
    }

    const navigation = new Navigation(ROUTES, navigateTo);
    navigation.mount(container);

    pageFeedback.mount(container);
    pageFeedback.follow(navigation);

    const settingsPanel = new SettingsPanel();

    settingsPanel
        .add(new AccountSection(), 'account')
        .add(new NamiSection(), 'account')
        .add(new AppearanceSection(settingsPanel), 'account')
        .add(new ClockSection(settingsPanel), 'account')
        .add(new NavigationSection(settingsPanel, navigation), 'account')
        .add(new PomodoroSection(), 'account')
        .add(new WorkspaceSection(), 'workspace')
        .add(new MembersSection(), 'workspace');

    if (workspaceContext.isAdmin) {
        settingsPanel.add(new InvitesSection(), 'workspace');
    }

    settingsPanel.add(new GovernanceSection(), 'workspace');

    settingsPanel.setDefaultSection('appearance');

    settingsPanel.mount(container);

    const userMenu = new UserMenu({
        onOpenProfile: () => {
            navigateTo('team');
            pagesCache.team.dispatchEvent(new CustomEvent('open-own-profile'));
        },
    });

    const notificationBell = new NotificationBell({ onNavigate: navigateTo });

    notificationBell.mount(navigation);
    userMenu.mount(navigation);

    const settingsButton = document.createElement('button');
    settingsButton.className = 'icon-btn';
    settingsButton.dataset.label = 'Configurações';
    settingsButton.dataset.shortcut = 'Alt+,';
    settingsButton.innerHTML = `
        <i data-lucide="settings"></i>
        <span class="nav-label">Configurações</span>
        <kbd class="nav-shortcut">Alt+,</kbd>
    `;
    settingsButton.addEventListener('click', () => settingsPanel.open());
    navigation.append(settingsButton);

    const shortcuts = new KeyboardShortcuts();

    const CODES = {
        'Alt+1': 'Alt+Digit1',
        'Alt+2': 'Alt+Digit2',
        'Alt+3': 'Alt+Digit3',
        'Alt+4': 'Alt+Digit4',
        'Alt+5': 'Alt+Digit5',
        'Alt+6': 'Alt+Digit6',
        'Alt+7': 'Alt+Digit7',
        'Alt+8': 'Alt+Digit8',
        'Alt+9': 'Alt+Digit9',
    };

    for (const route of ROUTES) {
        shortcuts.register(CODES[route.shortcut], () => navigateTo(route.id));
    }

    shortcuts.register('Alt+Comma', () => settingsPanel.open());
    shortcuts.listen();

    navigateTo('playground');

    container.appendChild(mainWrapper);
    namiChat.mount(container, () => settingsPanel.open('nami'));
    return container;
}
