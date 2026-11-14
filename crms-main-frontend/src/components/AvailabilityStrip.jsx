import { useState } from 'react';
import { Check } from 'lucide-react';
import { formatClassYear, sectionLabel } from '../constants/programs';
import { fmtTimeSlot } from '../utils/formatters';

// Renders a 24h strip (8am-6pm campus hours shown, rest dimmed)
// with booked/class blocks marked, so a requester can see at a
// glance where the open slots are instead of guessing and hitting
// a conflict error.
const DAY_START_MIN = 9 * 60; // 09:00
const DAY_END_MIN = 18 * 60; // 18:00

function toMinutes(timeVal) {
  if (!timeVal) return 0;
  // Handle HH:MM or HH:MM:SS format
  if (typeof timeVal === 'string' && !timeVal.includes('T')) {
    const parts = timeVal.split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h * 60 + m;
    }
  }
  // Handle ISO datetime string
  const d = new Date(timeVal);
  if (isNaN(d.getTime())) return 0;
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function todayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function Block({ startMin, endMin, color, label, onClick, isCurrent }) {
  const totalMin = DAY_END_MIN - DAY_START_MIN;
  const left = ((Math.max(startMin, DAY_START_MIN) - DAY_START_MIN) / totalMin) * 100;
  const width = ((Math.min(endMin, DAY_END_MIN) - Math.max(startMin, DAY_START_MIN)) / totalMin) * 100;
  if (width <= 0) return null;
  return (
    <button
      title={label}
      onClick={onClick}
      className={`absolute top-0 h-full rounded-sm transition-opacity hover:opacity-80 ${color} ${onClick ? 'cursor-pointer ring-1 ring-white/30' : 'cursor-default'} ${isCurrent ? 'animate-pulse shadow-[0_0_10px_currentColor] z-10' : ''}`}
      style={{ left: `${left}%`, width: `${Math.max(width, 1.5)}%` }}
    />
  );
}

