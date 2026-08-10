/**
 * Generates static SEO pages for MilesWeb (court landings, guides, sitemap).
 * Run via: npm run generate:seo  (also runs before build)
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const caseHistoryDir = join(publicDir, 'case-history');

const SITE_URL = 'https://courtcasehistory.com';
const SITE_NAME = 'Court Case History';

/** Mirrors src/seo/site.ts — keep in sync when adding courts. */
const SEO_COURTS = [
  { slug: 'supreme-court-of-india', name: 'Supreme Court of India', shortName: 'Supreme Court', courtType: 'supreme', appCourtName: 'Supreme Court', region: 'India' },
  { slug: 'allahabad-high-court', name: 'Allahabad High Court', shortName: 'Allahabad HC', courtType: 'high', appCourtName: 'Allahabad High Court', region: 'Uttar Pradesh' },
  { slug: 'andhra-pradesh-high-court', name: 'Andhra Pradesh High Court', shortName: 'Andhra Pradesh HC', courtType: 'high', appCourtName: 'Andhra Pradesh High Court', region: 'Andhra Pradesh' },
  { slug: 'bombay-high-court', name: 'Bombay High Court', shortName: 'Bombay HC', courtType: 'high', appCourtName: 'Bombay High Court', region: 'Maharashtra' },
  { slug: 'calcutta-high-court', name: 'Calcutta High Court', shortName: 'Calcutta HC', courtType: 'high', appCourtName: 'Calcutta High Court', region: 'West Bengal' },
  { slug: 'chhattisgarh-high-court', name: 'Chhattisgarh High Court', shortName: 'Chhattisgarh HC', courtType: 'high', appCourtName: 'Chhattisgarh High Court', region: 'Chhattisgarh' },
  { slug: 'delhi-high-court', name: 'Delhi High Court', shortName: 'Delhi HC', courtType: 'high', appCourtName: 'Delhi High Court', region: 'Delhi' },
  { slug: 'gauhati-high-court', name: 'Gauhati High Court', shortName: 'Gauhati HC', courtType: 'high', appCourtName: 'Gauhati High Court', region: 'Assam' },
  { slug: 'gujarat-high-court', name: 'Gujarat High Court', shortName: 'Gujarat HC', courtType: 'high', appCourtName: 'Gujarat High Court', region: 'Gujarat' },
  { slug: 'himachal-pradesh-high-court', name: 'Himachal Pradesh High Court', shortName: 'Himachal Pradesh HC', courtType: 'high', appCourtName: 'Himachal Pradesh High Court', region: 'Himachal Pradesh' },
  { slug: 'jammu-kashmir-ladakh-high-court', name: 'Jammu & Kashmir and Ladakh High Court', shortName: 'J&K and Ladakh HC', courtType: 'high', appCourtName: 'Jammu & Kashmir and Ladakh High Court', region: 'Jammu & Kashmir' },
  { slug: 'jharkhand-high-court', name: 'Jharkhand High Court', shortName: 'Jharkhand HC', courtType: 'high', appCourtName: 'Jharkhand High Court', region: 'Jharkhand' },
  { slug: 'karnataka-high-court', name: 'Karnataka High Court', shortName: 'Karnataka HC', courtType: 'high', appCourtName: 'Karnataka High Court', region: 'Karnataka' },
  { slug: 'kerala-high-court', name: 'Kerala High Court', shortName: 'Kerala HC', courtType: 'high', appCourtName: 'Kerala High Court', region: 'Kerala' },
  { slug: 'madhya-pradesh-high-court', name: 'Madhya Pradesh High Court', shortName: 'Madhya Pradesh HC', courtType: 'high', appCourtName: 'Madhya Pradesh High Court', region: 'Madhya Pradesh' },
  { slug: 'madras-high-court', name: 'Madras High Court', shortName: 'Madras HC', courtType: 'high', appCourtName: 'Madras High Court', region: 'Tamil Nadu' },
  { slug: 'manipur-high-court', name: 'Manipur High Court', shortName: 'Manipur HC', courtType: 'high', appCourtName: 'Manipur High Court', region: 'Manipur' },
  { slug: 'meghalaya-high-court', name: 'Meghalaya High Court', shortName: 'Meghalaya HC', courtType: 'high', appCourtName: 'Meghalaya High Court', region: 'Meghalaya' },
  { slug: 'orissa-high-court', name: 'Orissa High Court', shortName: 'Orissa HC', courtType: 'high', appCourtName: 'Orissa High Court', region: 'Odisha' },
  { slug: 'patna-high-court', name: 'Patna High Court', shortName: 'Patna HC', courtType: 'high', appCourtName: 'Patna High Court', region: 'Bihar' },
  { slug: 'punjab-and-haryana-high-court', name: 'Punjab and Haryana High Court', shortName: 'Punjab and Haryana HC', courtType: 'high', appCourtName: 'Punjab and Haryana High Court', region: 'Punjab and Haryana' },
  { slug: 'rajasthan-high-court', name: 'Rajasthan High Court', shortName: 'Rajasthan HC', courtType: 'high', appCourtName: 'Rajasthan High Court', region: 'Rajasthan' },
  { slug: 'sikkim-high-court', name: 'Sikkim High Court', shortName: 'Sikkim HC', courtType: 'high', appCourtName: 'Sikkim High Court', region: 'Sikkim' },
  { slug: 'telangana-high-court', name: 'Telangana High Court', shortName: 'Telangana HC', courtType: 'high', appCourtName: 'Telangana High Court', region: 'Telangana' },
  { slug: 'tripura-high-court', name: 'Tripura High Court', shortName: 'Tripura HC', courtType: 'high', appCourtName: 'Tripura High Court', region: 'Tripura' },
  { slug: 'uttarakhand-high-court', name: 'Uttarakhand High Court', shortName: 'Uttarakhand HC', courtType: 'high', appCourtName: 'Uttarakhand High Court', region: 'Uttarakhand' },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function searchUrl({ courtType, courtName, mode }) {
  const params = new URLSearchParams();
  if (mode) params.set('mode', mode);
  if (courtType) params.set('courtType', courtType);
  if (courtName) params.set('courtName', courtName);
  const q = params.toString();
  return q ? `/?${q}` : '/';
}

function layout({ title, description, canonicalPath, keywords, jsonLd, body }) {
  const canonical = `${SITE_URL}${canonicalPath}`;
  const schema = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-SHMEBRFH79"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-SHMEBRFH79');
  </script>
  ${schema.map((item) => `<script type="application/ld+json">${JSON.stringify(item)}</script>`).join('\n  ')}
  <style>
    :root { color-scheme: light; --navy:#1C2B4A; --navy-deep:#121C31; --brass:#C4A35A; --parchment:#F6F1E6; --ink:#2A2620; --ink-soft:#6B6455; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, 'Times New Roman', serif; background: var(--parchment); color: var(--ink); line-height: 1.6; }
    a { color: var(--navy); }
    header, footer { background: var(--navy-deep); color: var(--parchment); }
    header { padding: 1rem 1.25rem; }
    header a { color: var(--parchment); text-decoration: none; }
    .brand { font-size: 1.35rem; font-weight: 700; letter-spacing: 0.02em; }
    .wrap { width: min(920px, 100% - 2rem); margin: 0 auto; padding: 2rem 0 3rem; }
    h1 { color: var(--navy); font-size: clamp(1.75rem, 4vw, 2.35rem); line-height: 1.25; margin: 0 0 0.75rem; }
    h2 { color: var(--navy); font-size: 1.25rem; margin: 1.75rem 0 0.6rem; }
    p, li { color: var(--ink); }
    .lede { font-size: 1.05rem; color: var(--ink-soft); margin: 0 0 1.25rem; }
    .cta { display: inline-block; margin: 0.4rem 0.6rem 0.4rem 0; padding: 0.7rem 1.1rem; background: var(--navy); color: var(--parchment) !important; text-decoration: none; border-radius: 2px; font-weight: 700; font-family: system-ui, sans-serif; font-size: 0.95rem; }
    .cta.secondary { background: transparent; color: var(--navy) !important; border: 1px solid rgba(28,43,74,.25); }
    .card { background: #fff; border: 1px solid rgba(28,43,74,.12); padding: 1rem 1.1rem; margin: 1rem 0; border-radius: 2px; }
    .grid { display: grid; gap: 0.75rem; }
    @media (min-width: 700px) { .grid.cols-2 { grid-template-columns: 1fr 1fr; } }
    .court-list { columns: 1; gap: 1.5rem; }
    @media (min-width: 640px) { .court-list { columns: 2; } }
    .court-list a { display: block; padding: 0.2rem 0; text-decoration: none; }
    .court-list a:hover { text-decoration: underline; color: var(--brass); }
    .breadcrumb { font-family: system-ui, sans-serif; font-size: 0.85rem; color: var(--ink-soft); margin-bottom: 1rem; }
    .breadcrumb a { color: var(--ink-soft); }
    footer { padding: 1.5rem 1.25rem; font-size: 0.9rem; }
    footer a { color: var(--brass); }
    .muted { color: var(--ink-soft); font-size: 0.95rem; }
  </style>
</head>
<body>
  <header>
    <a class="brand" href="/">${SITE_NAME}</a>
  </header>
  <main class="wrap">
    ${body}
  </main>
  <footer>
    <div class="wrap" style="padding:0">
      <p><strong>${SITE_NAME}</strong> — search Indian court case status, CNR, orders, judgments and case history.</p>
      <p><a href="/case-history/">Browse courts</a> · <a href="/guides/how-to-search-by-cnr.html">CNR guide</a> · <a href="/">${SITE_URL.replace('https://', '')}</a></p>
    </div>
  </footer>
</body>
</html>`;
}

function relatedCourts(currentSlug) {
  return SEO_COURTS.filter((c) => c.slug !== currentSlug)
    .slice(0, 8)
    .map((c) => `<li><a href="/case-history/${c.slug}.html">${escapeHtml(c.name)} case history</a></li>`)
    .join('');
}

function courtPage(court) {
  const title = `${court.name} Case History & Case Status Search | ${SITE_NAME}`;
  const description = `Search ${court.name} case history, case status, CNR, orders and judgments online. Check listing history and daily business for ${court.shortName}${court.region ? ` (${court.region})` : ''}.`;
  const keywords = [
    `${court.name.toLowerCase()} case history`,
    `${court.shortName.toLowerCase()} case status`,
    `${court.name.toLowerCase()} CNR search`,
    'court case history',
    'orders judgments',
  ].join(', ');

  const statusUrl = searchUrl({
    courtType: court.courtType,
    courtName: court.courtType === 'high' ? court.appCourtName : undefined,
    mode: 'case-status',
  });
  const cnrUrl = searchUrl({
    courtType: court.courtType,
    courtName: court.courtType === 'high' ? court.appCourtName : undefined,
    mode: 'cnr',
  });

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: `${SITE_URL}/case-history/${court.slug}.html`,
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
      about: { '@type': 'Courthouse', name: court.name },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Case History by Court', item: `${SITE_URL}/case-history/` },
        { '@type': 'ListItem', position: 3, name: court.name, item: `${SITE_URL}/case-history/${court.slug}.html` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: `How do I search ${court.name} case status?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: `Open the ${court.name} case status search, choose the bench if required, enter case type, case number and year, then search to view case details, orders, judgments and case history.`,
          },
        },
        {
          '@type': 'Question',
          name: `Can I find ${court.shortName} cases by CNR number?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: `Yes. Use CNR Search on ${SITE_NAME}, enter the 16-character CNR, and view status, hearing history, orders and daily business where available.`,
          },
        },
        {
          '@type': 'Question',
          name: `What information is available in ${court.name} case history?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Case history typically includes hearing dates, cause list type, coram/judge, purpose of listing, orders/judgments and daily business entries when published by the court data source.',
          },
        },
      ],
    },
  ];

  const body = `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a> / <a href="/case-history/">Case History</a> / ${escapeHtml(court.name)}
    </nav>
    <h1>${escapeHtml(court.name)} Case History &amp; Case Status</h1>
    <p class="lede">Look up ${escapeHtml(court.name)} case status, CNR details, orders/judgments, listing history and daily business on ${SITE_NAME}${court.region ? ` — covering matters connected with ${escapeHtml(court.region)}` : ''}.</p>
    <p>
      <a class="cta" href="${escapeHtml(statusUrl)}">Search ${escapeHtml(court.shortName)} case status</a>
      <a class="cta secondary" href="${escapeHtml(cnrUrl)}">Search by CNR</a>
    </p>

    <div class="card">
      <h2>What you can search</h2>
      <ul>
        <li><strong>Case Status Search</strong> — court/bench, case type, case number and year</li>
        <li><strong>CNR Search</strong> — find a matter using the unique CNR number</li>
        <li><strong>Orders / Judgments</strong> — dated order list with PDF export</li>
        <li><strong>Case History</strong> — hearing / listing timeline</li>
        <li><strong>Daily Business</strong> — business recorded on hearing dates</li>
      </ul>
    </div>

    <h2>How to check ${escapeHtml(court.shortName)} case history</h2>
    <ol>
      <li>Click <strong>Search ${escapeHtml(court.shortName)} case status</strong>.</li>
      <li>${court.courtType === 'supreme' ? 'Supreme Court is selected automatically.' : 'Confirm the High Court and select the correct bench.'}</li>
      <li>Choose case type, enter case number and year, then search.</li>
      <li>Open tabs for Orders/Judgments, Case History and Daily Business. Sort ASC/DESC and export PDF when needed.</li>
    </ol>

    <h2>Frequently asked questions</h2>
    <div class="card">
      <h3>How do I search ${escapeHtml(court.name)} case status?</h3>
      <p>Use Case Status Search with the correct bench (if applicable), case type, number and year.</p>
    </div>
    <div class="card">
      <h3>Can I find ${escapeHtml(court.shortName)} cases by CNR?</h3>
      <p>Yes — use CNR Search and enter the full CNR to load case details and history.</p>
    </div>
    <div class="card">
      <h3>What appears in case history?</h3>
      <p>Hearing dates, cause list type, judge/coram and purpose of listing, plus related orders and daily business when available.</p>
    </div>

    <h2>Other courts</h2>
    <ul>${relatedCourts(court.slug)}</ul>
    <p class="muted"><a href="/case-history/">View all courts</a> · <a href="/guides/how-to-search-by-cnr.html">How to search by CNR</a></p>
  `;

  return layout({
    title,
    description,
    canonicalPath: `/case-history/${court.slug}.html`,
    keywords,
    jsonLd,
    body,
  });
}

