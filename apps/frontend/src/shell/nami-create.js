import { session } from '../core/session-store.js';
import { api } from '../core/api-client.js';

function unique(items, field, name, label) {
  const matches = items.filter(item => item[field]?.trim().toLowerCase() === name?.trim().toLowerCase());
  if (matches.length !== 1) throw new Error(`Informe um nome de ${label} que identifique exatamente um item no projeto.`);
  return matches[0].id;
}

export async function findNamiItems(data, scope) {
  const project = scope.projectId && '/projects/' + encodeURIComponent(scope.projectId);
  const workspace = scope.workspaceId && '/workspaces/' + encodeURIComponent(scope.workspaceId);
  const projectResources = { task: 'tasks', column: 'columns', roadmap: 'roadmaps', stage: 'roadmaps' };
  const workspaceResources = { note: 'notes', event: 'events', habit: 'habits', bookmark: 'bookmarks', snippet: 'snippets', document: 'documents' };
  const resource = data.resource;
  let items;
  let base;
  if (resource === 'workspace') {
    items = await api.get('/workspaces');
    base = '/workspaces';
  } else if (resource === 'project') {
    if (!workspace) throw new Error('Selecione um workspace.');
    items = await api.get(workspace + '/projects');
    base = '/projects';
  } else if (Object.hasOwn(projectResources, resource)) {
    if (!project) throw new Error('Selecione um projeto.');
    base = project + '/' + projectResources[resource];
    items = await api.get(base);
  } else if (Object.hasOwn(workspaceResources, resource)) {
    if (!workspace) throw new Error('Selecione um workspace.');
    base = workspace + '/' + workspaceResources[resource];
    items = await api.get(resource === 'habit' ? base + '?includeArchived=true' : base);
    if (scope.projectId) items = items.filter(item => item.projectId === scope.projectId || item.projectId == null);
  } else {
    throw new Error('Este tipo de item não está disponível na Nami.');
  }
  const normalize = value => value?.trim().toLocaleLowerCase('pt-BR');
  const target = normalize(data.target);
  const matches = item => !target || normalize(item.title ?? item.name)?.includes(target);
  const options = resource === 'stage'
    ? items.filter(item => !data.roadmapTitle || normalize(item.title) === normalize(data.roadmapTitle))
      .flatMap(roadmap => roadmap.stages.filter(matches).map(item => ({
        item, path: base + '/' + encodeURIComponent(roadmap.id) + '/stages/' + encodeURIComponent(item.id), parent: roadmap.title,
      })))
    : items.filter(matches).map(item => ({ item, path: base + '/' + encodeURIComponent(item.id) }));
  return options.sort((a, b) => Number(normalize(b.item.title ?? b.item.name) === target)
    - Number(normalize(a.item.title ?? a.item.name) === target));
}

export async function prepareNamiEdit(proposal, scope, selected) {
  const changes = { ...proposal.data.changes };
  const before = {};
  const after = { ...changes };
  for (const key of Object.keys(changes)) before[key] = selected.item[key];
  let path = selected.path;
  if (changes.order) {
    const isRoadmap = proposal.data.resource === 'roadmap';
    const base = '/projects/' + encodeURIComponent(scope.projectId) + '/columns';
    const items = isRoadmap ? selected.item.stages : await api.get(base);
    const key = isRoadmap ? 'title' : 'name';
    const orderedIds = changes.order.map(name => unique(items, key, name, 'item'));
    if (new Set(orderedIds).size !== items.length || orderedIds.length !== items.length) {
      throw new Error('Informe todos os itens exatamente uma vez, na ordem desejada.');
    }
    before.order = items.map(item => item[key]);
    return { before, after, save: () => api.patch(isRoadmap ? path + '/stages/order' : base + '/order', { orderedIds }) };
  }
  if (changes.logDate) {
    const day = changes.logDate;
    const logs = await api.get(path + '/logs?from=' + encodeURIComponent(day) + '&to=' + encodeURIComponent(day));
    before.logDate = day;
    before.logValue = logs[0]?.value;
    before.logNote = logs[0]?.note;
    return { before, after, save: () => api.put(path + '/logs/' + encodeURIComponent(day), {
      value: changes.logValue, ...(changes.logNote === undefined ? {} : { note: changes.logNote }),
    }) };
  }
  if (changes.participantNames) {
    const members = await api.get('/workspaces/' + encodeURIComponent(scope.workspaceId) + '/members');
    const available = members.filter(member => member.active);
    const participantIds = changes.participantNames.map(name => unique(available.map(member => ({
      id: member.userId, name: member.name,
    })), 'name', name, 'participante'));
    if (new Set(participantIds).size !== participantIds.length) throw new Error('Informe cada participante uma vez.');
    before.participantNames = selected.item.participants?.map(person => person.name) ?? [];
    delete changes.participantNames;
    changes.participantIds = participantIds;
  }
  if (changes.columnName) {
    const columns = await api.get('/projects/' + encodeURIComponent(scope.projectId) + '/columns');
    const columnId = unique(columns, 'name', changes.columnName, 'coluna');
    before.columnName = columns.find(column => column.id === selected.item.columnId)?.name;
    const tasks = await api.get('/projects/' + encodeURIComponent(scope.projectId) + '/tasks');
    return { before, after, save: () => api.patch(path + '/move', { columnId, position: tasks.filter(task => task.columnId === columnId && task.id !== selected.item.id).length }) };
  }
  if (changes.assigneeName) {
    const members = await api.get('/projects/' + encodeURIComponent(scope.projectId) + '/members');
    const idOf = member => member.userId ?? member.id;
    const person = member => member.name ?? member.user?.name;
    const own = changes.assigneeName === 'SELF';
    const matches = members.filter(member => own ? idOf(member) === session.user?.id
      : person(member)?.trim().toLowerCase() === changes.assigneeName.trim().toLowerCase());
    if (matches.length !== 1) throw new Error('Informe o nome exato de um único membro do projeto.');
    before.assigneeName = person(members.find(member => idOf(member) === selected.item.assigneeId) ?? {});
    after.assigneeName = own ? 'Você' : person(matches[0]);
    changes.assigneeId = idOf(matches[0]);
    delete changes.assigneeName;
  }
  if (changes.visibility) path += '/visibility';
  return { before, after, save: () => api.patch(path, changes) };
}

