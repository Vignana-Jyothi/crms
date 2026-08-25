import { useEffect, useState } from 'react';
import { masterDataApi, timetableApi } from '../../api/endpoints';
import { fmtTimeSlot } from '../../utils/formatters';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SectionSchedule() {
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    departmentId: '',
    section: '',
    date: todayStr(),
    filterType: 'Whole',
    customStart: '09:00',
    customEnd: '17:00'
  });

  useEffect(() => {
    Promise.all([
      masterDataApi.departments(),
      masterDataApi.sections()
    ]).then(([deps, secs]) => {
      setDepartments(deps);
      setSections(secs);
    }).catch(() => {});
  }, []);

  const getFilterTimes = () => {
    let startTimeParam = '';
    let endTimeParam = '';

    if (filters.filterType === 'Morning') {
      startTimeParam = '09:00';
      endTimeParam = '13:00';
    } else if (filters.filterType === 'Afternoon') {
      startTimeParam = '13:00';
      endTimeParam = '17:00';
    } else if (filters.filterType === 'Whole') {
      startTimeParam = '09:00';
      endTimeParam = '17:00';
    } else if (filters.filterType === 'Custom') {
      startTimeParam = filters.customStart;
      endTimeParam = filters.customEnd;
    } else if (filters.filterType === 'Now') {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      startTimeParam = `${hours}:${mins}`;
      endTimeParam = `${hours}:${mins}`;
    }

    return { startTimeParam, endTimeParam };
  };

  function refresh() {
    setLoading(true);
    setError('');

    const d = new Date(filters.date);
    const dayOfWeek = DAYS[d.getDay()];

    const { startTimeParam, endTimeParam } = getFilterTimes();

    const params = {
      dayOfWeek
    };
    if (filters.departmentId) params.departmentId = filters.departmentId;
    if (filters.section) params.section = filters.section;
    if (startTimeParam) params.startTime = startTimeParam;
    if (endTimeParam) params.endTime = endTimeParam;

    timetableApi
      .list(params)
      .then(setTimetables)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load schedule.'))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [filters]);

  // Filter available sections based on selected department
  const availableSections = filters.departmentId 
    ? sections.filter(s => s.departmentId === Number(filters.departmentId))
    : sections;

  // Deduplicate sections array by 'section' string
  const uniqueSectionNames = [...new Set(availableSections.map(s => s.section))];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-2xl font-semibold text-navy">Section Timetables</h1>
      <p className="mt-1 text-sm text-ink/60">
        Search for a branch and section to see the student schedule.
      </p>

      {/* Filters */}
      <div className="mt-6 rounded-xl border border-line bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          
          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">Branch / Dept</label>
            <select
              value={filters.departmentId}
              onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value, section: '' }))}
              className="w-full rounded border border-line px-3 py-2 text-sm"
            >
              <option value="">All Branches</option>
              {departments.map(d => (
                <option key={d.departmentId} value={d.departmentId}>{d.branchCode} - {d.departmentName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">Section</label>
            <select
              value={filters.section}
              onChange={(e) => setFilters((f) => ({ ...f, section: e.target.value }))}
              className="w-full rounded border border-line px-3 py-2 text-sm"
              disabled={!filters.departmentId && uniqueSectionNames.length === 0}
            >
              <option value="">All Sections</option>
              {uniqueSectionNames.map(s => (
                <option key={s} value={s}>Section {s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">Date</label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">Time Slot</label>
            <select
              value={filters.filterType}
              onChange={(e) => setFilters((f) => ({ ...f, filterType: e.target.value }))}
              className="w-full rounded border border-line px-3 py-2 text-sm font-medium"
            >
              <option value="Now">Current Time</option>
              <option value="Morning">Morning (09:00 - 13:00)</option>
              <option value="Afternoon">Afternoon (13:00 - 17:00)</option>
              <option value="Whole">Whole Day (09:00 - 17:00)</option>
              <option value="Custom">Custom Slot</option>
            </select>
          </div>

          {filters.filterType === 'Custom' && (
            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="mb-1 block text-xs font-semibold text-navy">Start</label>
                <input
                  type="time"
                  value={filters.customStart}
                  onChange={(e) => setFilters((f) => ({ ...f, customStart: e.target.value }))}
                  className="w-full rounded border border-line px-2 py-2 text-sm"
                />
              </div>
              <div className="w-1/2">
                <label className="mb-1 block text-xs font-semibold text-navy">End</label>
                <input
                  type="time"
                  value={filters.customEnd}
                  onChange={(e) => setFilters((f) => ({ ...f, customEnd: e.target.value }))}
                  className="w-full rounded border border-line px-2 py-2 text-sm"
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {error && <div className="mt-4 rounded bg-brick-light p-3 text-sm text-brick">{error}</div>}

      {/* Results */}
      <div className="mt-8">
        {loading ? (
          <div className="text-sm text-ink/60">Loading schedule...</div>
        ) : timetables.length === 0 ? (
          <div className="rounded-xl border border-line border-dashed p-10 text-center text-ink/50">
            No classes found for the selected filters.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-ink">
                <thead className="bg-paper border-b border-line text-xs uppercase text-navy">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold">Class / Course</th>
                    <th className="px-4 py-3 font-semibold">Faculty Name</th>
                    <th className="px-4 py-3 font-semibold">Room</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {timetables.map((t) => (
                    <tr key={t.timetableId} className="hover:bg-paper/50">
                      <td className="px-4 py-3 whitespace-nowrap">{fmtTimeSlot(t.startTime, t.endTime)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-navy">{t.courseCode}</div>
                        <div className="text-xs text-ink/60 mt-0.5">
                          {t.department?.branchCode} - {t.section}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{t.facultyName || 'Unknown Faculty'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{t.resource?.resourceName || t.resourceId}</div>
                        <div className="text-xs text-ink/60 mt-0.5">
                          {t.resource?.block?.blockName}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
