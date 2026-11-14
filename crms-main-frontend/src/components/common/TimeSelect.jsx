import { fmtTime } from '../../utils/formatters';

// A plain <select> standing in for <input type="time">, which renders in the
// browser/OS's own locale (often 24-hour) with no cross-browser way to force
// 12-hour. Value stays a 24h "HH:mm" string so it's a drop-in replacement
// everywhere else in the app that already works in 24h internally.
function buildOptions(min, max, stepMinutes, extra) {
  const [minH, minM] = min.split(':').map(Number);
  const [maxH, maxM] = max.split(':').map(Number);
  const start = minH * 60 + minM;
  const end = maxH * 60 + maxM;

  const times = [];
  for (let t = start; t <= end; t += stepMinutes) {
    const h = String(Math.floor(t / 60)).padStart(2, '0');
    const m = String(t % 60).padStart(2, '0');
    times.push(`${h}:${m}`);
  }
  if (extra) times.push(extra);

  return [...new Set(times)].sort();
}

export default function TimeSelect({
  value,
  onChange,
  min = '06:00',
  max = '22:00',
  step = 15,
  placeholder = 'Choose…',
  id,
  required,
  className = 'rounded border border-line px-2 py-1 text-sm bg-white',
}) {
  // Keeps an off-grid value (e.g. from OCR-extracted data) selectable
  // instead of silently falling back to blank.
  const options = buildOptions(min, max, step, value);

  return (
    <select
      id={id}
      required={required}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="">{placeholder}</option>
      {options.map((t) => (
        <option key={t} value={t}>{fmtTime(t)}</option>
      ))}
    </select>
  );
}
