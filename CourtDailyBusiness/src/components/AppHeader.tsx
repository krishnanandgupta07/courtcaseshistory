import { courtTypes, searchModes } from '../config/courtLevels';
import { links } from '../config/links';
import { AppDownloadButtons } from './AppDownloadButtons';

type Props = {
  activeCourtType: string;
  activeSearchMode: string;
  onCourtTypeChange: (id: string) => void;
  onSearchModeChange: (id: string) => void;
};

export function AppHeader({
  activeCourtType,
  activeSearchMode,
  onCourtTypeChange,
  onSearchModeChange,
}: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-brassLight/25 bg-masthead text-parchment shadow-slip">
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(217,196,149,0.30)_0%,rgba(217,196,149,0)_45%)]" />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2 sm:px-4 md:gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-parchment/40 bg-parchment/90 p-0.5"
            aria-hidden
          >
            <img
              src="/images/CourtLiveLogo.jpeg"
              alt=""
              className="h-full w-full rounded-sm object-cover"
            />
          </div>

          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-semibold text-parchment sm:text-xl">
              Court Daily Business
            </h1>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-parchmentDim sm:text-xs">
              Powered by{' '}
              <a
                href={links.courtLiveStreamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-brassLight/70 underline-offset-2 transition hover:text-brassLight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                CourtLiveStream
              </a>
            </p>
          </div>
        </div>

        <nav className="order-3 w-full md:order-2 md:flex-1" aria-label="Court filters and search mode tabs">
          <div
            role="radiogroup"
            aria-label="Court type"
            className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2"
          >
            {courtTypes.map((item) => {
              const isActive = activeCourtType === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => onCourtTypeChange(item.id)}
                  className={`min-h-8 rounded-sm px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass sm:px-3 ${
                    isActive
                      ? 'bg-brass text-navyDeep'
                      : 'bg-white/0 text-parchmentDim hover:bg-white/5 hover:text-parchment'
                  }`}
                >
                  <span className="sm:hidden">{item.mobileLabel}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div role="tablist" aria-label="Search mode" className="mx-auto mt-1.5 flex max-w-xl justify-center gap-2">
            {searchModes.map((item) => {
              const isActive = activeSearchMode === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSearchModeChange(item.id)}
                  className={`min-h-8 rounded-sm px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass sm:px-3 ${
                    isActive
                      ? 'bg-brass font-medium text-navyDeep'
                      : 'bg-white/0 text-parchmentDim hover:bg-white/5 hover:text-parchment'
                  }`}
                >
                  <span className="sm:hidden">{item.mobileLabel}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="ml-auto order-2 flex items-center md:order-3">
          <a
            href={links.androidAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-8 items-center rounded-sm bg-brass px-3 py-1 text-xs font-semibold text-navyDeep transition hover:bg-brassLight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass lg:hidden"
          >
            Get App
          </a>

          <div className="hidden flex-col items-end gap-1.5 lg:flex">
            <p className="max-w-[14rem] text-right font-body text-[10px] leading-snug text-parchment/80 xl:text-[11px]">
              Track your cases &amp; get notified on hearing dates
            </p>
            <AppDownloadButtons />
          </div>
        </div>
      </div>
    </header>
  );
}
