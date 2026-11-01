import { useState } from 'react';
import { fmtDay, fmtTimeSlot } from '../../utils/formatters';

// Asks before a booking is cancelled, with an optional reason that is kept
// on the booking. Render it only while there is a booking to cancel.
export default function CancelBookingDialog({ booking, note, busy, error, onClose, onConfirm }) {
  const [reason, setReason] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onConfirm(reason.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-booking-title"
    >
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl border border-line bg-white p-6 shadow-2xl">
        <h3 id="cancel-booking-title" className="font-display text-lg font-semibold text-navy">
          Cancel this booking?
        </h3>
        {note && <p className="mt-1 text-sm text-ink/60">{note}</p>}

        <div className="mt-4 rounded-lg bg-paper p-3 text-sm">
          <p className="font-semibold text-ink">{booking.resource?.resourceName || booking.resourceId}</p>
          <p className="mt-0.5 text-ink/70">
            {fmtDay(booking.bookingDate)} · {fmtTimeSlot(booking.startTime, booking.endTime)}
          </p>
          {booking.requester?.name && <p className="mt-0.5 text-ink/60">Booked by {booking.requester.name}</p>}
          {booking.purpose && <p className="mt-0.5 text-ink/50">{booking.purpose}</p>}
        </div>

        <label htmlFor="cancel-reason" className="mb-1 mt-4 block text-sm font-semibold text-ink">
          Reason <span className="font-normal text-ink/50">(optional)</span>
        </label>
        <textarea
          id="cancel-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. The event has been postponed"
          className="w-full rounded border border-line px-3 py-2 text-sm focus:border-navy focus:outline-none"
        />

        {error && <p className="mt-3 rounded bg-brick-light px-3 py-2 text-sm text-brick">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
          >
            Keep booking
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brick px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Cancelling…' : 'Yes, cancel it'}
          </button>
        </div>
      </form>
    </div>
  );
}
