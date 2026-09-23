import TurndownService from 'turndown';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { jsPDF } from 'jspdf';

const CALLOUT_LABELS = {
  'callout-info': 'Informação',
  'callout-warning': 'Aviso',
  'callout-success': 'Sucesso',
};

function calloutLabelOf(element) {
  const kind = [...element.classList].find((name) => name in CALLOUT_LABELS);

  return CALLOUT_LABELS[kind] ?? 'Destaque';
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  hr: '---',
});

turndown.addRule('checklistItem', {
  filter: (node) => node.nodeName === 'LI' && node.parentNode.classList.contains('checklist'),
  replacement: (content, node) => {
    const box = node.classList.contains('checked') ? '[x]' : '[ ]';
    const text = content.replace(/^\n+/, '').replace(/\n+$/, '\n');

    return `- ${box} ${text}${node.nextSibling && !/\n$/.test(text) ? '\n' : ''}`;
  },
});

turndown.addRule('highlight', {
  filter: 'mark',
  replacement: (content) => `==${content}==`,
});

turndown.addRule('callout', {
  filter: (node) => node.nodeName === 'DIV' && node.classList.contains('callout'),
  replacement: (content, node) => {
    const body = content.trim().replace(/\n/g, '\n> ');

    return `\n\n> **${calloutLabelOf(node)}:** ${body}\n\n`;
  },
});

const PDF_MARGIN = 56;
const PDF_LINE = 16;
const PDF_PAGE_HEIGHT = 792;

function fileNameOf(note, extension) {
  const clean = note.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim();

  return `${clean === '' ? 'nota' : clean}.${extension}`;
}

function save(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}

function asMarkdown(note) {
  return `# ${note.title}\n\n${turndown.turndown(note.body ?? '')}\n`;
}

function blockOf(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.trim();

    return text === '' ? [] : [{ tag: 'P', text }];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }

  if (node.tagName === 'UL' && node.classList.contains('checklist')) {
    return [
      {
        tag: 'CHECKLIST',
        items: [...node.children].map((item) => ({
          text: item.textContent.trim(),
          checked: item.classList.contains('checked'),
        })),
      },
    ];
  }

  if (node.tagName === 'UL' || node.tagName === 'OL') {
    return [{ tag: node.tagName, items: [...node.children].map((item) => item.textContent.trim()) }];
  }

  if (node.tagName === 'DIV' && node.classList.contains('callout')) {
    return [{ tag: 'CALLOUT', label: calloutLabelOf(node), text: node.textContent.trim() }];
  }

  return [{ tag: node.tagName, text: node.textContent.trim() }];
}

function blocksOf(note) {
  const holder = document.createElement('div');

  holder.innerHTML = note.body ?? '';

  return [...holder.childNodes].flatMap(blockOf);
}

const NUMBERED_LIST_REFERENCE = 'fluxo-note-numbered-list';

const DOCX_HEADINGS = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
};

function docxParagraphsOf(block) {
  if (DOCX_HEADINGS[block.tag]) {
    return [new Paragraph({ text: block.text, heading: DOCX_HEADINGS[block.tag] })];
  }

  if (block.tag === 'UL') {
    return block.items.map((item) => new Paragraph({ text: item, bullet: { level: 0 } }));
  }

  if (block.tag === 'OL') {
    return block.items.map(
      (item) =>
        new Paragraph({ text: item, numbering: { reference: NUMBERED_LIST_REFERENCE, level: 0 } }),
    );
  }

  if (block.tag === 'CHECKLIST') {
    return block.items.map((item) => new Paragraph({ text: `${item.checked ? '☑' : '☐'} ${item.text}` }));
  }

  if (block.tag === 'CALLOUT') {
    return [
      new Paragraph({
        children: [new TextRun({ text: `${block.label}: `, bold: true }), new TextRun(block.text)],
      }),
    ];
  }

  if (block.tag === 'HR') {
    return [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } },
      }),
    ];
  }

  if (block.tag === 'PRE') {
    return [new Paragraph({ children: [new TextRun({ text: block.text, font: 'Courier New' })] })];
  }

  return [new Paragraph({ text: block.text })];
}

function toDocx(note) {
  const paragraphs = [
    new Paragraph({ text: note.title, heading: HeadingLevel.TITLE }),
    ...blocksOf(note).flatMap(docxParagraphsOf),
  ];

  return new Document({
    numbering: {
      config: [
        {
          reference: NUMBERED_LIST_REFERENCE,
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START }],
        },
      ],
    },
    sections: [{ children: paragraphs }],
  });
}

function toPdf(note) {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const width = pdf.internal.pageSize.getWidth() - PDF_MARGIN * 2;
  let cursor = PDF_MARGIN;

  const ensureRoom = () => {
    if (cursor > PDF_PAGE_HEIGHT - PDF_MARGIN) {
      pdf.addPage();
      cursor = PDF_MARGIN;
    }
  };

  const write = (text, size, style) => {
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);

    for (const line of pdf.splitTextToSize(text, width)) {
      ensureRoom();
      pdf.text(line, PDF_MARGIN, cursor);
      cursor += PDF_LINE;
    }

    cursor += 6;
  };

  const rule = () => {
    ensureRoom();
    pdf.setDrawColor(150);
    pdf.line(PDF_MARGIN, cursor - 6, PDF_MARGIN + width, cursor - 6);
    cursor += 10;
  };

  write(note.title, 18, 'bold');

  for (const block of blocksOf(note)) {
    if (block.tag === 'H1' || block.tag === 'H2') write(block.text, 14, 'bold');
    else if (block.tag === 'H3') write(block.text, 12, 'bold');
    else if (block.tag === 'UL') {
      for (const item of block.items) write(`• ${item}`, 11, 'normal');
    } else if (block.tag === 'OL') {
      block.items.forEach((item, index) => write(`${index + 1}. ${item}`, 11, 'normal'));
    } else if (block.tag === 'CHECKLIST') {
      for (const item of block.items) write(`${item.checked ? '[x]' : '[ ]'} ${item.text}`, 11, 'normal');
    } else if (block.tag === 'CALLOUT') write(`${block.label}: ${block.text}`, 11, 'bold');
    else if (block.tag === 'HR') rule();
    else write(block.text, 11, 'normal');
  }

  return pdf;
}

export async function exportNote(note, format) {
  if (format === 'md') {
    save(new Blob([asMarkdown(note)], { type: 'text/markdown' }), fileNameOf(note, 'md'));
    return;
  }

  if (format === 'docx') {
    save(await Packer.toBlob(toDocx(note)), fileNameOf(note, 'docx'));
    return;
  }

  if (format === 'pdf') {
    save(toPdf(note).output('blob'), fileNameOf(note, 'pdf'));
    return;
  }

  throw new Error(`Formato de exportação desconhecido: ${format}`);
}
