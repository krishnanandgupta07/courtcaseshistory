type Props = {
  message: string;
  visible: boolean;
};

/** Fixed parchment/navy status toast; parent controls visibility (auto-hide after show). */
export function AutoDismissToast({ message, visible }: Props) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <p className="rounded-sm border border-navy/20 bg-navy px-4 py-2 text-sm font-medium text-parchment shadow-lg">
        {message}
      </p>
    </div>
  );
}
