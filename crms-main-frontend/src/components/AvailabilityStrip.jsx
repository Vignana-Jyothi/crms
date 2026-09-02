import { useState } from 'react';

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

function formatTimeDisplay(timeVal) {
  if (!timeVal) return '';
  if (typeof timeVal === 'string' && !timeVal.includes('T')) return timeVal.substring(0, 5);
  const d = new Date(timeVal);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
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
      <div className="mt-1 flex justify-between text-[10px] text-ink/40">
        {hourMarks.map((m) => {
          const hour24 = Math.floor(m / 60);
          const hour12 = hour24 % 12 || 12;
          return (
            <span key={m} className="font-mono">
              {hour12}
            </span>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink/60">
        <Legend swatch="bg-forest-light border border-forest/30" label="Open" />
        <Legend swatch="bg-navy" label="Class" />
        <Legend swatch="bg-amber" label="Pending booking" />
        <Legend swatch="bg-brick" label="Approved booking" />
      </div>

      {selectedBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4 text-left">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className={`p-4 border-b ${selectedBlock.type === 'class' ? 'bg-forest/10 border-forest/20' : selectedBlock.data.status === 'Approved' ? 'bg-brick/10 border-brick/20' : 'bg-amber/10 border-amber/20'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-display font-semibold text-navy">
                    {selectedBlock.type === 'class' ? 'Scheduled Class' : `Booking (${selectedBlock.data.status})`}
                  </h3>
                  <p className="text-xs font-mono text-ink/60 mt-0.5">
                    {formatTimeDisplay(selectedBlock.data.startTime)} - {formatTimeDisplay(selectedBlock.data.endTime)}
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
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/40">Section</span>
                    <span className="text-sm text-ink/80">{selectedBlock.data.section || 'N/A'}</span>
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

function Legend({ swatch, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}
