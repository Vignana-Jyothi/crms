import { BOOKING_STATUS, bookingTone } from '../../constants/status';

// One look for every status in the app: a tinted pill with a dot and a
// word, so the colour is never the only thing telling you what it means.
const PILL_TONES = {
  green: 'bg-forest-light text-forest',
  amber: 'bg-amber-light text-amber',
  red: 'bg-brick-light text-brick',
  grey: 'bg-ink/5 text-ink/60',
};

const DOT_TONES = {
  green: 'bg-forest',
  amber: 'bg-amber',
  red: 'bg-brick',
  grey: 'bg-ink/40',
};

export default function StatusPill({ tone = 'grey', title, children }) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILL_TONES[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_TONES[tone]}`} />
      {children}
    </span>
  );
}

export function BookingStatusPill({ status }) {
  return <StatusPill tone={bookingTone(status)}>{BOOKING_STATUS[status]?.label || status}</StatusPill>;
}
