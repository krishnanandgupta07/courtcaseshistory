function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const RULE_PLACEHOLDER = '\n%%HC_RULE%%\n';

function isRuleToken(line: string): boolean {
  return line.trim() === '%%HC_RULE%%';
}

function isRuleChars(value: string): boolean {
  const compact = value.replace(/[\s#*_]/g, '');
  return compact.length >= 4 && /^[=_\-─—]+$/.test(compact);
}

function stripHeadingMarks(line: string): string {
  return line
    .replace(/^\s{0,3}#{1,6}\s*/, '')
    .replace(/^\s*>\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .trim();
}

/** Turn **bold** / __bold__ into HTML after escaping; drop leftover markdown marks. */
function formatInline(raw: string): string {
  let source = stripHeadingMarks(raw).replace(/`+/g, '');
  source = source.replace(/^\s*#+\s*/, '');
  const chunks: string[] = [];
  const pattern = /\*\*(.+?)\*\*|__(.+?)__/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    chunks.push(escapeHtml(source.slice(lastIndex, match.index)));
    chunks.push(`<strong>${escapeHtml(match[1] || match[2] || '')}</strong>`);
    lastIndex = match.index + match[0].length;
  }
  chunks.push(escapeHtml(source.slice(lastIndex)));
  return chunks
    .join('')
    .replace(/\*{1,2}/g, '')
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPageMarker(line: string): boolean {
  return /^\s*\[\s*\d+\s*\]\s*$/.test(line) || /^(?:page\s+)?\d+\s*(?:of|\/)\s*\d+$/i.test(line);
}

function isCourtName(line: string): boolean {
  return /\bin the (high |supreme |district )?court\b|\bhigh court of\b|\bsupreme court of india\b|\bhigh court for the state\b/i.test(
    line,
  );
}

function isCauseNumber(line: string): boolean {
  if (line.length > 180) return false;
  return (
    /^(r\/|c\/)/i.test(line) ||
    (/\b(writ petition|special civil application|letters patent|first appeal|criminal appeal|civil appeal|wppil|wp\(c\)|pil)\b/i.test(
      line,
    ) &&
      /\b(no\.?|number)\b/i.test(line))
  );
}

function isVersus(line: string): boolean {
  return /^(versus|vs\.?|v\/s\.?|v\.)$/i.test(line);
}

function isJudgeLine(line: string): boolean {
  return line.length < 160 && /^(the\s+)?(honou?r?able|hon'?ble)\b/i.test(line);
}

function isLabeledLine(line: string, label: string): boolean {
  return new RegExp(`^${label}\\s*:`, 'i').test(line);
}

function isJudgmentHeading(line: string): boolean {
  return (
    /^(oral\s+)?(judgment|judgement|order)\s*$/i.test(line) ||
    /^(oral judgment|cav judgment|oral order)\b/i.test(line) ||
    /^the court made the following/i.test(line)
  );
}

function wrap(tagClass: string, inner: string, tag = 'p'): string {
  return `<${tag} class="${tagClass}">${inner}</${tag}>`;
}

/**
 * Convert eCourts markdown / PDF-extract text into High Court order-sheet HTML
 * (centered caption, thin double rules, no raw # / ** / ======).
 */
export function formatCourtOrderHtml(markdown: string): string {
  const prepared = markdown
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[=\u2550\u2500_\-]{4,}/g, RULE_PLACEHOLDER)
    .replace(/\n{3,}/g, '\n\n');

  const lines = prepared.split('\n').map((line) => line.trimEnd());
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let causeOpen = false;
  let inAppearance = false;
  let inPreamble = true;
  let sawCauseBlock = false;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const text = formatInline(paragraph.join(' '));
    if (text) {
      blocks.push(wrap('order-para', text));
      inPreamble = false;
    }
    paragraph = [];
  }

  function openCauseTitle() {
    if (causeOpen) return;
    flushParagraph();
    blocks.push('<div class="cause-title">');
    causeOpen = true;
  }

  function closeCauseTitle() {
    if (!causeOpen) return;
    blocks.push('</div>');
    causeOpen = false;
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushParagraph();
      inAppearance = false;
      continue;
    }
    if (isPageMarker(trimmed)) continue;

    if (isRuleToken(trimmed) || isRuleChars(trimmed)) {
      flushParagraph();
      inAppearance = false;
      if (causeOpen) {
        closeCauseTitle();
        sawCauseBlock = true;
        blocks.push('<hr class="hc-rule" />');
      } else if (!sawCauseBlock) {
        openCauseTitle();
        blocks.push('<hr class="hc-rule" />');
      } else {
        blocks.push('<hr class="hc-rule" />');
      }
      continue;
    }

    const inner = formatInline(trimmed);
    if (!inner) continue;

    const plain = inner.replace(/<[^>]+>/g, '').trim();

    if (inPreamble && isCourtName(plain)) {
      flushParagraph();
      closeCauseTitle();
      inAppearance = false;
      blocks.push(wrap('court-name', inner));
      continue;
    }

    if (inPreamble && isCauseNumber(plain)) {
      flushParagraph();
      closeCauseTitle();
      inAppearance = false;
      blocks.push(wrap('cause-number', inner));
      continue;
    }

    if (inPreamble && isJudgeLine(plain)) {
      flushParagraph();
      inAppearance = false;
      blocks.push(wrap('judge-line', inner));
      continue;
    }

    if (isVersus(plain)) {
      if (!causeOpen) openCauseTitle();
      flushParagraph();
      inAppearance = false;
      blocks.push(wrap('versus', inner));
      continue;
    }

    if (isLabeledLine(plain, 'CORAM')) {
      flushParagraph();
      closeCauseTitle();
      inAppearance = false;
      blocks.push(wrap('coram', inner));
      continue;
    }

    if (isLabeledLine(plain, 'Appearance')) {
      flushParagraph();
      closeCauseTitle();
      inAppearance = true;
      blocks.push(wrap('appearance', inner));
      continue;
    }

    if (isLabeledLine(plain, 'Date')) {
      flushParagraph();
      closeCauseTitle();
      inAppearance = false;
      blocks.push(wrap('order-date-line', inner));
      continue;
    }

    if (isJudgmentHeading(plain)) {
      flushParagraph();
      closeCauseTitle();
      inAppearance = false;
      inPreamble = false;
      blocks.push(wrap('judgment-heading', inner));
      continue;
    }

    if (inAppearance) {
      flushParagraph();
      blocks.push(wrap('appearance', inner));
      continue;
    }

    if (causeOpen) {
      flushParagraph();
      blocks.push(wrap('cause-party', inner));
      continue;
    }

    paragraph.push(stripHeadingMarks(trimmed));
  }

  flushParagraph();
  closeCauseTitle();

  return blocks.join('\n') || '<p class="order-para">No order text is available for this document.</p>';
}

export function courtOrderSheetCss(): string {
  return `
    .order-sheet {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14px;
      line-height: 1.7;
      color: #1a1a1a;
      max-width: 46rem;
      margin: 0 auto;
    }
    .court-name {
      text-align: center;
      font-weight: 700;
      font-size: 16px;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      margin: 0 0 8px;
    }
    .cause-number {
      text-align: center;
      font-weight: 700;
      font-size: 14px;
      margin: 0 0 12px;
    }
    .judge-line {
      text-align: center;
      font-weight: 700;
      margin: 0;
    }
    .hc-rule {
      border: 0;
      height: 0;
      margin: 8px 0;
      border-top: 2px solid #1C2B4A;
      border-bottom: 1px solid #1C2B4A;
    }
    .cause-title {
      margin: 0;
    }
    .cause-party {
      text-align: center;
      font-weight: 600;
      margin: 2px 0;
    }
    .versus {
      text-align: center;
      font-weight: 700;
      font-style: italic;
      margin: 8px 0;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .coram, .appearance, .order-date-line {
      margin: 10px 0 4px;
      text-align: left;
    }
    .order-date-line {
      text-align: right;
      font-weight: 700;
    }
    .judgment-heading {
      text-align: center;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      text-decoration: underline;
      text-underline-offset: 4px;
      margin: 18px 0 12px;
    }
    .order-para {
      text-align: justify;
      margin: 0 0 10px;
    }
  `;
}