export async function createFromNami(proposal, scope, file) {
  const data = { ...proposal.data };
  const project = scope.projectId && `/projects/${encodeURIComponent(scope.projectId)}`;
  const workspace = scope.workspaceId && `/workspaces/${encodeURIComponent(scope.workspaceId)}`;
  const needsProject = ['task', 'column', 'stage', 'roadmap', 'assignSelf', 'renameTask'].includes(proposal.kind);
  if (needsProject && !project) throw new Error('Selecione um projeto antes de criar este item.');
  if (!workspace && !['workspace', 'pomodoro'].includes(proposal.kind)) throw new Error('Selecione um workspace primeiro.');

  switch (proposal.kind) {
    case 'workspace': return api.post('/workspaces', data);
    case 'project': return api.post(workspace + '/projects', data);
    case 'renameTask': {
      const tasks = await api.get(project + '/tasks');
      const id = unique(tasks, 'title', data.title, 'demanda');
      return api.patch(project + '/tasks/' + encodeURIComponent(id), { title: data.newTitle });
    }
    case 'assignSelf': {
      const assigneeId = session.user?.id;
      if (!assigneeId) throw new Error('Entre na sua conta antes de confirmar.');
      const tasks = await api.get(project + '/tasks');
      const id = unique(tasks, 'title', data.title, 'demanda');
      return api.patch(project + '/tasks/' + encodeURIComponent(id), { assigneeId });
    }
    case 'task': {
      const columns = await api.get(project + '/columns');
      data.kanbanColumnId = unique(columns, 'name', proposal.columnName, 'coluna');
      return api.post(project + '/tasks', data);
    }
    case 'column': return api.post(project + '/columns', data);
    case 'roadmap': return api.post(project + '/roadmaps', data);
    case 'stage': {
      const roadmaps = await api.get(project + '/roadmaps');
      const id = unique(roadmaps, 'title', proposal.roadmapTitle, 'roadmap');
      return api.post(project + '/roadmaps/' + encodeURIComponent(id) + '/stages', data);
    }
    case 'note': return api.post(workspace + '/notes', { ...data, ...(project ? { projectId: scope.projectId } : {}) });
    case 'event': return api.post(workspace + '/events', { ...data, ...(project ? { projectId: scope.projectId } : {}) });
    case 'habit': return api.post(workspace + '/habits', { ...data, ...(project ? { projectId: scope.projectId } : {}) });
    case 'snippet': return api.post(workspace + '/snippets', { ...data, ...(project ? { projectId: scope.projectId } : {}) });
    case 'bookmark':
    case 'document': {
      if (data.scope === 'PROJECT' && !project) throw new Error('Selecione um projeto para usar esta visibilidade.');
      if (data.scope === 'PROJECT') data.projectId = scope.projectId;
      if (proposal.kind === 'bookmark') return api.post(workspace + '/bookmarks', data);
      if (!file) throw new Error('Anexe o arquivo antes de confirmar.');
      const form = new FormData();
      form.append('file', file);
      for (const [name, value] of Object.entries(data)) form.append(name, value);
      return api.postForm(workspace + '/documents', form);
    }
    case 'pomodoro': return api.post('/pomodoro/sessions', { ...data, ...(project ? { projectId: scope.projectId } : {}) });
    default: throw new Error('Esse tipo de criação não é compatível com a Nami.');
  }
}
