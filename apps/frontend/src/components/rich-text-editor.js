import '../styles/components/note-content.css';
import '../styles/components/rich-text-editor.css';
import { EditHistory } from './edit-history.js';
import { RichTextToolbar } from './rich-text-toolbar.js';

const HIGHLIGHTS = [
  { value: 'hl-yellow', label: 'Amarelo' },
  { value: 'hl-green', label: 'Verde' },
  { value: 'hl-pink', label: 'Rosa' },
  { value: 'hl-blue', label: 'Azul' },
];

const CALLOUTS = [
  { value: 'callout-info', label: 'Informação', icon: 'info' },
  { value: 'callout-warning', label: 'Aviso', icon: 'triangle-alert' },
  { value: 'callout-success', label: 'Sucesso', icon: 'circle-check' },
];

const COMMANDS = [
  { id: 'undo', icon: 'undo-2', label: 'Desfazer (Ctrl+Z)', group: 'history' },
  { id: 'redo', icon: 'redo-2', label: 'Refazer (Ctrl+Y)', group: 'history' },
  { id: 'h2', icon: 'heading-2', label: 'Título', block: 'H2', group: 'block' },
  { id: 'h3', icon: 'heading-3', label: 'Subtítulo', block: 'H3', group: 'block' },
  { id: 'ul', icon: 'list', label: 'Lista', list: 'UL', group: 'block' },
  { id: 'ol', icon: 'list-ordered', label: 'Lista numerada', list: 'OL', group: 'block' },
  { id: 'checklist', icon: 'list-checks', label: 'Checklist', list: 'UL', className: 'checklist', group: 'block' },
  { id: 'quote', icon: 'quote', label: 'Citação', block: 'BLOCKQUOTE', group: 'block' },
  { id: 'code', icon: 'square-code', label: 'Bloco de código', block: 'PRE', group: 'block' },
  { id: 'callout', icon: 'message-square-warning', label: 'Caixa de destaque', block: 'DIV', className: 'callout', choices: CALLOUTS, group: 'block' },
  { id: 'hr', icon: 'minus', label: 'Divisória', group: 'block' },
  { id: 'bold', icon: 'bold', label: 'Negrito (Ctrl+B)', wrap: 'STRONG', group: 'inline' },
  { id: 'italic', icon: 'italic', label: 'Itálico (Ctrl+I)', wrap: 'EM', group: 'inline' },
  { id: 'underline', icon: 'underline', label: 'Sublinhado (Ctrl+U)', wrap: 'U', group: 'inline' },
  { id: 'strike', icon: 'strikethrough', label: 'Riscado', wrap: 'S', group: 'inline' },
  { id: 'inline-code', icon: 'code', label: 'Código inline', wrap: 'CODE', group: 'inline' },
  { id: 'highlight', icon: 'highlighter', label: 'Marca-texto', wrap: 'MARK', choices: HIGHLIGHTS, group: 'inline' },
  { id: 'link', icon: 'link', label: 'Link (Ctrl+K)', group: 'inline' },
  { id: 'clear', icon: 'remove-formatting', label: 'Limpar formatação', group: 'inline' },
];

const SHORTCUTS = { b: 'bold', i: 'italic', u: 'underline', k: 'link', z: 'undo', y: 'redo' };

const INLINE_TAGS = ['STRONG', 'EM', 'U', 'S', 'A', 'CODE', 'MARK'];

const WRAP_TAGS = ['STRONG', 'EM', 'U', 'S', 'CODE', 'MARK'];

const TYPING_PAUSE_MS = 800;

const CHECKBOX_HIT_WIDTH = 24;

// Caractere invisível (largura zero) usado só como "âncora" para o caret
// ficar de verdade dentro de uma tag inline recém-criada e vazia — sem ele,
// o Chromium não reconhece uma posição de caret dentro de um elemento sem
// nenhum filho, e o texto digitado em seguida cai fora da tag (mesmo
// problema que blocos vazios têm, resolvido lá com um <br>; aqui um <br>
// não serve porque quebraria a linha). Nunca deve sobreviver em `value`.
const ZERO_WIDTH = '\u200B';

