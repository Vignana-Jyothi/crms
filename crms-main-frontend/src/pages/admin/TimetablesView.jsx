import { useEffect, useState } from 'react';
import { masterDataApi, resourcesApi, timetableApi } from '../../api/endpoints';
import { fmtTimeSlot } from '../../utils/formatters';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TimetablesView() {
  const [viewMode, setViewMode] = useState('Classroom'); // Classroom, Section, Faculty

  const [resourceList, setResourceList] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    resourceId: '',
    departmentId: '',
    section: '',
    facultyName: '',
    date: todayStr(),
    filterType: 'Whole',
    customStart: '09:00',
    customEnd: '17:00',
    status: 'All'
  });

  // Load all master data on mount
  useEffect(() => {
    Promise.all([
      resourcesApi.list().then(data => {
        const filtered = data.filter(r => 
          (r.resourceType?.typeName === 'Classroom' || r.resourceType?.typeName === 'Lab') &&
          !/^\d(?:st|nd|rd|th)\s+Year/i.test(r.resourceName)
        );
        setResourceList(filtered);
      }),
      masterDataApi.faculty().then(setFacultyList),
      masterDataApi.departments().then(setDepartments),
      masterDataApi.sections().then(setSections)
    ]).catch(() => {});
  }, []);

  // Clear specific filters when mode changes to prevent confusing queries
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      resourceId: '',
      departmentId: '',
      section: '',
      facultyName: ''
    }));
  }, [viewMode]);

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

    if (viewMode === 'Classroom' && filters.resourceId) params.resourceId = filters.resourceId;
    if (viewMode === 'Section') {
      if (filters.departmentId) params.departmentId = filters.departmentId;
      if (filters.section) params.section = filters.section;
    }
    if (viewMode === 'Faculty' && filters.facultyName) params.facultyName = filters.facultyName;

    timetableApi
      .list(params)
      .then(data => {
        if (viewMode === 'Faculty') {
          // If searching faculty, filter out slots with no faculty assigned
          setTimetables(data.filter((t) => t.facultyName));
        } else {
          setTimetables(data);
        }
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load schedule.'))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [filters, viewMode]);

  const availableSections = filters.departmentId 
    ? sections.filter(s => s.departmentId === Number(filters.departmentId))
    : sections;
  const uniqueSectionNames = [...new Set(availableSections.map(s => s.section))];

  // Calculate Free items
  let freeItems = [];
  if (filters.status === 'Free' && !loading) {
    if (viewMode === 'Classroom') {
      const occupiedResourceIds = new Set(timetables.map(t => t.resourceId));
      freeItems = resourceList.filter(r => !occupiedResourceIds.has(r.resourceId));
      if (filters.resourceId) freeItems = freeItems.filter(r => r.resourceId === Number(filters.resourceId));
    } else if (viewMode === 'Faculty') {
      const occupiedFaculty = new Set(timetables.filter(t => t.facultyName).map(t => t.facultyName));
      freeItems = facultyList.filter(f => !occupiedFaculty.has(f));
      if (filters.facultyName) freeItems = freeItems.filter(f => f === filters.facultyName);
    } else if (viewMode === 'Section') {
      const occupiedSections = new Set(timetables.map(t => `${t.departmentId}-${t.section}`));
      const allCombinations = [];
      const deptsToUse = filters.departmentId 
        ? departments.filter(d => d.departmentId === Number(filters.departmentId)) 
        : departments;
        
      for (const dept of deptsToUse) {
        const deptSections = sections.filter(s => s.departmentId === dept.departmentId);
        const uniqueSecs = [...new Set(deptSections.map(s => s.section))];
        for (const sec of uniqueSecs) {
          if (!occupiedSections.has(`${dept.departmentId}-${sec}`)) {
            if (!filters.section || filters.section === sec) {
              allCombinations.push({ department: dept, section: sec });
            }
          }
        }
      }
      freeItems = allCombinations;
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">All Timetables</h1>
          <p className="mt-1 text-sm text-ink/60">
            Search for class schedules by classroom, section, or faculty member.
          </p>
        </div>
        
        {/* Mode Toggle */}
        <div className="flex bg-line/30 p-1 rounded-lg self-start">
          {['Classroom', 'Section', 'Faculty'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === mode 
                  ? 'bg-white text-navy shadow-sm' 
                  : 'text-ink/60 hover:text-navy hover:bg-white/50'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 rounded-xl border border-line bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5 items-end">
          
          {/* Dynamic Filters based on Mode */}
          {viewMode === 'Classroom' && (
            <div className="col-span-1">
              <label className="mb-1 block text-xs font-semibold text-navy">Classroom / Lab</label>
              <select
                value={filters.resourceId}
                onChange={(e) => setFilters((f) => ({ ...f, resourceId: e.target.value }))}
                className="w-full rounded border border-line px-3 py-2 text-sm focus:border-navy focus:ring-1 focus:ring-navy"
              >
                <option value="">All Rooms</option>
                {resourceList.map(r => (
                  <option key={r.resourceId} value={r.resourceId}>{r.resourceName}</option>
                ))}
              </select>
            </div>
          )}

          {viewMode === 'Faculty' && (
            <div className="col-span-1">
              <label className="mb-1 block text-xs font-semibold text-navy">Faculty Name</label>
              <select
                value={filters.facultyName}
                onChange={(e) => setFilters((f) => ({ ...f, facultyName: e.target.value }))}
                className="w-full rounded border border-line px-3 py-2 text-sm focus:border-navy focus:ring-1 focus:ring-navy"
              >
                <option value="">All Faculty</option>
                {facultyList.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}

          {viewMode === 'Section' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-navy">Branch / Dept</label>
                <select
                  value={filters.departmentId}
                  onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value, section: '' }))}
                  className="w-full rounded border border-line px-3 py-2 text-sm focus:border-navy focus:ring-1 focus:ring-navy"
                >
                  <option value="">All Branches</option>
                  {departments.map(d => (
                    <option key={d.departmentId} value={d.departmentId}>{d.branchCode}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-navy">Section</label>
                <select
                  value={filters.section}
                  onChange={(e) => setFilters((f) => ({ ...f, section: e.target.value }))}
                  className="w-full rounded border border-line px-3 py-2 text-sm focus:border-navy focus:ring-1 focus:ring-navy"
                  disabled={!filters.departmentId && uniqueSectionNames.length === 0}
                >
                  <option value="">All Sections</option>
                  {uniqueSectionNames.map(s => (
                    <option key={s} value={s}>Section {s}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Shared Filters */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">Date</label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
              className="w-full rounded border border-line px-3 py-2 text-sm focus:border-navy focus:ring-1 focus:ring-navy"
            />
          </div>

          <div>
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

          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded border border-line px-3 py-2 text-sm font-medium focus:border-navy focus:ring-1 focus:ring-navy"
            >
              <option value="All">All Schedules</option>
              <option value="Free">Available / Free</option>
              <option value="Busy">In Use / Busy</option>
            </select>
          </div>

          {filters.filterType === 'Custom' && (
            <div className="flex gap-2 col-span-1 md:col-span-5 border-t border-line/50 pt-3 mt-1">
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
        ) : filters.status === 'Free' ? (
          freeItems.length === 0 ? (
            <div className="rounded-xl border border-line border-dashed p-10 text-center text-ink/50 bg-white/50">
              No available {viewMode.toLowerCase()}s found for this time.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {freeItems.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-50/50 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-navy">
                      {viewMode === 'Classroom' && item.resourceName}
                      {viewMode === 'Faculty' && item}
                      {viewMode === 'Section' && `${item.department.branchCode} - Sec ${item.section}`}
                    </div>
                    {viewMode === 'Classroom' && (
                      <div className="text-xs text-ink/60 mt-0.5">{item.block?.blockName}</div>
                    )}
                  </div>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">Available</span>
                </div>
              ))}
            </div>
          )
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
                  {timetables.map((t) => (
                    <tr key={t.timetableId} className="hover:bg-paper/50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium">{fmtTimeSlot(t.startTime, t.endTime)}</div>
                        {(filters.status === 'Busy' || filters.status === 'All') && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 bg-brick/10 text-brick rounded text-[10px] font-bold uppercase tracking-wider">In Use</span>
                        )}
                      </td>
                      
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {t.resource?.resourceName && !/^\d(?:st|nd|rd|th)\s+Year/i.test(t.resource.resourceName) 
                            ? t.resource.resourceName 
                            : '-'}
                        </div>
                        <div className="text-xs text-ink/60 mt-0.5">
                          {t.resource?.block?.blockName}
                        </div>
                      </td>
                      
                      <td className="px-4 py-3">
                        <div className="font-medium text-navy">{t.courseCode}</div>
                        <div className="text-xs text-ink/60 mt-0.5">
                          {t.department?.branchCode} - Sec {t.section}
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 font-medium text-ink/80">{t.facultyName || '-'}</td>
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
