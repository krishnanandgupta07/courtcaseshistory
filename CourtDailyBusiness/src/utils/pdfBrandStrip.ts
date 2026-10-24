/** Shared left-edge brand strip for printable case PDFs. */
export const PDF_DAILY_BUSINESS_URL = 'https://courtdailybusiness.com/';
export const PDF_LIVE_STREAM_URL = 'https://courtlivestream.com/';

const PDF_BRAND_LINKS = [
  { url: PDF_DAILY_BUSINESS_URL, label: PDF_DAILY_BUSINESS_URL },
  { url: PDF_LIVE_STREAM_URL, label: PDF_LIVE_STREAM_URL },
  { url: PDF_DAILY_BUSINESS_URL, label: PDF_DAILY_BUSINESS_URL },
  { url: PDF_LIVE_STREAM_URL, label: PDF_LIVE_STREAM_URL },
] as const;

export function pdfBrandStripCss(): string {
  return `
    .site-strip {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: 26px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      background: #D4D4D4;
      border-right: 1px solid #A3A3A3;
      box-shadow: 2px 0 8px rgba(0, 0, 0, 0.08);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .site-strip a {
      flex: 1 1 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
      padding: 6px 0;
      background: #D4D4D4;
      color: #111111;
      text-decoration: none;
      border-bottom: 1px solid #B0B0B0;
      transition: background 0.15s ease;
    }
    .site-strip a:last-child { border-bottom: 0; }
    .site-strip a:nth-child(odd) { background: #D4D4D4; }
    .site-strip a:nth-child(even) { background: #C8C8C8; }
    .site-strip a:hover { background: #BDBDBD; }
    .site-strip a span {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      color: #111111;
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.12em;
      line-height: 1;
      white-space: nowrap;
    }
    body.has-site-strip { margin-left: 44px; }
    @media print {
      .site-strip {
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
      }
      body.has-site-strip { margin: 12px 12px 12px 38px; }
    }
  `;
}

export function pdfBrandStripHtml(): string {
  const links = PDF_BRAND_LINKS.map(
    (item) =>
      `<a href="${item.url}" target="_blank" rel="noopener noreferrer" title="${item.label}"><span>${item.label}</span></a>`,
  ).join('');

  return `<nav class="site-strip" aria-label="Related websites">${links}</nav>`;
}
