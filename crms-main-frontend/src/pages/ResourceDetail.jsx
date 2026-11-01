import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CircleCheck, Eye, MapPin, Users } from 'lucide-react';
import { resourcesApi, bookingsApi } from '../api/endpoints';
import { useAuth } from '../context/authStore';
import { BOOKERS } from '../constants/roles';
import AvailabilityStrip from '../components/AvailabilityStrip';
import { fmtDay, fmtTime, fmtTimeSlot } from '../utils/formatters';

function todayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function maxDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const QUICK_SLOTS = [
  { label: 'Morning', start: '09:00', end: '13:00' },
  { label: 'Afternoon', start: '13:00', end: '16:40' },
  { label: 'Whole day', start: '09:00', end: '16:40' },
];

export default function ResourceDetail() {
  const { resourceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canBook = BOOKERS.includes(user?.roleId);

  const [resource, setResource] = useState(null);
  const [date, setDate] = useState(location.state?.filterDate || todayStr());
  const [availability, setAvailability] = useState(null);
  const [form, setForm] = useState({
    startTime: location.state?.filterStartTime || '',
    endTime: location.state?.filterEndTime || '',
    purpose: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // The request just sent, shown back to the requester until they book again.
  const [sent, setSent] = useState(null);

  useEffect(() => {
    resourcesApi.get(resourceId).then(setResource);
  }, [resourceId]);

  useEffect(() => {
    resourcesApi.availability(resourceId, date).then(setAvailability);
  }, [resourceId, date]);

  // Whole hours plus the campus period boundaries (12:40, 13:40 ...),
  // plus whatever slot the dashboard handed over, so a preselected time
  // is always a real option in the dropdown.
  const TIME_OPTIONS = [...new Set([
    '08:00', '09:00', '10:00', '11:00', '12:00', '12:40', '13:00', '13:40',
    '14:00', '14:40', '15:00', '15:40', '16:00', '16:40', '17:00', '17:40',
    '18:00', '19:00', '20:00', '21:00',
    form.startTime, form.endTime,
  ].filter(Boolean))].sort();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.startTime && form.endTime && form.startTime >= form.endTime) {
      setError('End time must be after start time.');
      return;
    }

    setSubmitting(true);
    try {
      await bookingsApi.create({
        resourceId,
        bookingDate: date,
        startTime: form.startTime,
        endTime: form.endTime,
        purpose: form.purpose,
      });
      setSent({ date, startTime: form.startTime, endTime: form.endTime });
      setForm({ startTime: '', endTime: '', purpose: '' });
      resourcesApi.availability(resourceId, date).then(setAvailability);
    } catch (err) {
      const data = err.response?.data;
      if (data?.details?.conflicts && Array.isArray(data.details.conflicts) && data.details.conflicts.length > 0) {
        setError(
          `${data.error}: ${data.details.conflicts
            .map((c) => fmtTimeSlot(c.startTime, c.endTime))
            .join(', ')}`
        );
      } else if (data?.details?.fieldErrors && Object.keys(data.details.fieldErrors).length > 0) {
        const messages = Object.entries(data.details.fieldErrors)
          .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(', ') : errs}`)
          .join('; ');
        setError(`${data.error || 'Validation error'}: ${messages}`);
      } else {
        setError(data?.error || 'Could not create booking.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!resource) return <p className="text-sm text-ink/50">Loading…</p>;

  const place = [
    resource.block?.blockName || (resource.block?.blockCode && `Block ${resource.block.blockCode}`),
    resource.floor ? `Floor ${resource.floor}` : '',
  ].filter(Boolean).join(', ');

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-navy">
        <ArrowLeft size={16} />
        Back to rooms
      </button>

      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">{resource.resourceType?.typeName}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-navy">{resource.resourceName}</h1>
      {resource.department && <p className="mt-1 text-sm text-ink/70">{resource.department.departmentName}</p>}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/60">
        {place && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={15} className="text-ink/40" />
            {place}
          </span>
        )}
        {resource.capacityOrAreaSqm && (
          <span className="inline-flex items-center gap-1.5">
            <Users size={15} className="text-ink/40" />
            {Math.floor(resource.capacityOrAreaSqm)} seats
          </span>
        )}
      </div>

      <section className="mt-8 rounded-lg border border-line bg-white p-5 shadow-sm">
        <StepTitle
          n={canBook ? 1 : null}
          title="Pick a day"
          hint={canBook ? 'You can book up to 15 days ahead.' : 'See what is on, up to 15 days ahead.'}
        >
          <input
            type="date"
            aria-label="Day"
            value={date}
            min={todayStr()}
            max={maxDateStr()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-line px-2 py-1 text-sm"
          />
        </StepTitle>
        <AvailabilityStrip availability={availability} date={date} />
      </section>

      {!canBook ? (
        <section className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-white p-5 shadow-sm">
          <Eye size={22} className="shrink-0 text-ink/40" />
          <div>
            <h2 className="text-base font-semibold text-ink">Your account can look, but not book</h2>
            <p className="mt-1 text-sm text-ink/70">
              If you need to book rooms, ask the Super Admin to change your account to Requester.
            </p>
          </div>
        </section>
      ) : sent ? (
        <section className="mt-6 rounded-lg border border-line border-l-4 border-l-forest bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <CircleCheck size={26} className="shrink-0 text-forest" />
            <div>
              <h2 className="text-lg font-semibold text-ink">Request sent</h2>
              <p className="mt-1 text-sm text-ink/70">
                {resource.resourceName} on {fmtDay(sent.date)}, {fmtTimeSlot(sent.startTime, sent.endTime)}.
                The room's admin will approve or reject it, and you'll see the answer in My Bookings.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/bookings"
                  className="inline-flex items-center gap-1.5 rounded bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark"
                >
                  See My Bookings
                  <ArrowRight size={15} />
                </Link>
                <button
                  type="button"
                  onClick={() => setSent(null)}
                  className="rounded border border-line px-4 py-2 text-sm font-medium text-navy hover:bg-paper"
                >
                  Book another time
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 rounded-lg border border-line bg-white p-5 shadow-sm">
          <StepTitle n={2} title="Choose a time" hint="Pick a ready-made slot, or set the start and end yourself." />
          <div className="flex flex-wrap gap-2">
            {QUICK_SLOTS.map((q) => {
              const on = form.startTime === q.start && form.endTime === q.end;
              return (
                <button
                  key={q.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setForm((f) => ({ ...f, startTime: q.start, endTime: q.end }))}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    on ? 'border-navy bg-navy text-white' : 'border-line bg-paper text-navy hover:border-navy/40'
                  }`}
                >
                  <span className="block text-sm font-semibold">{q.label}</span>
                  <span className={`block text-xs ${on ? 'text-white/70' : 'text-ink/50'}`}>{fmtTimeSlot(q.start, q.end)}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-time" className="mb-1 block text-xs font-medium text-ink/70">Start time</label>
              <select
                id="start-time"
                required
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                className="w-full rounded border border-line px-3 py-2 text-sm bg-white"
              >
                <option value="">Choose…</option>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{fmtTime(t)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="end-time" className="mb-1 block text-xs font-medium text-ink/70">End time</label>
              <select
                id="end-time"
                required
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                className="w-full rounded border border-line px-3 py-2 text-sm bg-white"
              >
                <option value="">Choose…</option>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{fmtTime(t)}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-8">
            <StepTitle n={3} title="Say what it's for" hint="The person who approves the request reads this." />
          </div>
          <textarea
            required
            minLength={3}
            rows={3}
            aria-label="What it's for"
            value={form.purpose}
            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
            placeholder="e.g. Department workshop on data structures"
            className="w-full rounded border border-line px-3 py-2 text-sm"
          />

          {error && <p className="mt-4 rounded bg-brick-light px-3 py-2 text-sm text-brick">{error}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-60"
            >
              {submitting ? 'Sending…' : 'Send request'}
            </button>
            <p className="text-xs text-ink/50">The room's admin approves or rejects it. You'll see the answer in My Bookings.</p>
          </div>
        </form>
      )}
    </div>
  );
}

function StepTitle({ n, title, hint, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {n && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
            {n}
          </span>
        )}
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-ink/50">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
