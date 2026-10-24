import { useMemo, useState } from 'react';
import { AppDownloadBanner } from './components/AppDownloadBanner';
import { AppHeader } from './components/AppHeader';
import { CaseStatusSearch } from './components/CaseStatusSearch';
import { CnrSearch } from './components/CnrSearch';
import { Footer } from './components/Footer';
import { courtTypes, DEFAULT_SEARCH_MODE } from './config/courtLevels';
import { SEO_COURTS } from './seo/site';
import { readSearchLaunchParams } from './seo/launchParams';

function App() {
  const launch = useMemo(() => readSearchLaunchParams(), []);
  const [activeCourtType, setActiveCourtType] = useState(
    launch.courtTypeId ?? courtTypes[0].id,
  );
  const [activeSearchMode, setActiveSearchMode] = useState(
    launch.searchModeId ?? DEFAULT_SEARCH_MODE,
  );

  function handleCourtTypeChange(id: string) {
    setActiveCourtType(id);
  }

  function handleSearchModeChange(id: string) {
    if (id === 'cnr' || id === 'case-status') {
      setActiveSearchMode(id);
    }
  }

  return (
    <div className="min-h-screen bg-parchment text-ink">
      <AppHeader
        activeCourtType={activeCourtType}
        activeSearchMode={activeSearchMode}
        onCourtTypeChange={handleCourtTypeChange}
        onSearchModeChange={handleSearchModeChange}
      />

      <main className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4">
        <div className="rounded-sm border border-navy/10 bg-parchmentDim p-3 shadow-slip sm:p-4">
          {activeSearchMode === 'cnr' ? (
            <CnrSearch initialCnr={launch.initialCnr ?? ''} />
          ) : (
            <CaseStatusSearch
              courtTypeId={activeCourtType}
              preferredCourtName={launch.preferredCourtName}
            />
          )}
        </div>

        <section className="mt-4 rounded-sm border border-navy/10 bg-parchment px-3 py-3 sm:px-4">
          <h2 className="font-display text-base text-navy">Popular court case history pages</h2>
          <ul className="mt-2 columns-1 gap-x-6 text-sm text-inkSoft sm:columns-2 lg:columns-3">
            {SEO_COURTS.map((court) => (
              <li key={court.slug} className="break-inside-avoid py-0.5">
                <a
                  className="text-navy underline-offset-2 hover:underline"
                  href={`/case-history/${court.slug}.html`}
                >
                  {court.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <AppDownloadBanner />
      <Footer />
    </div>
  );
}

export default App;