export default function AvailabilityStrip({ availability, date }) {
  const [selectedBlock, setSelectedBlock] = useState(null);

  if (!availability) return null;
  const { blockedByTimetable = [], blockedByBookings = [] } = availability;

  const hourMarks = [];
  for (let h = DAY_START_MIN; h <= DAY_END_MIN; h += 60) {
    hourMarks.push(h);
  }

  const isToday = date === todayStr();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div>
      <div className="relative h-8 w-full overflow-hidden rounded-md bg-forest-light">
        {blockedByTimetable.map((t, i) => {
          const s = toMinutes(t.startTime);
          const e = toMinutes(t.endTime);
          const isCurrent = isToday && currentMinutes >= s && currentMinutes <= e;
          return (
            <Block
              key={`tt-${i}`}
              startMin={s}
              endMin={e}
              color="bg-navy"
              label={`Class: ${t.courseName ? `${t.courseName} (${t.courseCode})` : (t.courseCode || 'Scheduled')}`}
              onClick={() => setSelectedBlock({ type: 'class', data: t })}
              isCurrent={isCurrent}
            />
          );
        })}
        {blockedByBookings.map((b, i) => {
          const s = toMinutes(b.startTime);
          const e = toMinutes(b.endTime);
          const isCurrent = isToday && currentMinutes >= s && currentMinutes <= e;
          return (
            <Block
              key={`bk-${i}`}
              startMin={s}
              endMin={e}
              color={b.status === 'Approved' ? 'bg-brick' : 'bg-amber'}
              label={`Booking (${b.status})`}
              onClick={() => setSelectedBlock({ type: 'booking', data: b })}
              isCurrent={isCurrent}
            />
          );
        })}
      </div>
      {/* Each label sits under its hour; every other one is dropped on phones. */}
      <div className="relative mt-1 h-4 text-[10px] text-ink/50">
        {hourMarks.map((m, i) => {
          const hour24 = Math.floor(m / 60);
          const left = ((m - DAY_START_MIN) / (DAY_END_MIN - DAY_START_MIN)) * 100;
          const shift = i === 0 ? '0' : i === hourMarks.length - 1 ? '-100%' : '-50%';
          return (
            <span
              key={m}
              className={`absolute top-0 whitespace-nowrap ${i % 2 ? 'hidden sm:block' : ''}`}
              style={{ left: `${left}%`, transform: `translateX(${shift})` }}
            >
              {hour24 % 12 || 12} {hour24 < 12 ? 'AM' : 'PM'}
            </span>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink/60">
        <Legend swatch="bg-forest-light border border-forest/30" label="Free" />
        <Legend swatch="bg-navy" label="Class" />
        <Legend swatch="bg-amber" label="Waiting for approval" />
        <Legend swatch="bg-brick" label="Booked" />
      </div>

      <BusyList blockedByTimetable={blockedByTimetable} blockedByBookings={blockedByBookings} />

      {selectedBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4 text-left">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className={`p-4 border-b ${selectedBlock.type === 'class' ? 'bg-forest/10 border-forest/20' : selectedBlock.data.status === 'Approved' ? 'bg-brick/10 border-brick/20' : 'bg-amber/10 border-amber/20'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-display font-semibold text-navy">
                    {selectedBlock.type === 'class'
                      ? 'Scheduled Class'
                      : selectedBlock.data.status === 'Approved' ? 'Booked' : 'Booking waiting for approval'}
                  </h3>
                  <p className="text-xs font-mono text-ink/60 mt-0.5">
                    {fmtTimeSlot(selectedBlock.data.startTime, selectedBlock.data.endTime)}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${selectedBlock.type === 'class' ? 'bg-forest/20 text-forest' : selectedBlock.data.status === 'Approved' ? 'bg-brick/20 text-brick-dark' : 'bg-amber/30 text-amber-dark'}`}>
                  {selectedBlock.type === 'class' ? 'Class' : selectedBlock.data.status}
                </span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {selectedBlock.type === 'class' ? (
                <>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/40">Course</span>
                    <span className="text-sm font-medium text-ink">
                      {selectedBlock.data.courseName && selectedBlock.data.courseName !== selectedBlock.data.courseCode 
                        ? `${selectedBlock.data.courseName} (${selectedBlock.data.courseCode})` 
                        : (selectedBlock.data.courseCode || 'Unknown')}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/40">Faculty</span>
                    <span className="text-sm text-ink/80">{selectedBlock.data.facultyName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/40">Class Details</span>
                    <span className="text-sm text-ink/80">
                       {selectedBlock.data.studentYear ? `${formatClassYear(selectedBlock.data.studentYear, selectedBlock.data.program, 'Year')} ` : ''}
                       {selectedBlock.data.branchCode ? `${selectedBlock.data.branchCode} ` : ''}
                       {selectedBlock.data.section ? `- Sec ${sectionLabel(selectedBlock.data.section, selectedBlock.data.program)}` : ''}
                       {(!selectedBlock.data.studentYear && !selectedBlock.data.branchCode && !selectedBlock.data.section) ? 'N/A' : ''}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/40">Purpose</span>
                    <span className="text-sm font-medium text-ink bg-paper p-2 rounded block mt-1 border border-line">{selectedBlock.data.purpose || 'No purpose provided'}</span>
                  </div>
                  {selectedBlock.data.requester && (
                    <div className="pt-2 border-t border-line mt-2">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/40 mb-1">Requested By</span>
                      <div className="text-sm text-navy font-semibold">{selectedBlock.data.requester.name}</div>
                      <div className="text-xs text-ink/60 mt-0.5 flex flex-col gap-0.5">
                        {selectedBlock.data.requester.email && <span>✉️ {selectedBlock.data.requester.email}</span>}
                        {selectedBlock.data.requester.phone && <span>📞 {selectedBlock.data.requester.phone}</span>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="p-3 bg-paper/50 border-t border-line text-right">
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedBlock(null);
                }}
                className="px-4 py-1.5 bg-navy text-white text-xs font-semibold rounded hover:bg-navy-dark transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// The strip again in words, for anyone who'd rather read than decode colours.
// Sections sharing a class in the same slot are listed once.
function BusyList({ blockedByTimetable, blockedByBookings }) {
  const seen = new Set();
  const busy = [
    ...blockedByTimetable.map((t) => ({
      startTime: t.startTime,
      endTime: t.endTime,
      kind: 'Class',
      detail: t.courseName || t.courseCode,
      swatch: 'bg-navy',
    })),
    ...blockedByBookings.map((b) => ({
      startTime: b.startTime,
      endTime: b.endTime,
      kind: b.status === 'Approved' ? 'Booked' : 'Waiting for approval',
      detail: b.purpose,
      swatch: b.status === 'Approved' ? 'bg-brick' : 'bg-amber',
    })),
  ]
    .filter((x) => {
      const key = `${toMinutes(x.startTime)}-${toMinutes(x.endTime)}-${x.kind}-${(x.detail || '').toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  if (busy.length === 0) {
    return (
      <p className="mt-4 flex items-center gap-1.5 border-t border-line pt-3 text-sm text-forest">
        <Check size={15} />
        Free all day. No classes or bookings yet.
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-xs font-semibold text-ink/70">Busy at these times</p>
      <ul className="mt-1.5 space-y-1">
        {busy.map((x, i) => (
          <li key={i} className="flex items-start gap-2 text-xs" title={x.detail ? `${x.kind}: ${x.detail}` : x.kind}>
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-sm ${x.swatch}`} />
            <span className="w-36 shrink-0 font-mono text-ink/60">{fmtTimeSlot(x.startTime, x.endTime)}</span>
            <span className="min-w-0 truncate text-ink/80">
              <span className="font-semibold">{x.kind}</span>
              {x.detail ? ` · ${x.detail}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Legend({ swatch, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}
