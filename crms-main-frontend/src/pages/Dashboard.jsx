import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { masterDataApi, resourcesApi } from '../api/endpoints';
import { useAuth } from '../context/authStore';
import { ROLES } from '../constants/roles';

function todayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TYPE_COLORS = {
  Classroom: 'bg-navy/10 text-navy',
  Laboratory: 'bg-forest/10 text-forest',
  Lab: 'bg-forest/10 text-forest',
  'Seminar Hall': 'bg-amber/15 text-amber',
  Auditorium: 'bg-amber/15 text-amber',
  'Meeting Room': 'bg-ink/10 text-ink/70',
};

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user && [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN].includes(user.roleId);

  const [resourceTypes, setResourceTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [filters, setFilters] = useState({
    resourceTypeId: '',
    departmentId: '',
    blockId: '',
    minCapacity: '',
    search: '',
    availability: 'All'
  });
  
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [filterType, setFilterType] = useState('Now'); // Now, Morning, Afternoon, Whole, Custom
  const [customStart, setCustomStart] = useState('09:00');
  const [customEnd, setCustomEnd] = useState('17:00');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  const [resources, setResources] = useState([]);
  const [liveStatusMap, setLiveStatusMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    if (newDate !== todayStr() && filterType === 'Now') {
      setFilterType('Whole');
    }
  };

  const getFilterTimes = useCallback(() => {
    let startTimeParam = '';
    let endTimeParam = '';

    if (filterType === 'Morning') {
      startTimeParam = '09:00';
      endTimeParam = '13:00';
    } else if (filterType === 'Afternoon') {
      startTimeParam = '13:00';
      endTimeParam = '17:00';
    } else if (filterType === 'Whole') {
      startTimeParam = '09:00';
      endTimeParam = '17:00';
    } else if (filterType === 'Custom') {
      startTimeParam = customStart;
      endTimeParam = customEnd;
    } else if (filterType === 'Now') {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      startTimeParam = `${hours}:${mins}`;
      endTimeParam = `${hours}:${mins}`;
    }

    return { startTimeParam, endTimeParam };
  }, [filterType, customStart, customEnd]);

  useEffect(() => {
    Promise.all([
      masterDataApi.resourceTypes(),
      masterDataApi.departments(),
      masterDataApi.blocks(),
    ])
      .then(([types, depts, blks]) => {
        setResourceTypes(types);
        setDepartments(depts);
        setBlocks(blks);
      })
      .catch((err) => {
        console.error('Failed to load master data', err);
      });
  }, []);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    const params = {};
    if (filters.resourceTypeId) params.resourceTypeId = filters.resourceTypeId;
    if (filters.departmentId) params.departmentId = filters.departmentId;
    if (filters.blockId) params.blockId = filters.blockId;
    if (filters.search) params.search = filters.search;

    const handle = setTimeout(() => {
      const { startTimeParam, endTimeParam } = getFilterTimes();

      Promise.all([
        resourcesApi.list(params),
        resourcesApi.liveStatus(selectedDate, startTimeParam, endTimeParam)
      ])
        .then(([listData, liveData]) => {
          if (!isCancelled) {
            setResources(listData);
            const statusMap = {};
            liveData.forEach(r => {
              statusMap[r.resourceId] = r;
            });
            setLiveStatusMap(statusMap);
          }
        })
        .catch((err) => {
          if (!isCancelled) {
            console.error('Failed to fetch resources', err);
            setResources([]);
            setLiveStatusMap({});
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setLoading(false);
          }
        });
    }, 250); // light debounce on the search box

    return () => {
      isCancelled = true;
      clearTimeout(handle);
    };
  }, [filters.resourceTypeId, filters.departmentId, filters.blockId, filters.search, selectedDate, getFilterTimes]);

  const filteredResources = resources.filter((r) => {
    if (filters.minCapacity && Number(r.capacityOrAreaSqm || 0) < Number(filters.minCapacity)) return false;
    
    if (filters.availability !== 'All') {
      const liveData = liveStatusMap[r.resourceId];
      const isFree = liveData ? liveData.isFree : true;
      if (filters.availability === 'Free' && !isFree) return false;
      if (filters.availability === 'In Use' && isFree) return false;
    }
    
    return true;
  });

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-navy">Find a resource</h1>
      <p className="mt-1 text-sm text-ink/60">
        Search classrooms, labs, seminar halls, and auditoriums across campus.
      </p>

      <div className="mt-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by name..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="rounded border border-line bg-white px-3 py-2 text-sm flex-1"
          />
          <button 
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="md:hidden flex items-center justify-center rounded border border-line bg-white px-3 py-2 text-ink/70 hover:bg-paper"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>

        <div className={`${showMobileFilters ? 'grid' : 'hidden'} md:grid mt-3 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4`}>
        {/* Row 1 */}
        
        <div className="flex items-center gap-2 w-full">
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="rounded border border-line px-2 py-2 text-sm bg-white w-full"
          />
        </div>

        <div className="flex items-center gap-2 w-full">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded border border-line px-3 py-2 text-sm bg-white font-medium w-full"
          >
            <option value="Now">Current Time</option>
            <option value="Morning">Morning (09:00 - 13:00)</option>
            <option value="Afternoon">Afternoon (13:00 - 17:00)</option>
            <option value="Whole">Whole Day (09:00 - 17:00)</option>
            <option value="Custom">Custom Slot</option>
          </select>
        </div>

        <select 
          value={filters.availability}
          onChange={(e) => setFilters((f) => ({ ...f, availability: e.target.value }))}
          className="rounded border border-line px-3 py-2 text-sm bg-white w-full"
        >
          <option value="All">All Statuses</option>
          <option value="Free">Free</option>
          <option value="In Use">In Use</option>
        </select>

        {/* Custom time slots row (only shows if Custom is selected) */}
        {filterType === 'Custom' && (
          <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex items-center gap-2 bg-paper/50 p-2 rounded border border-line">
            <span className="text-sm font-medium text-navy">Custom Time Slot:</span>
            <input
              type="time"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded border border-line px-2 py-1 text-sm bg-white"
            />
            <span className="text-sm text-ink/60">to</span>
            <input
              type="time"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded border border-line px-2 py-1 text-sm bg-white"
            />
          </div>
        )}

        {/* Row 2 */}
        <select
          value={filters.resourceTypeId}
          onChange={(e) => setFilters((f) => ({ ...f, resourceTypeId: e.target.value }))}
          className="rounded border border-line bg-white px-3 py-2 text-sm w-full"
        >
          <option value="">All resource types</option>
          {resourceTypes.map((t) => (
            <option key={t.resourceTypeId} value={t.resourceTypeId}>
              {t.typeName}
            </option>
          ))}
        </select>

        <select
          value={filters.minCapacity}
          onChange={(e) => setFilters((f) => ({ ...f, minCapacity: e.target.value }))}
          className="rounded border border-line bg-white px-3 py-2 text-sm w-full"
        >
          <option value="">All capacities</option>
          <option value="30">30+ seats</option>
          <option value="60">60+ seats</option>
          <option value="100">100+ seats</option>
          <option value="200">200+ seats</option>
          <option value="300">300+ seats</option>
        </select>

        <select
          value={filters.blockId}
          onChange={(e) => setFilters((f) => ({ ...f, blockId: e.target.value }))}
          className="rounded border border-line bg-white px-3 py-2 text-sm w-full"
        >
          <option value="">All blocks</option>
          {blocks.map((b) => (
            <option key={b.blockId} value={b.blockId}>
              {b.blockName}
            </option>
          ))}
        </select>

        <select
          value={filters.departmentId}
          onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value }))}
          className="rounded border border-line bg-white px-3 py-2 text-sm w-full"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.departmentId} value={d.departmentId}>
              {d.departmentName}
            </option>
          ))}
        </select>
        </div>
      </div>

      {loading ? (
        <p className="mt-10 text-sm text-ink/50">Loading resources…</p>
      ) : filteredResources.length === 0 ? (
        <p className="mt-10 rounded border border-dashed border-line px-6 py-10 text-center text-sm text-ink/50">
          No resources match those filters. Try widening your search.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredResources.map((r) => {
            const liveData = liveStatusMap[r.resourceId];
            const isFree = liveData ? liveData.isFree : true;
            
            return (
              <li key={r.resourceId}>
                {isFree ? (
                  <Link
                    to={`/resources/${r.resourceId}`}
                    state={{
                      filterDate: selectedDate,
                      filterStartTime: getFilterTimes().startTimeParam,
                      filterEndTime: getFilterTimes().endTimeParam
                    }}
                    className={`block h-full flex flex-col rounded-lg border p-3 transition-shadow hover:shadow-md ${
                      filters.availability === 'Free' 
                        ? 'bg-forest-light border-forest/40' 
                        : 'bg-white border-line'
                    }`}
                  >
                    <ResourceCardContent r={r} isFree={true} filterType={filterType} />
                  </Link>
                ) : isAdmin ? (
                  <button 
                    onClick={() => setSelectedRoom(liveData)}
                    className="w-full h-full flex flex-col text-left block rounded-lg border border-brick/30 bg-brick-light/30 p-3 opacity-75 hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <ResourceCardContent r={r} isFree={false} occupant={liveData?.occupant} since={liveData?.since} until={liveData?.until} filterType={filterType} />
                  </button>
                ) : (
                  <div className="block h-full flex flex-col rounded-lg border border-brick/30 bg-brick-light/30 p-3 opacity-75 cursor-default">
                    <ResourceCardContent r={r} isFree={false} occupant={liveData?.occupant} since={liveData?.since} until={liveData?.until} filterType={filterType} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal for Room Details (Admins only) */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b bg-brick-light border-brick/20">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-display font-bold text-navy">{selectedRoom.resourceName}</h2>
                  <p className="text-sm font-mono text-ink/60 mt-1">Block {selectedRoom.block} • {selectedRoom.resourceType}</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-brick/20 text-brick-dark">
                  In Use
                </span>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink/40 mb-2">Current Activity</h4>
                  {selectedRoom.occupantList && selectedRoom.occupantList.length > 0 ? (
                    <div className="space-y-3">
                      {selectedRoom.occupantList.map((occ, idx) => (
                        <div key={idx} className="bg-paper/50 p-4 rounded-lg border border-line">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                             <div className="font-semibold text-navy">
                               {occ.type === 'class' ? (
                                  <>
                                     {occ.courseName || occ.courseCode} 
                                     {occ.courseName && occ.courseName !== occ.courseCode && <span className="text-sm font-normal text-ink/70 ml-1">({occ.courseCode})</span>}
                                  </>
                               ) : (
                                  occ.purpose
                               )}
                             </div>
                             <span className="text-xs font-mono font-semibold bg-brick-light/50 text-brick-dark px-2 py-1 rounded shrink-0">
                                {occ.startTime} - {occ.endTime}
                             </span>
                          </div>
                          {occ.type === 'class' ? (
                             <div className="mt-3 text-sm text-ink/80 flex flex-col gap-1.5">
                                <div><span className="font-medium text-ink mr-1">Class:</span> {occ.branchStr}</div>
                                {occ.facultyName && <div><span className="font-medium text-ink mr-1">Faculty:</span> {occ.facultyName}</div>}
                             </div>
                          ) : (
                             <div className="mt-3 text-sm text-ink/80">
                                <div><span className="font-medium text-ink mr-1">Booked by:</span> {occ.requesterName}</div>
                             </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <p className="text-base font-medium text-ink bg-paper/50 p-3 rounded-lg border border-line">
                        {selectedRoom.occupant}
                      </p>
                      {selectedRoom.until && (
                        <p className="text-sm font-semibold text-brick mt-2">
                          {selectedRoom.since && selectedRoom.until ? `${selectedRoom.since.substring(11, 16)} to ${selectedRoom.until.substring(11, 16)}` : ''}
                        </p>
                      )}
                    </>
                  )}
                </div>
                
                {selectedRoom.occupantContact && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink/40 mb-2">Contact Details</h4>
                    <div className="bg-paper/50 p-4 rounded-lg border border-line space-y-3">
                      <p className="font-semibold text-navy">{selectedRoom.occupantContact.name}</p>
                      <div className="flex flex-col gap-2 text-sm font-mono">
                        {selectedRoom.occupantContact.phone && (
                          <a href={`tel:${selectedRoom.occupantContact.phone}`} className="text-navy hover:underline flex items-center gap-2">
                            <span className="text-lg">📞</span> {selectedRoom.occupantContact.phone}
                          </a>
                        )}
                        {selectedRoom.occupantContact.email && (
                          <a href={`mailto:${selectedRoom.occupantContact.email}`} className="text-navy hover:underline flex items-center gap-2">
                            <span className="text-lg">✉️</span> {selectedRoom.occupantContact.email}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 bg-paper/50 border-t border-line text-right">
              <button 
                onClick={() => setSelectedRoom(null)}
                className="px-5 py-2 bg-navy text-white text-sm font-semibold rounded hover:bg-navy-dark transition-colors"
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

function ResourceCardContent({ r, isFree, occupant, since, until, filterType }) {
  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-base font-semibold text-ink">
            {r.resourceId?.startsWith('RM-') ? (
              r.resourceName
            ) : (
              <>
                {r.resourceId}
                {r.resourceName && r.resourceName !== r.resourceId && (
                  <span className="block text-sm font-normal text-ink/70 mt-0.5">{r.resourceName}</span>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              TYPE_COLORS[r.resourceType?.typeName] || 'bg-ink/10 text-ink/70'
            }`}
          >
            {r.resourceType?.typeName}
          </span>
          {!isFree && (
            <span className="rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-brick/15 text-brick-dark">
              In Use
            </span>
          )}
        </div>
      </div>
      <div className="mt-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/60">
          {r.department && <span>{r.department.departmentName}</span>}
          {r.block && <span>{r.block.blockName}{r.floor ? `, Floor ${r.floor}` : ''}</span>}
          {r.capacityOrAreaSqm && (
            <span>
              Capacity {Math.floor(r.capacityOrAreaSqm)}
            </span>
          )}
        </div>
      </div>
      <div className="mt-auto pt-3">
        {isFree ? (
          <div className="flex h-10 flex-col items-center justify-center rounded border border-forest/20 bg-forest-light/30 px-3 py-1 text-xs font-semibold text-forest-dark">
            {filterType === 'Whole' ? 'Available Whole Day' :
             filterType === 'Morning' ? 'Available Morning' :
             filterType === 'Afternoon' ? 'Available Afternoon' :
             filterType === 'Custom' ? 'Available Custom Slot' :
             'Available Now'}
          </div>
        ) : occupant ? (
          <div className="flex h-10 flex-col justify-center rounded border border-brick/10 bg-brick/5 px-3 py-1 text-xs font-medium text-brick-dark">
            <span className="truncate">{occupant}</span>
            {since && until && (
              <span className="mt-0.5 font-mono text-[10px] text-brick-dark/70">
                {new Date(since).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} to {new Date(until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
              </span>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
