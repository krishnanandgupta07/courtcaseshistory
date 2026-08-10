/** Shared left-edge brand strip for printable case PDFs. */
export const PDF_BRAND_URL = 'https://courtlivestream.com/';
export const PDF_BRAND_LABEL = 'https://courtlivestream.com/';

export function pdfBrandStripCss(): string {
  return `
    .site-strip {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: 22px;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1C2B4A;
      text-decoration: none;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .site-strip span {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      color: #F6F1E6;
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }
    .site-strip:hover { background: #121C31; }
    body.has-site-strip { margin-left: 40px; }
    @media print {
      .site-strip {
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
      }
      body.has-site-strip { margin: 12px 12px 12px 34px; }
    }
  `;
}

export function pdfBrandStripHtml(): string {
  return `<a class="site-strip" href="${PDF_BRAND_URL}" target="_blank" rel="noopener noreferrer" title="${PDF_BRAND_LABEL}">
  <span>${PDF_BRAND_LABEL}</span>
</a>`;
}
