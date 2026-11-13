// Render the supported Markdown syntax with DOM nodes; raw HTML stays text.
function inline(parent, text) {
  const tokens = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
  let offset = 0;
  for (const match of text.matchAll(tokens)) {
    parent.append(text.slice(offset, match.index));
    const element = document.createElement(match[1] ? 'code' : match[2] ? 'strong' : 'em');
    element.textContent = match[1] ?? match[2] ?? match[3];
    parent.append(element);
    offset = match.index + match[0].length;
  }
  parent.append(text.slice(offset));
}

export function renderNamiMarkdown(parent, source) {
  // Split fences first so formatting never alters code.
  const parts = source.replace(/\\`/g, '`').split('```');
  for (const [index, part] of parts.entries()) {
    if (index % 2) {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = part.replace(/^[\w+#.-]+[ \t]*(?:\r?\n|[ \t]+)/, '').replace(/^\r?\n|\r?\n$/g, '');
      pre.append(code);
      parent.append(pre);
      continue;
    }

    const prose = part.replace(/\\\*/g, '*')
      .replace(/[ \t]+(?=#{1,6}[ \t]+\S)/g, '\n')
      .replace(/[ \t]+(?=\* \*\*)/g, '\n')
      .replace(/[ \t]+---[ \t]+/g, '\n---\n');
    let list;
    let paragraph;
    for (const line of prose.split(/\r?\n/)) {
      const value = line.trim();
      const item = /^(?:([-*+])|(\d+)\.)\s+(.+)$/.exec(value);
      if (item) {
        paragraph = null;
        const type = item[2] ? 'ol' : 'ul';
        if (list?.localName !== type) {
          list = document.createElement(type);
          if (item[2]) list.start = Number(item[2]);
          parent.append(list);
        }
        const entry = document.createElement('li');
        inline(entry, item[3]);
        list.append(entry);
        continue;
      }
      list = null;
      if (!value) {
        paragraph = null;
        continue;
      }
      const heading = /^(#{1,6})\s+(.+)$/.exec(value);
      const quote = /^>\s*(.+)$/.exec(value);
      if (heading || quote || /^(?:-{3,}|\*{3,})$/.test(value)) {
        paragraph = null;
        const block = document.createElement(heading ? 'h' + Math.max(3, heading[1].length) : quote ? 'blockquote' : 'hr');
        if (heading || quote) inline(block, heading?.[2] ?? quote[1]);
        parent.append(block);
        continue;
      }
      if (!paragraph) {
        paragraph = document.createElement('p');
        parent.append(paragraph);
      } else {
        paragraph.append(document.createElement('br'));
      }
      inline(paragraph, value);
    }
  }
}
