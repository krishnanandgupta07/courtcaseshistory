const fallbackLinks = {
  courtLiveStreamUrl: 'https://www.courtlivestream.com',
  androidAppUrl:
    'https://play.google.com/store/apps/details?id=com.courtlivestream.app&pcampaignid=web_share&pli=1',
  iosAppUrl: 'https://apps.apple.com/us/app/courtlive-stream/id6764580795',
  corporateUrl: 'https://www.sanstrojan.com/',
  email: 'mailto:info@courtlivestream.com',
  phone: 'tel:+919985673774',
} as const;

export const links = {
  courtLiveStreamUrl: import.meta.env.VITE_COURTLIVESTREAM_URL || fallbackLinks.courtLiveStreamUrl,
  androidAppUrl: import.meta.env.VITE_ANDROID_APP_URL || fallbackLinks.androidAppUrl,
  iosAppUrl: import.meta.env.VITE_IOS_APP_URL || fallbackLinks.iosAppUrl,
  corporateUrl: fallbackLinks.corporateUrl,
  email: fallbackLinks.email,
  phone: fallbackLinks.phone,
};

export const phoneDisplay = '(+91) 9985673774';
