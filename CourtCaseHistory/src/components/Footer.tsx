import { links, phoneDisplay } from '../config/links';

type FooterProps = {
  onContactClick?: () => void;
};

export function Footer({ onContactClick }: FooterProps) {
  return (
    <footer className="bg-navyDeep px-3 py-5 text-parchment sm:px-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brassLight">Corporate Office</p>
          <a
            href={links.corporateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm text-parchment transition hover:text-brassLight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            Sanstrojan Solutions Pvt. Ltd.
          </a>
          <p className="mt-1 text-sm text-parchmentDim">
            Jubilee Hills, Hyderabad - 500033, Telangana, India.
          </p>
        </div>

        <div className="text-sm sm:text-right">
          {onContactClick ? (
            <button
              type="button"
              onClick={onContactClick}
              className="font-medium text-parchment transition hover:text-brassLight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              CONTACT US
            </button>
          ) : (
            <a
              href="/contact"
              className="font-medium text-parchment transition hover:text-brassLight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              CONTACT US
            </a>
          )}
          <p className="mt-2">
            MAIL:{' '}
            <a
              href={links.email}
              className="transition hover:text-brassLight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              info@courtlivestream.com
            </a>
          </p>
          <p className="mt-1">
            Phone:{' '}
            <a
              href={links.phone}
              className="transition hover:text-brassLight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              {phoneDisplay}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
