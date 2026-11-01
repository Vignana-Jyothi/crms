// Status colours shared by pills (StatusPill) and card stripes, so the same
// state always looks the same wherever it appears.
export const STRIPE_TONES = {
  green: 'border-l-forest',
  amber: 'border-l-amber',
  red: 'border-l-brick',
  grey: 'border-l-ink/20',
};

export const BOOKING_STATUS = {
  Pending: { tone: 'amber', label: 'Waiting for approval' },
  Approved: { tone: 'green', label: 'Approved' },
  Rejected: { tone: 'red', label: 'Rejected' },
  Cancelled: { tone: 'grey', label: 'Cancelled' },
};

export function bookingTone(status) {
  return BOOKING_STATUS[status]?.tone || 'grey';
}
