import type { ReactNode } from 'react';
import { links } from '../config/links';

type AppDownloadButtonsProps = {
  compact?: boolean;
};

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function GooglePlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M3.609 1.814 13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92Zm10.89 10.893 2.302 2.302-10.937 6.333 8.635-8.635Zm3.199-3.198 2.307 1.335c.8.46.8 1.614 0 2.074l-2.305 1.334L15.028 12l2.67-2.491ZM5.864 2.658 16.8 8.99l-2.302 2.302-8.634-8.634Z" />
    </svg>
  );
}

type StoreLinkProps = {
  href: string;
  label: string;
  sublabel: string;
  icon: ReactNode;
  compact?: boolean;
};

function StoreLink({ href, label, sublabel, icon, compact = false }: StoreLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex min-h-8 items-center gap-1.5 rounded-sm border border-brassLight/40 px-2 py-0.5 text-parchment transition hover:border-brassLight hover:bg-navyDeep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
        compact
          ? 'bg-navyDeep/80'
          : 'bg-navyDeep/60 focus-visible:ring-offset-2 focus-visible:ring-offset-navy'
      }`}
      aria-label={`${sublabel} ${label}`}
    >
      {icon}
      <span className="flex flex-col leading-none">
        <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-brassLight/90">
          {sublabel}
        </span>
        <span className="mt-0.5 font-body text-[11px] font-semibold tracking-wide sm:text-xs">
          {label}
        </span>
      </span>
    </a>
  );
}

export function AppDownloadButtons({ compact = false }: AppDownloadButtonsProps) {
  return (
    <div
      className={`flex items-center gap-1.5 ${
        compact ? 'flex-wrap justify-center' : 'justify-end'
      }`}
    >
      <StoreLink
        href={links.iosAppUrl}
        sublabel="Download on the"
        label="App Store"
        compact={compact}
        icon={<AppleIcon className="h-4 w-4 text-brassLight" />}
      />
      <StoreLink
        href={links.androidAppUrl}
        sublabel="Get it on"
        label="Google Play"
        compact={compact}
        icon={<GooglePlayIcon className="h-4 w-4 text-brassLight" />}
      />
    </div>
  );
}
