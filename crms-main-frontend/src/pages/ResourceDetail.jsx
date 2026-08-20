import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { resourcesApi, bookingsApi } from '../api/endpoints';
import AvailabilityStrip from '../components/AvailabilityStrip';
import { fmtTimeSlot } from '../utils/formatters';

function todayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ResourceDetail() {
  const { resourceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

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
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    resourcesApi.get(resourceId).then(setResource);
  }, [resourceId]);

  useEffect(() => {
    resourcesApi.availability(resourceId, date).then(setAvailability);
  }, [resourceId, date]);

  const TIME_OPTIONS = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', 
    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);

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
      setSuccess(true);
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

  if (!resource) return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-ink/50">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-ink/50 hover:text-navy">
        ← Back to search
      </button>

      <h1 className="font-display text-3xl font-semibold text-navy">{resource.resourceName}</h1>
      <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink/60">
        <span>{resource.resourceType?.typeName}</span>
        {resource.department && <span>{resource.department.departmentName}</span>}
        {resource.block && <span>Block {resource.block.blockCode}{resource.floor ? `, Floor ${resource.floor}` : ''}</span>}
        {resource.capacityOrAreaSqm && <span>Capacity {resource.capacityOrAreaSqm}</span>}
      </div>

      <div className="mt-8 rounded-lg border border-line bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Availability</h2>
          <input
            type="date"
            value={date}
            min={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-line px-2 py-1 text-sm"
          />
        </div>
        <AvailabilityStrip availability={availability} />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 rounded-lg border border-line bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Request this resource</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm(f => ({...f, startTime: '09:00', endTime: '13:00'}))} className="rounded bg-paper px-3 py-1.5 text-[11px] font-semibold text-navy hover:bg-paper/80 border border-line transition-colors">Morning</button>
            <button type="button" onClick={() => setForm(f => ({...f, startTime: '13:00', endTime: '17:00'}))} className="rounded bg-paper px-3 py-1.5 text-[11px] font-semibold text-navy hover:bg-paper/80 border border-line transition-colors">Afternoon</button>
            <button type="button" onClick={() => setForm(f => ({...f, startTime: '09:00', endTime: '17:00'}))} className="rounded bg-paper px-3 py-1.5 text-[11px] font-semibold text-navy hover:bg-paper/80 border border-line transition-colors">Whole Day</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/70">Start time</label>
            <select
              required
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              className="w-full rounded border border-line px-3 py-2 text-sm bg-white"
            >
              <option value="">Select...</option>
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/70">End time</label>
            <select
              required
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              className="w-full rounded border border-line px-3 py-2 text-sm bg-white"
            >
              <option value="">Select...</option>
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <label className="mb-1 mt-4 block text-xs font-medium text-ink/70">Purpose</label>
        <textarea
          required
          minLength={3}
          rows={3}
          value={form.purpose}
          onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
          placeholder="e.g. Department workshop on data structures"
          className="w-full rounded border border-line px-3 py-2 text-sm"
        />

        {error && <p className="mt-4 rounded bg-brick-light px-3 py-2 text-sm text-brick">{error}</p>}
        {success && (
          <p className="mt-4 rounded bg-forest-light px-3 py-2 text-sm text-forest">
            Request submitted. It's now pending approval — check "My bookings" for status.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit request'}
        </button>
      </form>
    </div>
  );
}
