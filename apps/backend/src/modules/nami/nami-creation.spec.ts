import { readCreation } from './nami-creation';

describe('Propostas de criação da Nami', () => {
  const answer = (kind: string, data: object, extra = {}) =>
    JSON.stringify({ namiCreation: { kind, data, ...extra } });

  it('pede dados faltantes sem devolver uma proposta', () => {
    const result = readCreation(answer('task', { title: 'Corrigir login' }));
    expect(result.proposal).toBeUndefined();
    expect(result.text).toContain('coluna, prioridade e tipo');
  });

  it('prepara uma demanda completa para confirmação no projeto ativo', () => {
    const result = readCreation(answer('task', {
      title: 'Corrigir login', priority: 'HIGH', type: 'BUG', projectId: 'outro-projeto',
    }, { columnName: 'A Fazer' }));
    expect(result.proposal).toEqual({
      kind: 'task', label: 'Demanda', columnName: 'A Fazer',
      data: { title: 'Corrigir login', priority: 'HIGH', type: 'BUG' },
    });
  });

  it('rejeita campos inválidos e operações fora da lista', () => {
    expect(readCreation(answer('event', { title: 'Reunião', startsAt: 'amanhã' })).proposal).toBeUndefined();
    expect(readCreation(answer('delete', { id: '123' })).proposal).toBeUndefined();
  });
  it('normaliza referências que o Gemini colocou dentro dos dados', () => {
    expect(readCreation(answer('task', {
      title: 'Olhar a janela', priority: 'HIGH', type: 'BUG', columnName: 'Em Progresso',
    })).proposal).toEqual({
      kind: 'task', label: 'Demanda', columnName: 'Em Progresso',
      data: { title: 'Olhar a janela', priority: 'HIGH', type: 'BUG' },
    });
    expect(readCreation(answer('stage', { title: 'Revisão', roadmapTitle: 'Lançamento' })).proposal)
      .toMatchObject({ roadmapTitle: 'Lançamento', data: { title: 'Revisão' } });
  });

  it('prepara autoatribuição sem aceitar um ID fornecido pelo modelo', () => {
    expect(readCreation(answer('assignSelf', { title: 'Assistir Desbugados', assigneeId: 'outra-conta' })).proposal)
      .toEqual({ kind: 'assignSelf', label: 'Atribuir demanda', data: { title: 'Assistir Desbugados' } });
    expect(readCreation(answer('assignSelf', {})).proposal).toBeUndefined();
  });

  it('exige os dois títulos e prepara somente a troca de título', () => {
    expect(readCreation(answer('renameTask', { title: 'Assistir Desbugados' })).text).toContain('novo título');
    expect(readCreation(answer('renameTask', { newTitle: 'Assistir Leo Andrade' })).proposal).toBeUndefined();
    expect(readCreation(answer('renameTask', {
      title: 'Assistir Desbugados', newTitle: ' Assistir Leo Andrade ', priority: 'HIGH',
    })).proposal).toEqual({
      kind: 'renameTask', label: 'Renomear demanda',
      data: { title: 'Assistir Desbugados', newTitle: 'Assistir Leo Andrade' },
    });
  });

  it('aceita busca e edição parcial, mas não permite editar acesso', () => {
    expect(readCreation(answer('lookup', { resource: 'task', target: 'Corrigir login' })).proposal?.kind).toBe('lookup');
    expect(readCreation(answer('edit', { resource: 'task', target: 'Corrigir login', changes: { priority: 'HIGH' } })).proposal?.data.changes)
      .toEqual({ priority: 'HIGH' });
    expect(readCreation(answer('edit', { resource: 'task', target: 'Corrigir login', changes: { projectId: 'outro' } })).proposal).toBeUndefined();
    expect(readCreation(answer('invite', { role: 'ADMIN' })).proposal).toBeUndefined();
  });

});