function indexPage() {
  const links = SEO_COURTS.map(
    (c) => `<a href="/case-history/${c.slug}.html">${escapeHtml(c.name)}</a>`,
  ).join('\n      ');

  const body = `
    <nav class="breadcrumb"><a href="/">Home</a> / Case History by Court</nav>
    <h1>Court Case History by Court</h1>
    <p class="lede">Browse Supreme Court and High Court pages to search case status, CNR, orders, judgments and listing history on ${SITE_NAME}.</p>
    <p><a class="cta" href="/?mode=case-status">Open case status search</a>
    <a class="cta secondary" href="/guides/how-to-search-by-cnr.html">CNR search guide</a></p>
    <h2>Supreme Court &amp; High Courts</h2>
    <div class="court-list">
      ${links}
    </div>
  `;

  return layout({
    title: `Case History by Court | ${SITE_NAME}`,
    description:
      'Browse Supreme Court and High Court case history pages. Search case status, CNR, orders, judgments and daily business online.',
    canonicalPath: '/case-history/',
    keywords: 'court case history, high court case status, supreme court case history, CNR search',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Case History by Court',
      url: `${SITE_URL}/case-history/`,
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
    },
    body,
  });
}

function cnrGuidePage() {
  const body = `
    <nav class="breadcrumb"><a href="/">Home</a> / Guides / Search by CNR</nav>
    <h1>How to Search Court Cases by CNR Number</h1>
    <p class="lede">A CNR (Case Number Record) is a unique identifier for an Indian court case. Use it on ${SITE_NAME} to open case status, history, orders and daily business.</p>
    <p><a class="cta" href="/?mode=cnr">Open CNR Search</a>
    <a class="cta secondary" href="/case-history/">Browse courts</a></p>
    <h2>Steps</h2>
    <ol>
      <li>Open <strong>CNR Search</strong>.</li>
      <li>Enter the full CNR without spaces (typically 16 characters).</li>
      <li>Submit to load case details, petitioner/respondent, hearings, orders and daily business when available.</li>
    </ol>
    <h2>Tips</h2>
    <ul>
      <li>Double-check digits and letters — a single wrong character returns no match.</li>
      <li>If you do not have a CNR, use Case Status Search with court, case type, number and year.</li>
      <li>After results load, export Orders, Case History or Daily Business as PDF.</li>
    </ul>
    <h2>Related</h2>
    <ul>
      <li><a href="/case-history/allahabad-high-court.html">Allahabad High Court case history</a></li>
      <li><a href="/case-history/telangana-high-court.html">Telangana High Court case history</a></li>
      <li><a href="/case-history/delhi-high-court.html">Delhi High Court case history</a></li>
      <li><a href="/case-history/supreme-court-of-india.html">Supreme Court of India case history</a></li>
    </ul>
  `;

  return layout({
    title: `How to Search Court Cases by CNR | ${SITE_NAME}`,
    description:
      'Learn how to search Indian court cases by CNR number. Find case status, history, orders and daily business on Court Case History.',
    canonicalPath: '/guides/how-to-search-by-cnr.html',
    keywords: 'CNR search, case number record, court case by CNR, ecourts CNR',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to Search Court Cases by CNR Number',
      description: 'Use CNR Search on Court Case History to find case status and history.',
      step: [
        { '@type': 'HowToStep', text: 'Open CNR Search on Court Case History.' },
        { '@type': 'HowToStep', text: 'Enter the full CNR number.' },
        { '@type': 'HowToStep', text: 'View case details, history, orders and daily business.' },
      ],
    },
    body,
  });
}

function writeSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE_URL}/`, priority: '1.0' },
    { loc: `${SITE_URL}/case-history/`, priority: '0.9' },
    { loc: `${SITE_URL}/guides/how-to-search-by-cnr.html`, priority: '0.8' },
    ...SEO_COURTS.map((c) => ({
      loc: `${SITE_URL}/case-history/${c.slug}.html`,
      priority: '0.8',
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
  writeFileSync(join(publicDir, 'sitemap.xml'), xml, 'utf8');
}

function main() {
  if (existsSync(caseHistoryDir)) {
    rmSync(caseHistoryDir, { recursive: true, force: true });
  }
  mkdirSync(caseHistoryDir, { recursive: true });
  mkdirSync(join(publicDir, 'guides'), { recursive: true });

  writeFileSync(join(caseHistoryDir, 'index.html'), indexPage(), 'utf8');
  for (const court of SEO_COURTS) {
    writeFileSync(join(caseHistoryDir, `${court.slug}.html`), courtPage(court), 'utf8');
  }
  writeFileSync(join(publicDir, 'guides', 'how-to-search-by-cnr.html'), cnrGuidePage(), 'utf8');
  writeSitemap();

  console.log(`SEO pages generated: ${SEO_COURTS.length} courts + guides + sitemap`);
}

main();
