import { AppDownloadButtons } from './AppDownloadButtons';

export function AppDownloadBanner() {
  return (
    <aside
      aria-label="Download CourtLiveStream app"
      className="flex shrink-0 justify-center px-3 py-1.5 sm:px-4 md:px-6 lg:px-8"
    >
      <div className="flex w-fit flex-col items-center gap-1.5 rounded-sm border border-brassLight/30 bg-navy/95 px-3 py-2 text-parchment">
        <p className="max-w-[18rem] text-center font-body text-[10px] leading-snug text-parchment/85 sm:text-[11px]">
          Track your cases &amp; get notified on hearing dates
        </p>
        <AppDownloadButtons compact />
      </div>
    </aside>
  );
}
