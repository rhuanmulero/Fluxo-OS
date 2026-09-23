import sanitizeHtml from 'sanitize-html';
import { Transform } from 'class-transformer';

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'div',
    'br',
    'hr',
    'b',
    'strong',
    'i',
    'em',
    'u',
    's',
    'mark',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
    'h1',
    'h2',
    'h3',
    'a',
    'span',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    span: ['class'],
  },
  allowedClasses: {
    ul: ['checklist'],
    li: ['checked'],
    div: ['callout', 'callout-info', 'callout-warning', 'callout-success'],
    mark: ['hl-yellow', 'hl-green', 'hl-pink', 'hl-blue'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
};

export function sanitizeRichText(value: string): string {
  return sanitizeHtml(value, OPTIONS);
}

export const SanitizeRichText = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? sanitizeRichText(value) : value,
  );
