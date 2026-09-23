export enum ProjectModule {
  TASKS = 'TASKS',
  KANBAN = 'KANBAN',
  NOTES = 'NOTES',
  SNIPPETS = 'SNIPPETS',
  POMODORO = 'POMODORO',
  AGENDA = 'AGENDA',
  HABITS = 'HABITS',
  ROADMAP = 'ROADMAP',
  VAULT = 'VAULT',
  BOOKMARKS = 'BOOKMARKS',
}

export enum GovernanceMode {
  MICROMANAGEMENT = 'MICROMANAGEMENT',
  HIERARCHICAL = 'HIERARCHICAL',
}

type AssertSame<A extends B, B extends C, C = A> = true;

export type ProjectModuleMatches = AssertSame<
  `${ProjectModule}`,
  import('@prisma/client').ProjectModuleName
>;

export type GovernanceModeMatches = AssertSame<
  `${GovernanceMode}`,
  import('@prisma/client').GovernanceModeName
>;
