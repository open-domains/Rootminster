// Observer evidence is plain text scraped from the flagged page. Older findings
// still carry raw HTML entities and run every matched rule together on one line,
// so tidy both up before showing them to staff. The result is rendered as text,
// never as HTML.

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', bull: '•', middot: '·',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»',
  copy: '©', reg: '®', trade: '™', deg: '°', times: '×',
};

export function decodeEntities(value) {
  return String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X'
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

// "Matched multiple rules (A, B). A: …; B: …" → one line per rule.
const LEGACY_MIXED = /^(Matched multiple rules \([^)]*\)\.)\s+([\s\S]*)$/;
const LEGACY_RULE_BREAK = /;\s+(?=\d+(?:\.\d+)*\.?\s+[^:;]{2,60}:\s)/g;

export function readableEvidence(value) {
  const text = decodeEntities(value).replace(/[ \t ]+/g, ' ').trim();
  const legacy = text.match(LEGACY_MIXED);
  if (!legacy) return text;
  const rules = legacy[2].split(LEGACY_RULE_BREAK).map((rule) => `• ${rule.trim()}`);
  return [legacy[1], ...rules].join('\n');
}
