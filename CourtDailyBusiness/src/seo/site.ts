export const SITE_URL = 'https://courtdailybusiness.com';
export const SITE_NAME = 'Court Daily Business';
export const SITE_TAGLINE =
  'Search Supreme Court, High Court, District Court and Tribunal case status, CNR, orders, case history and daily business online.';

export type SeoCourt = {
  slug: string;
  name: string;
  shortName: string;
  courtType: 'supreme' | 'high';
  /** Exact courtName used by GET /api/app/courts/list when known */
  appCourtName: string;
  keywords: string[];
  region?: string;
};

/** Static SEO court pages for MilesWeb. Keep appCourtName aligned with /api/app/courts/list. */
export const SEO_COURTS: SeoCourt[] = [
  {
    slug: 'supreme-court-of-india',
    name: 'Supreme Court of India',
    shortName: 'Supreme Court',
    courtType: 'supreme',
    appCourtName: 'Supreme Court',
    keywords: ['supreme court case history', 'supreme court case status', 'SC CNR search'],
    region: 'India',
  },
  {
    slug: 'allahabad-high-court',
    name: 'Allahabad High Court',
    shortName: 'Allahabad HC',
    courtType: 'high',
    appCourtName: 'Allahabad High Court',
    keywords: ['allahabad high court case history', 'allahabad hc case status', 'prayagraj high court'],
    region: 'Uttar Pradesh',
  },
  {
    slug: 'andhra-pradesh-high-court',
    name: 'Andhra Pradesh High Court',
    shortName: 'Andhra Pradesh HC',
    courtType: 'high',
    appCourtName: 'Andhra Pradesh High Court',
    keywords: ['andhra pradesh high court case history', 'amaravati high court case status'],
    region: 'Andhra Pradesh',
  },
  {
    slug: 'bombay-high-court',
    name: 'Bombay High Court',
    shortName: 'Bombay HC',
    courtType: 'high',
    appCourtName: 'Bombay High Court',
    keywords: ['bombay high court case history', 'mumbai high court case status'],
    region: 'Maharashtra',
  },
  {
    slug: 'calcutta-high-court',
    name: 'Calcutta High Court',
    shortName: 'Calcutta HC',
    courtType: 'high',
    appCourtName: 'Calcutta High Court',
    keywords: ['calcutta high court case history', 'kolkata high court case status'],
    region: 'West Bengal',
  },
  {
    slug: 'chhattisgarh-high-court',
    name: 'Chhattisgarh High Court',
    shortName: 'Chhattisgarh HC',
    courtType: 'high',
    appCourtName: 'Chhattisgarh High Court',
    keywords: ['chhattisgarh high court case history', 'bilaspur high court case status'],
    region: 'Chhattisgarh',
  },
  {
    slug: 'delhi-high-court',
    name: 'Delhi High Court',
    shortName: 'Delhi HC',
    courtType: 'high',
    appCourtName: 'Delhi High Court',
    keywords: ['delhi high court case history', 'delhi hc case status'],
    region: 'Delhi',
  },
  {
    slug: 'gauhati-high-court',
    name: 'Gauhati High Court',
    shortName: 'Gauhati HC',
    courtType: 'high',
    appCourtName: 'Gauhati High Court',
    keywords: ['gauhati high court case history', 'guwahati high court case status'],
    region: 'Assam',
  },
  {
    slug: 'gujarat-high-court',
    name: 'Gujarat High Court',
    shortName: 'Gujarat HC',
    courtType: 'high',
    appCourtName: 'Gujarat High Court',
    keywords: ['gujarat high court case history', 'ahmedabad high court case status'],
    region: 'Gujarat',
  },
  {
    slug: 'himachal-pradesh-high-court',
    name: 'Himachal Pradesh High Court',
    shortName: 'Himachal Pradesh HC',
    courtType: 'high',
    appCourtName: 'Himachal Pradesh High Court',
    keywords: ['himachal pradesh high court case history', 'shimla high court case status'],
    region: 'Himachal Pradesh',
  },
  {
    slug: 'jammu-kashmir-ladakh-high-court',
    name: 'Jammu & Kashmir and Ladakh High Court',
    shortName: 'J&K and Ladakh HC',
    courtType: 'high',
    appCourtName: 'Jammu & Kashmir and Ladakh High Court',
    keywords: ['jammu and kashmir high court case history', 'j&k high court case status'],
    region: 'Jammu & Kashmir',
  },
  {
    slug: 'jharkhand-high-court',
    name: 'Jharkhand High Court',
    shortName: 'Jharkhand HC',
    courtType: 'high',
    appCourtName: 'Jharkhand High Court',
    keywords: ['jharkhand high court case history', 'ranchi high court case status'],
    region: 'Jharkhand',
  },
  {
    slug: 'karnataka-high-court',
    name: 'Karnataka High Court',
    shortName: 'Karnataka HC',
    courtType: 'high',
    appCourtName: 'Karnataka High Court',
    keywords: ['karnataka high court case history', 'bangalore high court case status'],
    region: 'Karnataka',
  },
  {
    slug: 'kerala-high-court',
    name: 'Kerala High Court',
    shortName: 'Kerala HC',
    courtType: 'high',
    appCourtName: 'Kerala High Court',
    keywords: ['kerala high court case history', 'kochi high court case status'],
    region: 'Kerala',
  },
  {
    slug: 'madhya-pradesh-high-court',
    name: 'Madhya Pradesh High Court',
    shortName: 'Madhya Pradesh HC',
    courtType: 'high',
    appCourtName: 'Madhya Pradesh High Court',
    keywords: ['madhya pradesh high court case history', 'jabalpur high court case status'],
    region: 'Madhya Pradesh',
  },
  {
    slug: 'madras-high-court',
    name: 'Madras High Court',
    shortName: 'Madras HC',
    courtType: 'high',
    appCourtName: 'Madras High Court',
    keywords: ['madras high court case history', 'chennai high court case status'],
    region: 'Tamil Nadu',
  },
  {
    slug: 'manipur-high-court',
    name: 'Manipur High Court',
    shortName: 'Manipur HC',
    courtType: 'high',
    appCourtName: 'Manipur High Court',
    keywords: ['manipur high court case history', 'imphal high court case status'],
    region: 'Manipur',
  },
  {
    slug: 'meghalaya-high-court',
    name: 'Meghalaya High Court',
    shortName: 'Meghalaya HC',
    courtType: 'high',
    appCourtName: 'Meghalaya High Court',
    keywords: ['meghalaya high court case history', 'shillong high court case status'],
    region: 'Meghalaya',
  },
  {
    slug: 'orissa-high-court',
    name: 'Orissa High Court',
    shortName: 'Orissa HC',
    courtType: 'high',
    appCourtName: 'Orissa High Court',
    keywords: ['orissa high court case history', 'odisha high court case status', 'cuttack high court'],
    region: 'Odisha',
  },
  {
    slug: 'patna-high-court',
    name: 'Patna High Court',
    shortName: 'Patna HC',
    courtType: 'high',
    appCourtName: 'Patna High Court',
    keywords: ['patna high court case history', 'bihar high court case status'],
    region: 'Bihar',
  },
  {
    slug: 'punjab-and-haryana-high-court',
    name: 'Punjab and Haryana High Court',
    shortName: 'Punjab and Haryana HC',
    courtType: 'high',
    appCourtName: 'Punjab and Haryana High Court',
    keywords: ['punjab and haryana high court case history', 'chandigarh high court case status'],
    region: 'Punjab and Haryana',
  },
  {
    slug: 'rajasthan-high-court',
    name: 'Rajasthan High Court',
    shortName: 'Rajasthan HC',
    courtType: 'high',
    appCourtName: 'Rajasthan High Court',
    keywords: ['rajasthan high court case history', 'jodhpur high court case status'],
    region: 'Rajasthan',
  },
  {
    slug: 'sikkim-high-court',
    name: 'Sikkim High Court',
    shortName: 'Sikkim HC',
    courtType: 'high',
    appCourtName: 'Sikkim High Court',
    keywords: ['sikkim high court case history', 'gangtok high court case status'],
    region: 'Sikkim',
  },
  {
    slug: 'telangana-high-court',
    name: 'Telangana High Court',
    shortName: 'Telangana HC',
    courtType: 'high',
    appCourtName: 'Telangana High Court',
    keywords: ['telangana high court case history', 'hyderabad high court case status'],
    region: 'Telangana',
  },
  {
    slug: 'tripura-high-court',
    name: 'Tripura High Court',
    shortName: 'Tripura HC',
    courtType: 'high',
    appCourtName: 'Tripura High Court',
    keywords: ['tripura high court case history', 'agartala high court case status'],
    region: 'Tripura',
  },
  {
    slug: 'uttarakhand-high-court',
    name: 'Uttarakhand High Court',
    shortName: 'Uttarakhand HC',
    courtType: 'high',
    appCourtName: 'Uttarakhand High Court',
    keywords: ['uttarakhand high court case history', 'nainital high court case status'],
    region: 'Uttarakhand',
  },
];

export function buildSearchUrl(options: {
  courtType?: string;
  courtName?: string;
  mode?: 'case-status' | 'cnr';
}): string {
  const params = new URLSearchParams();
  if (options.mode) params.set('mode', options.mode);
  if (options.courtType) params.set('courtType', options.courtType);
  if (options.courtName) params.set('courtName', options.courtName);
  const query = params.toString();
  return query ? `/?${query}` : '/';
}
