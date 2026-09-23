import { sanitizeRichText } from './html-sanitizer';

describe('sanitizeRichText', () => {
  it('mantém a formatação que o editor produz', () => {
    const input = '<p>Regras:</p><ul><li><b>Negrito</b> e <i>itálico</i></li></ul>';

    expect(sanitizeRichText(input)).toBe(input);
  });

  it('mantém blocos <div> (quebras de parágrafo do editor)', () => {
    const input = '<div>linha um</div><div>linha dois</div>';

    expect(sanitizeRichText(input)).toBe(input);
  });

  it('remove script', () => {
    expect(sanitizeRichText('<p>oi</p><script>alert(1)</script>')).toBe('<p>oi</p>');
  });

  it('remove manipulador de evento inline', () => {
    expect(sanitizeRichText('<p onclick="roubar()">texto</p>')).toBe('<p>texto</p>');
  });

  it('remove href com javascript:', () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">clique</a>')).toBe('<a>clique</a>');
  });

  it('mantém link http legítimo', () => {
    const input = '<a href="https://fluxo.local/doc" target="_blank">doc</a>';

    expect(sanitizeRichText(input)).toContain('href="https://fluxo.local/doc"');
  });

  it('devolve string vazia para entrada vazia', () => {
    expect(sanitizeRichText('')).toBe('');
  });
});

describe('sanitizeRichText — blocos além do markdown', () => {
  it('mantém checklist com item marcado', () => {
    const input = '<ul class="checklist"><li class="checked">feito</li><li>pendente</li></ul>';

    expect(sanitizeRichText(input)).toBe(input);
  });

  it('mantém marca-texto com cor conhecida', () => {
    const input = '<p>texto <mark class="hl-yellow">destacado</mark></p>';

    expect(sanitizeRichText(input)).toBe(input);
  });

  it('remove cor desconhecida do marca-texto', () => {
    expect(sanitizeRichText('<mark class="hl-red">x</mark>')).toBe('<mark>x</mark>');
  });

  it('mantém caixa de destaque', () => {
    const input = '<div class="callout callout-warning">cuidado</div>';

    expect(sanitizeRichText(input)).toBe(input);
  });

  it('remove classe desconhecida de bloco', () => {
    expect(sanitizeRichText('<div class="qualquer">x</div>')).toBe('<div>x</div>');
  });

  it('mantém divisória', () => {
    expect(sanitizeRichText('<div>a</div><hr><div>b</div>')).toBe('<div>a</div><hr /><div>b</div>');
  });
});