export class RichTextEditor {
  #element;
  #editor;
  #toolbar;
  #counter;
  #onLink;
  #history = new EditHistory();
  #lastInputType = null;
  #lastInputAt = 0;
  #pendingWrap = null;

  constructor(mount, { placeholder = '', onLink } = {}) {
    this.#onLink = onLink;

    this.#element = document.createElement('div');
    this.#element.className = 'rich-text-wrapper';
    this.#element.innerHTML = `
      <div class="rt-toolbar"></div>
      <div class="rt-editor note-content" contenteditable="true" role="textbox" aria-multiline="true"
           data-placeholder="${placeholder}"></div>
    `;

    mount.appendChild(this.#element);

    const toolbar = this.#element.querySelector('.rt-toolbar');

    this.#toolbar = new RichTextToolbar(toolbar, COMMANDS, {
      onCommand: (id, choice) => this.#run(id, choice),
    });

    this.#counter = document.createElement('span');
    this.#counter.className = 'rt-words';
    toolbar.appendChild(this.#counter);

    this.#editor = this.#element.querySelector('.rt-editor');

    this.#bind();
    this.#count();
    this.#syncHistory();
  }

  // Lê a partir de uma CÓPIA do editor, nunca do editor ao vivo: um clique em
  // negrito/itálico/etc. sem digitar nada deixa uma tag inline vazia com só
  // o âncora invisível `ZERO_WIDTH` dentro dela até o usuário digitar, sair
  // do campo ou clicar o mesmo botão de novo. Mesmo com toda essa limpeza
  // (`#bind` no blur, `#toggleEmptyWrap` no segundo clique, `#commitPendingWrap`
  // ao digitar), ler daqui garante que nenhum `<strong>`/`<em>`/`<u>`/`<s>`
  // vazio nem o caractere invisível jamais chegue no HTML salvo, custe o
  // que custar a ordem exata dos eventos do navegador.
  get value() {
    const clone = this.#editor.cloneNode(true);

    for (const tagName of WRAP_TAGS) {
      for (const element of clone.querySelectorAll(tagName)) {
        if (element.textContent.replaceAll(ZERO_WIDTH, '') === '') {
          element.remove();
        }
      }
    }

    this.#stripZeroWidth(clone);
    return clone.innerHTML;
  }

  set value(html) {
    this.#pendingWrap = null;
    this.#editor.innerHTML = html ?? '';
    this.#history.reset(this.value);
    this.#count();
    this.#syncHistory();
  }

  get words() {
    return this.#editor.textContent
      .replaceAll(ZERO_WIDTH, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  focus() {
    this.#editor.focus();
  }

  #bind() {
    this.#editor.addEventListener('beforeinput', (event) => this.#beforeInput(event));

    this.#editor.addEventListener('input', (event) => {
      this.#count();

      if (event.inputType === 'insertParagraph') {
        this.#uncheckSplitItem();
      }

      this.#syncHistory();
    });

    this.#editor.addEventListener('click', (event) => this.#toggleCheck(event));

    this.#editor.addEventListener('keydown', (event) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      const key = event.key.toLowerCase();
      const command = key === 'z' && event.shiftKey ? 'redo' : SHORTCUTS[key];

      if (command === undefined) {
        return;
      }

      event.preventDefault();
      this.#run(command);
    });

    this.#editor.addEventListener('paste', (event) => {
      event.preventDefault();

      const text = event.clipboardData.getData('text/plain');

      this.#history.commit(this.value);
      this.#insertText(text);
      this.#count();
      this.#syncHistory();
    });

    // O usuário clicou negrito/itálico/etc. com o caret vazio e foi embora
    // sem digitar (fechou a nota, clicou Salvar...). Sem isso, a tag inline
    // vazia com só o âncora invisível dentro fica parada no DOM ao vivo até
    // a próxima leitura de `value` limpar (o que `value` já garante), mas
    // isso deixa o DOM ao vivo mais arrumado e evita acumular várias dessas
    // se o usuário focar e desfocar o campo repetidas vezes.
    this.#editor.addEventListener('blur', () => this.#discardStaleWrap());
  }

  #beforeInput(event) {
    if (event.inputType === 'historyUndo') {
      event.preventDefault();
      this.#undo();
      return;
    }

    if (event.inputType === 'historyRedo') {
      event.preventDefault();
      this.#redo();
      return;
    }

    const now = Date.now();
    const boundary =
      event.inputType !== this.#lastInputType || now - this.#lastInputAt > TYPING_PAUSE_MS;

    if (boundary) {
      this.#history.commit(this.value);
    }

    this.#lastInputType = event.inputType;
    this.#lastInputAt = now;
  }

  #run(id, choice = null) {
    this.#editor.focus();

    if (id === 'undo') {
      this.#undo();
      return;
    }

    if (id === 'redo') {
      this.#redo();
      return;
    }

    const command = COMMANDS.find((candidate) => candidate.id === id);
    const className = [command.className, choice].filter(Boolean).join(' ');

    this.#history.commit(this.value);

    if (command.wrap) this.#wrap(command.wrap, className);
    else if (command.block) this.#block(command.block, className);
    else if (command.list) this.#list(command.list, className);
    else if (id === 'hr') this.#divider();
    else if (id === 'link') this.#link();
    else this.#clear();

    this.#count();
    this.#syncHistory();
  }

  #undo() {
    const snapshot = this.#history.undo(this.value);

    if (snapshot !== null) {
      this.#restore(snapshot);
    }
  }

  #redo() {
    const snapshot = this.#history.redo();

    if (snapshot !== null) {
      this.#restore(snapshot);
    }
  }

  #restore(html) {
    this.#pendingWrap = null;
    this.#editor.innerHTML = html;

    const selection = window.getSelection();
    const range = document.createRange();

    range.selectNodeContents(this.#editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    this.#count();
    this.#syncHistory();
  }

  #syncHistory() {
    this.#toolbar.setEnabled('undo', this.#history.canUndo(this.value));
    this.#toolbar.setEnabled('redo', this.#history.canRedo);
  }

  #range() {
    const selection = window.getSelection();

    if (selection.rangeCount === 0 || !this.#editor.contains(selection.anchorNode)) {
      return null;
    }

    return selection.getRangeAt(0);
  }

  // Um bloco de nível superior é qualquer filho direto de #editor: um
  // elemento (P, DIV, H2, BLOCKQUOTE...) ou, logo após o usuário digitar sem
  // nunca ter apertado Enter, o próprio nó de texto solto.
  #blocksInRange(range) {
    return [...this.#editor.childNodes].filter((node) => range.intersectsNode(node));
  }

  // Sobe a partir de `node` até achar o filho direto de #editor que o
  // contém. Retorna null quando `node` já É o #editor (seleção vazia, sem
  // nenhum bloco ainda) para não escapar da árvore do editor.
  #blockOf(node) {
    if (node === this.#editor) {
      return null;
    }

    while (node && node.parentNode !== this.#editor) {
      node = node.parentNode;
    }

    return node;
  }

  #hasClasses(node, className) {
    const actual = node.nodeType === Node.ELEMENT_NODE ? [...node.classList].sort().join(' ') : '';
    const expected = className.split(' ').filter(Boolean).sort().join(' ');

    return actual === expected;
  }

  #matchesBlock(node, tagName, className) {
    return node.nodeName === tagName && this.#hasClasses(node, className);
  }

  #setClasses(element, className) {
    if (className === '') {
      element.removeAttribute('class');
      return;
    }

    element.className = className;
  }

  #isList(node) {
    return node.nodeName === 'UL' || node.nodeName === 'OL';
  }

  // Recorta `range` em um sub-range por bloco de nível superior que ele
  // toca, cada um limitado às bordas reais da seleção. Evita que #wrap()
  // e #link() produzam uma tag inline envolvendo vários blocos (ex.:
  // <strong><p>...</p><p>...</p></strong>), o que é HTML inválido.
  #splitByBlocks(range) {
    const startBlock = this.#blockOf(range.startContainer);
    const endBlock = this.#blockOf(range.endContainer);

    return this.#blocksInRange(range).map((block) => {
      const sub = document.createRange();

      sub.selectNodeContents(block);

      if (block === startBlock) sub.setStart(range.startContainer, range.startOffset);
      if (block === endBlock) sub.setEnd(range.endContainer, range.endOffset);

      return sub;
    });
  }

  #wrap(tagName, className) {
    const range = this.#range();

    if (range === null) {
      return;
    }

    if (range.collapsed) {
      this.#toggleEmptyWrap(range, tagName, className);
      return;
    }

    this.#discardStaleWrap();

    for (const sub of this.#splitByBlocks(range)) {
      this.#wrapRange(sub, tagName, className);
    }
  }

  #wrapRange(range, tagName, className) {
    if (range.collapsed) {
      return;
    }

    const existing = this.#ancestor(range, tagName);

    if (existing) {
      if (this.#hasClasses(existing, className)) {
        existing.replaceWith(...existing.childNodes);
      } else {
        this.#setClasses(existing, className);
      }

      return;
    }

    const wrapper = document.createElement(tagName);

    this.#setClasses(wrapper, className);
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
    this.#select(wrapper);
  }

  #ancestor(range, tagName) {
    let node = range.commonAncestorContainer;

    while (node && node !== this.#editor) {
      if (node.nodeName === tagName) return node;
      node = node.parentNode;
    }

    return null;
  }

  // Caret sem seleção sobre bold/italic/underline/strike: o navegador antigo
  // (`document.execCommand`) mantinha um "formato pendente" e o próximo
  // caractere digitado já saía formatado — o gesto mais comum de todos
  // (clicar negrito, depois digitar). Recriamos isso criando a tag vazia
  // com um `ZERO_WIDTH` dentro (ver comentário da constante) e deixando o
  // caret logo depois dele, dentro da tag. `#commitPendingWrap` (chamado a
  // cada `input`) tira o âncora assim que chegam caracteres de verdade.
  //
  // Clicar o MESMO botão de novo antes de digitar desfaz o pendente em vez
  // de empilhar outro em cima (senão duas tags vazias ficariam soltas no
  // documento). Clicar um botão DIFERENTE descarta o pendente anterior
  // (que ainda não tem conteúdo real) antes de criar o novo.
  #toggleEmptyWrap(range, tagName, className) {
    if (
      this.#pendingWrap !== null &&
      this.#pendingWrap.tagName === tagName &&
      this.#pendingWrap.className === className &&
      this.#isEmptyWrap(this.#pendingWrap.element) &&
      this.#pendingWrap.element.contains(range.startContainer)
    ) {
      this.#undoPendingWrap();
      return;
    }

    this.#discardStaleWrap();

    const wrapper = document.createElement(tagName);
    const marker = document.createTextNode(ZERO_WIDTH);

    this.#setClasses(wrapper, className);
    wrapper.appendChild(marker);
    range.insertNode(wrapper);

    const selection = window.getSelection();
    const caret = document.createRange();

    caret.setStart(marker, marker.length);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);

    this.#pendingWrap = { tagName, className, element: wrapper };
  }

  #isEmptyWrap(element) {
    return element.isConnected && element.textContent.replaceAll(ZERO_WIDTH, '') === '';
  }

  #undoPendingWrap() {
    const { element } = this.#pendingWrap;
    const parent = element.parentNode;
    const index = [...parent.childNodes].indexOf(element);

    element.remove();

    const selection = window.getSelection();
    const caret = document.createRange();

    caret.setStart(parent, index);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);

    this.#pendingWrap = null;
  }

  // Descarta um formato pendente esquecido (o usuário clicou o botão, não
  // digitou nada, e seguiu para outra coisa — outro botão, outra seleção,
  // ou saiu do campo). Só remove do DOM se ainda estiver vazio; se de
  // alguma forma já ganhou conteúdo real, apenas solta a referência sem
  // apagar o que o usuário escreveu.
  #discardStaleWrap() {
    if (this.#pendingWrap === null) {
      return;
    }

    if (this.#isEmptyWrap(this.#pendingWrap.element)) {
      this.#pendingWrap.element.remove();
    }

    this.#pendingWrap = null;
  }

  // Chamado a cada `input`: se existe um formato pendente e o usuário
  // digitou de verdade dentro dele, tira o `ZERO_WIDTH` (ele não pode
  // sobreviver em `value`) sem perturbar a posição do caret para quem
  // continua digitando.
  #commitPendingWrap() {
    if (this.#pendingWrap === null) {
      return;
    }

    const { element } = this.#pendingWrap;

    if (!element.isConnected) {
      this.#pendingWrap = null;
      return;
    }

    if (this.#isEmptyWrap(element)) {
      return;
    }

    const marker = [...element.childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE && node.data.includes(ZERO_WIDTH),
    );

    if (marker) {
      const selection = window.getSelection();
      const current = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const caretInMarker = current !== null && current.collapsed && current.startContainer === marker;
      const caretOffset = caretInMarker ? current.startOffset : null;

      marker.data = marker.data.replace(ZERO_WIDTH, '');

      if (caretInMarker) {
        const restored = document.createRange();

        restored.setStart(marker, Math.max(0, caretOffset - ZERO_WIDTH.length));
        restored.collapse(true);
        selection.removeAllRanges();
        selection.addRange(restored);
      }
    }

    this.#pendingWrap = null;
  }

  #stripZeroWidth(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (node.data.includes(ZERO_WIDTH)) {
        node.data = node.data.replaceAll(ZERO_WIDTH, '');
      }
    }
  }

  // Uma seleção collapsada (ou contida num único bloco) converte só aquele
  // bloco — comportamento inalterado desde a primeira versão. Uma seleção
  // que toca vários blocos de nível superior converte TODOS eles: é o que
  // `document.execCommand('formatBlock', ...)` já fazia no editor antigo, e
  // perder isso seria regressão. "Já são todos da tag pedida" desfaz o lote
  // inteiro de volta para DIV; senão, cada bloco vira a tag pedida.
  #block(tagName, className) {
    const range = this.#range();

    if (range === null) {
      return;
    }

    const blocks = this.#blocksInRange(range);

    if (range.collapsed || blocks.length <= 1) {
      const current = this.#blockOf(range.startContainer);

      if (current === null) {
        this.#insertEmptyBlock(tagName, range.startOffset, null, className);
        return;
      }

      const same = this.#matchesBlock(current, tagName, className);
      const replacements = this.#convertToBlock(current, same ? 'DIV' : tagName, same ? '' : className);

      this.#selectRun(replacements);
      return;
    }

    const allSame = blocks.every((block) => this.#matchesBlock(block, tagName, className));
    const replacements = blocks.flatMap((block) =>
      this.#convertToBlock(block, allSame ? 'DIV' : tagName, allSame ? '' : className),
    );

    this.#selectRun(replacements);
  }

  // Um bloco que já é <ul>/<ol> não pode ter seus <li> despejados soltos
  // dentro de um H2/citação/pre — <li> só é válido dentro de <ul>/<ol>/
  // <menu>. Por isso, quando `current` é uma lista, cada <li> vira o SEU
  // PRÓPRIO bloco de destino (um H2 por item, por exemplo), em vez de um
  // único bloco recebendo todos os <li> como filhos diretos. Sempre retorna
  // um array porque esse é o único caso em que um bloco de origem vira mais
  // de um bloco de saída.
  #convertToBlock(current, targetTag, className) {
    if (this.#isList(current)) {
      const replacements = [...current.children].map((item) => {
        const replacement = document.createElement(targetTag);

        this.#setClasses(replacement, className);
        replacement.append(...item.childNodes);
        return replacement;
      });

      current.replaceWith(...replacements);
      return replacements;
    }

    const replacement = document.createElement(targetTag);

    this.#setClasses(replacement, className);
    replacement.append(...(current.nodeType === Node.TEXT_NODE ? [current.cloneNode()] : current.childNodes));
    current.replaceWith(replacement);
    return [replacement];
  }

  // `current` (o bloco de nível superior sob o caret) nunca é um <li> — ele
  // está um nível abaixo da <ul>/<ol>, que é o próprio filho direto de
  // #editor. Por isso o "toggle" de lista compara `current` com a lista
  // inteira: mesma tag desfaz (cada <li> volta a ser um bloco comum), tag
  // diferente troca UL<->OL mantendo os itens, e qualquer outro bloco vira
  // uma lista nova de um item só.
  //
  // Seleção collapsada (ou contida num único bloco) usa exatamente essa
  // lógica de sempre (#listSingle). Uma seleção que toca vários blocos
  // produz UMA lista só, com um <li> por bloco — é o que
  // `document.execCommand('insertUnorderedList')` já fazia; uma lista por
  // bloco selecionado seria regressão.
  #list(tagName, className) {
    const range = this.#range();

    if (range === null) {
      return;
    }

    const blocks = this.#blocksInRange(range);

    if (range.collapsed || blocks.length <= 1) {
      this.#listSingle(this.#blockOf(range.startContainer), tagName, className, range.startOffset);
      return;
    }

    const allSame = blocks.every((block) => this.#matchesBlock(block, tagName, className));

    if (allSame) {
      const paragraphs = blocks.flatMap((block) =>
        [...block.children].map((item) => {
          const paragraph = document.createElement('DIV');

          paragraph.append(...item.childNodes);
          return paragraph;
        }),
      );

      blocks[0].before(...paragraphs);
      blocks.forEach((block) => block.remove());
      this.#selectRun(paragraphs);
      return;
    }

    // Um bloco que já é <ul>/<ol> (seleção mista: parte de uma lista +
    // parágrafo comum) não pode virar o conteúdo de um <li> — um <li> não
    // pode conter outro <li> diretamente, só dentro de um <ul>/<ol>. Por
    // isso seus próprios <li> entram soltos na lista nova, sem um <li>
    // extra por cima.
    const list = this.#createList(tagName, className);

    for (const block of blocks) {
      if (this.#isList(block)) {
        this.#adoptItems(list, [...block.children]);
        continue;
      }

      const item = document.createElement('LI');

      item.append(...(block.nodeType === Node.TEXT_NODE ? [block.cloneNode()] : block.childNodes));
      list.appendChild(item);
    }

    blocks[0].before(list);
    blocks.forEach((block) => block.remove());
    this.#selectRun([list]);
  }

  #listSingle(current, tagName, className, startOffset) {
    if (current === null) {
      this.#insertEmptyBlock(tagName, startOffset, 'LI', className);
      return;
    }

    if (this.#matchesBlock(current, tagName, className)) {
      const paragraphs = [...current.children].map((item) => {
        const paragraph = document.createElement('DIV');

        paragraph.append(...item.childNodes);
        return paragraph;
      });

      current.replaceWith(...paragraphs);
      this.#select(paragraphs[0] ?? current);
      return;
    }

    if (this.#isList(current)) {
      const list = this.#createList(tagName, className);

      this.#adoptItems(list, [...current.children]);
      current.replaceWith(list);
      this.#select(list);
      return;
    }

    const list = this.#createList(tagName, className);
    const item = document.createElement('LI');

    item.append(...(current.nodeType === Node.TEXT_NODE ? [current.cloneNode()] : current.childNodes));
    list.appendChild(item);
    current.replaceWith(list);
    this.#select(item);
  }

  #createList(tagName, className) {
    const list = document.createElement(tagName);

    this.#setClasses(list, className);
    return list;
  }

  #adoptItems(list, items) {
    const keepsChecks = list.classList.contains('checklist');

    for (const item of items) {
      if (!keepsChecks) {
        item.removeAttribute('class');
      }

      list.appendChild(item);
    }
  }

  #toggleCheck(event) {
    const item = event.target;

    if (
      item.nodeName !== 'LI' ||
      !item.parentNode.classList.contains('checklist') ||
      !this.#editor.contains(item) ||
      event.offsetX > CHECKBOX_HIT_WIDTH
    ) {
      return;
    }

    this.#history.commit(this.value);

    if (item.classList.contains('checked')) {
      item.removeAttribute('class');
    } else {
      item.className = 'checked';
    }

    this.#syncHistory();
  }

  #uncheckSplitItem() {
    const selection = window.getSelection();
    const anchor = selection.anchorNode;

    if (anchor === null || !this.#editor.contains(anchor)) {
      return;
    }

    const element = anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement;
    const item = element.closest('ul.checklist > li.checked');

    if (item !== null && this.#editor.contains(item)) {
      item.removeAttribute('class');
    }
  }

  #divider() {
    const range = this.#range();

    if (range === null) {
      return;
    }

    const rule = document.createElement('HR');
    const next = document.createElement('DIV');

    next.appendChild(document.createElement('BR'));

    const current = this.#blockOf(range.startContainer);

    if (current === null) {
      const reference = this.#editor.childNodes[range.startOffset] ?? null;

      this.#editor.insertBefore(next, reference);
      this.#editor.insertBefore(rule, next);
    } else {
      current.after(rule, next);
    }

    this.#placeCaret(next);
  }

  // Seleciona do início do primeiro nó ao fim do último, para que um
  // segundo comando (ex.: alternar a mesma tag de novo) se aplique ao lote
  // inteiro sem o usuário precisar reselecionar.
  #selectRun(nodes) {
    if (nodes.length === 0) {
      return;
    }

    const selection = window.getSelection();
    const range = document.createRange();
    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    range.setStart(first, 0);
    range.setEnd(last, last.childNodes.length);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // Caso o editor esteja vazio (ou o caret esteja diretamente sobre o
  // #editor, sem nenhum bloco ainda), cria o bloco pedido na posição do
  // caret. Um bloco recém-criado sem nenhum filho não recebe o caret de
  // verdade no Chromium ao digitar em seguida — o texto acaba inserido
  // como irmão, fora do bloco — por isso ele ganha um <br> temporário, que
  // o próprio navegador remove assim que o usuário digita algo.
  #insertEmptyBlock(tagName, atOffset, innerTagName, className) {
    const outer = document.createElement(tagName);
    const target = innerTagName ? document.createElement(innerTagName) : outer;

    this.#setClasses(outer, className);

    if (innerTagName) outer.appendChild(target);
    target.appendChild(document.createElement('BR'));

    const reference = this.#editor.childNodes[atOffset] ?? null;

    this.#editor.insertBefore(outer, reference);
    this.#placeCaret(target);
  }

  #placeCaret(node) {
    const selection = window.getSelection();
    const range = document.createRange();

    range.setStart(node, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  #link() {
    const range = this.#range();

    if (range === null || range.collapsed) {
      return;
    }

    const text = range.toString();
    const subRanges = this.#splitByBlocks(range);

    void Promise.resolve(this.#onLink ? this.#onLink(text) : null).then((href) => {
      if (!href) {
        return;
      }

      for (const sub of subRanges) {
        if (sub.collapsed) continue;

        const anchor = document.createElement('a');

        anchor.href = href;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.appendChild(sub.extractContents());
        sub.insertNode(anchor);
      }

      this.#count();
      this.#syncHistory();
    });
  }

  // "Limpar formatação" desfaz as tags inline (negrito, itálico, sublinhado,
  // riscado, link) que tocam a seleção. Apagar e reinserir só o texto (como
  // no rascunho original) não funciona: um Range que cobre "todo o texto de
  // dentro de um <strong>" fica com startContainer/endContainer dentro do
  // próprio nó de texto, então deleteContents()+insertNode() recriam o texto
  // como filho do mesmo <strong> — a formatação nunca sai. Por isso aqui
  // desembrulhamos (replaceWith(...childNodes)) cada elemento inline que a
  // seleção intercepta, incluindo o caso em que o próprio bloco de nível
  // superior É a tag inline (texto formatado antes de qualquer Enter).
  #clear() {
    const range = this.#range();

    if (range === null || range.collapsed) {
      return;
    }

    for (const block of this.#blocksInRange(range)) {
      if (block.nodeType !== Node.ELEMENT_NODE) continue;

      const candidates = INLINE_TAGS.includes(block.nodeName)
        ? [block, ...block.querySelectorAll(INLINE_TAGS.join(','))]
        : [...block.querySelectorAll(INLINE_TAGS.join(','))];

      for (const element of candidates) {
        if (range.intersectsNode(element)) {
          element.replaceWith(...element.childNodes);
        }
      }
    }
  }

  #insertText(text) {
    const range = this.#range();

    if (range === null) {
      this.#editor.append(document.createTextNode(text));
      return;
    }

    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
  }

  #select(node) {
    const selection = window.getSelection();
    const range = document.createRange();

    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  #count() {
    this.#commitPendingWrap();

    const total = this.words;

    this.#counter.textContent = `${total} ${total === 1 ? 'palavra' : 'palavras'}`;
  }
}
