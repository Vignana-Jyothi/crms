import { useEffect, useState } from 'react';
import { masterDataApi, resourcesApi, timetableApi } from '../../api/endpoints';
import { fmtTimeSlot } from '../../utils/formatters';
import WeeklyGrid from '../../components/admin/WeeklyGrid';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function FacultyCalendarView() {
  const [displayLayout, setDisplayLayout] = useState('List'); // List, Grid

  const [facultyList, setFacultyList] = useState([]);
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    facultyName: '',
    date: todayStr(),
    filterType: 'Whole',
    customStart: '09:00',
    customEnd: '17:00',
    status: 'All'
  });

  // Load faculty list on mount
  useEffect(() => {
    timetableApi.list({}).then(data => {
      const faculties = [...new Set(data.map(t => t.facultyName).filter(Boolean))].sort();
      setFacultyList(faculties);
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

    const params = { dayOfWeek };
    if (startTimeParam) params.startTime = startTimeParam;
    if (endTimeParam) params.endTime = endTimeParam;
    if (filters.facultyName) params.facultyName = filters.facultyName;

    timetableApi
      .list(params)
      .then(data => {
        setTimetables(data);
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load schedule.'))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [filters]);

  // Calculate Free items
  let freeItems = [];
  if (!loading && filters.status === 'Free_Faculty') {
    const occupiedFaculty = new Set(timetables.map(t => t.facultyName).filter(Boolean));
    let freeFacultyList = facultyList.filter(f => !occupiedFaculty.has(f));
    if (filters.facultyName) freeFacultyList = freeFacultyList.filter(f => f.includes(filters.facultyName));
        
    freeItems = freeFacultyList.map(f => ({ name: f }));
  }

  const handleAssignFaculty = async (timetableId, facultyName) => {
    try {
      await timetableApi.update(timetableId, { facultyName });
      setTimetables(prev => prev.map(t => 
        t.timetableId === timetableId ? { ...t, facultyName } : t
      ));
    } catch (err) {
      console.error('Failed to assign faculty:', err);
      alert('Failed to assign faculty');
    }
  };

  const getDayStr = () => {
    const d = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[d.getDay()];
  };

  const isLive = (t) => {
    const today = new Date();
    const dayStr = getDayStr();
    if (t.dayOfWeek !== dayStr) return false;
    
    if (!t.startTime || !t.endTime) return false;
    const s = new Date(t.startTime);
    const e = new Date(t.endTime);
    
    const startObj = new Date(today.getFullYear(), today.getMonth(), today.getDate(), s.getUTCHours(), s.getUTCMinutes());
    const endObj = new Date(today.getFullYear(), today.getMonth(), today.getDate(), e.getUTCHours(), e.getUTCMinutes());
    
    return today >= startObj && today <= endObj;
  };

  const detectConflicts = (timetablesList) => {
    const conflicts = new Set();
    const active = timetablesList.filter(t => t.dayOfWeek); 
    
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const t1 = active[i];
        const t2 = active[j];
        
        if (t1.dayOfWeek === t2.dayOfWeek) {
          const start1 = new Date(t1.startTime).getTime();
          const end1 = new Date(t1.endTime).getTime();
          const start2 = new Date(t2.startTime).getTime();
          const end2 = new Date(t2.endTime).getTime();
          
          if (start1 < end2 && start2 < end1) {
            if (t1.resourceId === t2.resourceId) {
              conflicts.add(t1.timetableId);
              conflicts.add(t2.timetableId);
            }
            if (t1.facultyName && t1.facultyName === t2.facultyName) {
              conflicts.add(t1.timetableId);
              conflicts.add(t2.timetableId);
            }
          }
        }
      }
    }
    return conflicts;
  };
  
  const conflictsSet = detectConflicts(timetables);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy mb-1">Faculty Calendar</h1>
          <p className="text-sm text-ink/70 mb-6">View schedules and availability for faculty members.</p>
        </div>
        
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex bg-line/30 p-1 rounded-lg self-start">
              {['List', 'Grid'].map(layout => (
                <button
                  key={layout}
                  onClick={() => setDisplayLayout(layout)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    displayLayout === layout 
                      ? 'bg-white text-navy shadow-sm' 
                      : 'text-ink/60 hover:text-navy hover:bg-white/50'
                  }`}
                >
                  {layout}
                </button>
              ))}
            </div>
            <button 
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-navy text-white text-sm font-semibold rounded-md shadow hover:bg-navy/90 flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col md:flex-row md:flex-wrap gap-4 items-end">
          
          <div className="w-full md:w-48">
            <label className="mb-1 block text-xs font-semibold text-navy">Faculty Name</label>
            <select
              value={filters.facultyName}
              onChange={(e) => setFilters((f) => ({ ...f, facultyName: e.target.value }))}
              className="w-full rounded border border-line px-2 py-2 text-sm bg-white focus:border-navy focus:ring-1 focus:ring-navy"
            >
              <option value="">All Faculty</option>
              {facultyList.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-48">
            <label className="mb-1 block text-xs font-semibold text-navy">Date</label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
              className="w-full rounded border border-line px-3 py-2 text-sm focus:border-navy focus:ring-1 focus:ring-navy"
            />
          </div>

          <div className="w-full md:w-48">
            <label className="mb-1 block text-xs font-semibold text-navy">Time Slot</label>
            <select
              value={filters.filterType}
              onChange={(e) => setFilters((f) => ({ ...f, filterType: e.target.value }))}
              className="w-full rounded border border-line px-3 py-2 text-sm font-medium focus:border-navy focus:ring-1 focus:ring-navy"
            >
              <option value="Now">Current Time</option>
              <option value="Morning">Morning (09:00 - 13:00)</option>
              <option value="Afternoon">Afternoon (13:00 - 17:00)</option>
              <option value="Whole">Whole Day (09:00 - 17:00)</option>
              <option value="Custom">Custom Slot</option>
            </select>
          </div>

          <div className="w-full md:w-48">
            <label className="mb-1 block text-xs font-semibold text-navy">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded border border-line px-2 py-2 text-sm bg-white focus:border-navy focus:ring-1 focus:ring-navy"
            >
              <option value="All">All Schedules</option>
              <option value="Busy">In Use / Busy</option>
              <option value="Free_Faculty">Free / Available Faculty</option>
            </select>
          </div>

          {filters.filterType === 'Custom' && (
            <div className="flex gap-2 w-full border-t border-line/50 pt-3 mt-1">
              <div className="w-48">
                <label className="mb-1 block text-xs font-semibold text-navy">Custom Start</label>
                <input
                  type="time"
                  value={filters.customStart}
                  onChange={(e) => setFilters((f) => ({ ...f, customStart: e.target.value }))}
                  className="w-full rounded border border-line px-2 py-2 text-sm focus:border-navy focus:ring-1 focus:ring-navy"
                />
              </div>
              <div className="w-48">
                <label className="mb-1 block text-xs font-semibold text-navy">Custom End</label>
                <input
                  type="time"
                  value={filters.customEnd}
                  onChange={(e) => setFilters((f) => ({ ...f, customEnd: e.target.value }))}
                  className="w-full rounded border border-line px-2 py-2 text-sm focus:border-navy focus:ring-1 focus:ring-navy"
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
        ) : filters.status.startsWith('Free') ? (
          freeItems.length === 0 ? (
            <div className="rounded-xl border border-line border-dashed p-10 text-center text-ink/50 bg-white/50">
              No available items found for this time.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {freeItems.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-50/50 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-navy">
                      {filters.status === 'Free_Room' && item.resourceName}
                      {filters.status === 'Free_Faculty' && item}
                      {filters.status === 'Free_Section' && `${item.department.branchCode} - Sec ${item.section}`}
                    </div>
                    {filters.status === 'Free_Room' && (
                      <div className="text-xs text-ink/60 mt-0.5">
                        {item.block?.blockCode ? `Block ${item.block.blockCode}` : ''}
                      </div>
                    )}
                  </div>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">Available</span>
                </div>
              ))}
            </div>
          )
        ) : displayLayout === 'Grid' && !filters.status.startsWith('Free') ? (
          <WeeklyGrid 
            timetables={timetables} 
            onAssignFaculty={handleAssignFaculty} 
            facultyList={facultyList} 
          />
        ) : timetables.length === 0 ? (
          <div className="rounded-xl border border-line border-dashed p-10 text-center text-ink/50 bg-white/50">
            No classes found for the selected filters.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-ink">
                <thead className="bg-paper border-b border-line text-xs uppercase text-navy">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold">Room</th>
                    <th className="px-4 py-3 font-semibold">Class / Course</th>
                    <th className="px-4 py-3 font-semibold">Faculty Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {timetables.map((t) => {
                    const isConflict = conflictsSet.has(t.timetableId);
                    const live = isLive(t);
                    return (
                    <tr key={t.timetableId} className={`hover:bg-paper/50 transition-colors ${live ? 'bg-amber-50/50' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap relative">
                        {live && (
                           <span className="absolute left-1 top-1/2 -translate-y-1/2 flex h-2 w-2">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                           </span>
                        )}
                        <div className="font-medium">{fmtTimeSlot(t.startTime, t.endTime)}</div>
                        <div className="flex flex-col gap-1 mt-1 items-start">
                          {(filters.status === 'Busy' || filters.status === 'All') && (
                            <span className="inline-block px-1.5 py-0.5 bg-brick/10 text-brick rounded text-[10px] font-bold uppercase tracking-wider">In Use</span>
                          )}
                          {isConflict && (
                            <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold uppercase tracking-wider border border-red-200 shadow-sm">Conflict</span>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {t.resource?.resourceName && !/^\d(?:st|nd|rd|th)\s+Year/i.test(t.resource.resourceName) 
                            ? t.resource.resourceName 
                            : '-'}
                        </div>
                        <div className="text-xs text-ink/60 mt-0.5">
                          {t.resource?.block?.blockCode ? `Block ${t.resource.block.blockCode}` : ''}
                        </div>
                      </td>
                      
                      <td className="px-4 py-3">
                        <div className="font-medium text-navy">{t.courseCode}</div>
                        <div className="text-xs text-ink/60 mt-0.5">
                          {t.studentYear ? `${t.studentYear} ` : ''}{t.department?.branchCode} - Sec {t.section}
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 font-medium text-ink/80">
                        {t.facultyName ? (
                          t.facultyName
                        ) : (
                          <span className="text-ink/40 italic">Unassigned</span>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
