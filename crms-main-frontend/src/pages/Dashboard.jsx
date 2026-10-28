import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { masterDataApi, resourcesApi } from '../api/endpoints';
import { useAuth } from '../context/authStore';
import { ROLES } from '../constants/roles';
import RoomQuickSearchModal from '../components/common/RoomQuickSearchModal';

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

const SEMINAR_HALL_NAMES = {
  'C001': 'K S Auditorium',
  'B011': 'B-Block Seminar Hall',
  'D204': 'APJ Abdul Kalam Auditorium'
};

const STORAGE_KEY = 'crms_dashboard_filters';
const QUICK_SEARCH_SHOWN_KEY = 'crms_quick_search_shown';

// Matches the status the live-status API reports for the selected window.
const AVAILABILITY_VALUES = ['All', 'Free', 'Partial', 'Full'];
const LIVE_REFRESH_MS = 60 * 1000;

const CARD_STYLES = {
  Free: 'bg-forest-light/60 border-forest/40',
  Partial: 'bg-amber-light/50 border-amber/50',
  Full: 'bg-brick-light/40 border-brick/30',
};

function toStatusMap(liveData) {
  const statusMap = {};
  liveData.forEach((r) => {
    statusMap[r.resourceId] = r;
  });
  return statusMap;
}

// Back-to-back rows for the same class or booking (e.g. a 3-period lab
// stored as three rows) read better as one line.
function mergeOccupants(list = []) {
  const merged = [];
  [...list]
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .forEach((occ) => {
      const prev = merged.find(
        (m) =>
          m.type === occ.type &&
          m.courseCode === occ.courseCode &&
          m.branchStr === occ.branchStr &&
          m.purpose === occ.purpose &&
          m.endTime === occ.startTime
      );
      if (prev) prev.endTime = occ.endTime;
      else merged.push({ ...occ });
    });
  return merged;
}

function occupantTitle(occ) {
  if (occ.type === 'class') return occ.courseName || occ.courseCode || 'Class';
  return occ.purpose || 'Booking';
}

function occupantSubtitle(occ) {
  if (occ.type === 'class') return occ.branchStr;
  return occ.status === 'Pending' ? 'Booking · awaiting approval' : 'Booking';
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user && [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN].includes(user.roleId);

  const [resourceTypes, setResourceTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [blocks, setBlocks] = useState([]);
  
  const savedFiltersStr = sessionStorage.getItem(STORAGE_KEY);
  const savedFilters = JSON.parse(savedFiltersStr || '{}');
  const hasShownQuickSearch = sessionStorage.getItem(QUICK_SEARCH_SHOWN_KEY) === 'true';
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(!hasShownQuickSearch);

  useEffect(() => {
    if (!hasShownQuickSearch) {
      sessionStorage.setItem(QUICK_SEARCH_SHOWN_KEY, 'true');
    }
  }, [hasShownQuickSearch]);

  const [filters, setFilters] = useState(() => {
    const initial = savedFilters.filters || {
      resourceTypeId: '', departmentId: '', blockId: '', minCapacity: '', search: '', availability: 'Free'
    };
    // Older sessions may have saved a value this version no longer offers.
    return AVAILABILITY_VALUES.includes(initial.availability) ? initial : { ...initial, availability: 'Free' };
  });
  
  const [selectedDate, setSelectedDate] = useState(savedFilters.selectedDate || todayStr());
  const [filterType, setFilterType] = useState(savedFilters.filterType || 'Whole'); // Now, Morning, Afternoon, Whole, Custom
  const [customStart, setCustomStart] = useState(savedFilters.customStart || '09:00');
  const [customEnd, setCustomEnd] = useState(savedFilters.customEnd || '17:00');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ filters, selectedDate, filterType, customStart, customEnd }));
  }, [filters, selectedDate, filterType, customStart, customEnd]);
  
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

  const handleQuickSearch = (searchParams) => {
    if (searchParams.date) setSelectedDate(searchParams.date);
    
    if (searchParams.duration === 'FN') setFilterType('Morning');
    else if (searchParams.duration === 'AN') setFilterType('Afternoon');
    else setFilterType('Whole');

    setFilters(prev => ({
      ...prev,
      resourceTypeId: searchParams.resourceTypeId || '',
      minCapacity: searchParams.minCapacity || '',
      departmentId: '', 
      blockId: '',      
      search: '',
      availability: 'Free'
    }));

    setIsQuickSearchOpen(false);
  };

  const getFilterTimes = useCallback(() => {
    let startTimeParam = '';
    let endTimeParam = '';

    if (filterType === 'Morning') {
      startTimeParam = '09:00';
      endTimeParam = '13:00';
    } else if (filterType === 'Afternoon') {
      startTimeParam = '13:00';
      endTimeParam = '16:40';
    } else if (filterType === 'Whole') {
      startTimeParam = '09:00';
      endTimeParam = '16:40';
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

  const slotError =
    filterType === 'Custom' && (!customStart || !customEnd || customStart >= customEnd)
      ? 'Choose a custom slot whose end time is after its start time.'
      : '';
  const isToday = selectedDate === todayStr();

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
    if (slotError) {
      setLoading(false);
      return undefined;
    }
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
            setLiveStatusMap(toStatusMap(liveData));
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
  }, [filters.resourceTypeId, filters.departmentId, filters.blockId, filters.search, selectedDate, getFilterTimes, slotError]);

  // Keep today's view current (new bookings, approvals, rooms coming
  // into or out of use) without a manual reload or a loading flash.
  useEffect(() => {
    if (!isToday || slotError) return undefined;
    const id = setInterval(() => {
      const { startTimeParam, endTimeParam } = getFilterTimes();
      resourcesApi
        .liveStatus(selectedDate, startTimeParam, endTimeParam)
        .then((liveData) => setLiveStatusMap(toStatusMap(liveData)))
        .catch(() => {});
    }, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [isToday, selectedDate, getFilterTimes, slotError]);

  const filteredResources = resources.filter((r) => {
    if (filters.minCapacity && Number(r.capacityOrAreaSqm || 0) < Number(filters.minCapacity)) return false;

    if (filters.availability !== 'All') {
      const status = liveStatusMap[r.resourceId]?.status || 'Free';
      if (status !== filters.availability) return false;
    }

    return true;
  });

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <RoomQuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        onSearch={handleQuickSearch}
        resourceTypes={resourceTypes}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Book a Room</h1>
          <p className="mt-1 text-sm text-ink/60">
            Search classrooms, labs, seminar halls, and auditoriums across campus.
          </p>
        </div>
      </div>

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
            min={todayStr()}
            max={maxDateStr()}
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
            <option value="Morning">Morning (09:00 AM - 01:00 PM)</option>
            <option value="Afternoon">Afternoon (01:00 PM - 04:40 PM)</option>
            <option value="Whole">Whole Day (09:00 AM - 04:40 PM)</option>
            <option value="Custom">Custom Slot</option>
          </select>
        </div>

        <select 
          value={filters.availability}
          onChange={(e) => setFilters((f) => ({ ...f, availability: e.target.value }))}
          className="rounded border border-line px-3 py-2 text-sm bg-white w-full"
        >
          <option value="All">All Statuses</option>
          <option value="Free">Free for the whole slot</option>
          <option value="Partial">Partially booked</option>
          <option value="Full">{filterType === 'Now' ? 'In use' : 'Fully booked'}</option>
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
            {slotError && <span className="text-xs font-medium text-brick">{slotError}</span>}
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
        
        <button
          onClick={() => {
            setFilters({ resourceTypeId: '', departmentId: '', blockId: '', minCapacity: '', search: '', availability: 'Free' });
            setSelectedDate(todayStr());
            setFilterType('Whole');
            setCustomStart('09:00');
            setCustomEnd('17:00');
          }}
          className="flex items-center justify-center gap-1.5 rounded px-3 py-2 text-sm font-medium text-navy/60 hover:text-navy hover:bg-black/5 transition-colors w-full sm:col-span-2 lg:col-span-1 xl:col-span-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear filters
        </button>
        </div>
      </div>

      {slotError ? (
        <p className="mt-10 rounded border border-dashed border-brick/40 px-6 py-10 text-center text-sm text-brick">
          {slotError}
        </p>
      ) : loading ? (
        <p className="mt-10 text-sm text-ink/50">Loading resources…</p>
      ) : filteredResources.length === 0 ? (
        <p className="mt-10 rounded border border-dashed border-line px-6 py-10 text-center text-sm text-ink/50">
          No resources match those filters. Try widening your search.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredResources.map((r) => {
            const live = liveStatusMap[r.resourceId];
            const status = live?.status || 'Free';
            const { startTimeParam, endTimeParam } = getFilterTimes();
            // For a partly booked room, open the booking form on its first free gap.
            const firstFree = status === 'Partial' ? live?.freeSlots?.[0] : null;
            const cardClass = `block h-full w-full flex flex-col text-left rounded-lg border p-3 transition-shadow hover:shadow-md ${CARD_STYLES[status]}`;
            const content = (
              <ResourceCardContent r={r} live={live} status={status} filterType={filterType} showLive={isToday} />
            );

            return (
              <li key={r.resourceId}>
                {status === 'Full' ? (
                  <button type="button" onClick={() => setSelectedRoom(live)} className={`${cardClass} cursor-pointer`}>
                    {content}
                  </button>
                ) : (
                  <Link
                    to={`/resources/${r.resourceId}`}
                    state={{
                      filterDate: selectedDate,
                      filterStartTime: firstFree ? firstFree.startTime : startTimeParam,
                      filterEndTime: firstFree ? firstFree.endTime : endTimeParam,
                    }}
                    className={cardClass}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Room schedule for the selected slot */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b bg-brick-light border-brick/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-display font-bold text-navy">{selectedRoom.resourceName}</h2>
                  <p className="text-sm font-mono text-ink/60 mt-1">Block {selectedRoom.block} • {selectedRoom.resourceType}</p>
                </div>
                <span className="shrink-0 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-brick/20 text-brick">
                  {filterType === 'Now' ? 'In Use' : 'Fully Booked'}
                </span>
              </div>
              {isToday && selectedRoom.inUseNow && selectedRoom.currentOccupant && (
                <LiveBadge occupant={selectedRoom.currentOccupant} className="mt-3" />
              )}
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink/40 mb-2">Schedule in this slot</h4>
                  <div className="space-y-3">
                    {mergeOccupants(selectedRoom.occupantList).map((occ, idx) => (
                      <div key={idx} className="bg-paper/50 p-4 rounded-lg border border-line">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                          <div className="font-semibold text-navy">
                            {occ.type === 'class' ? (
                              <>
                                {occ.courseName || occ.courseCode}
                                {occ.courseName && occ.courseCode && occ.courseName !== occ.courseCode && (
                                  <span className="text-sm font-normal text-ink/70 ml-1">({occ.courseCode})</span>
                                )}
                              </>
                            ) : (
                              occ.purpose
                            )}
                          </div>
                          <span className="text-xs font-mono font-semibold bg-brick-light/50 text-brick px-2 py-1 rounded shrink-0">
                            {occ.startTime} - {occ.endTime}
                          </span>
                        </div>
                        {occ.type === 'class' ? (
                          <div className="mt-3 text-sm text-ink/80 flex flex-col gap-1.5">
                            <div><span className="font-medium text-ink mr-1">Class:</span> {occ.branchStr}</div>
                            {occ.facultyName && <div><span className="font-medium text-ink mr-1">Faculty:</span> {occ.facultyName}</div>}
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-ink/80 flex flex-col gap-1.5">
                            <div><span className="font-medium text-ink mr-1">Booked by:</span> {occ.requesterName || '—'}</div>
                            {occ.status === 'Pending' && <div className="text-xs font-medium text-amber">Awaiting approval</div>}
                          </div>
                        )}
                      </div>
                    ))}
                    {(!selectedRoom.occupantList || selectedRoom.occupantList.length === 0) && (
                      <p className="text-sm text-ink/60">No schedule details available.</p>
                    )}
                  </div>
                </div>

                {isAdmin && selectedRoom.occupantContact && (
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

// Blinking "in use right now" marker.
function LiveBadge({ occupant, className = '' }) {
  return (
    <div className={`flex items-center gap-2 rounded bg-brick/10 px-2 py-1 text-[11px] text-brick ${className}`}>
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brick opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brick" />
      </span>
      <span className="truncate">
        <span className="font-semibold">In use now</span> · {occupantTitle(occupant)} until {occupant.endTime}
      </span>
    </div>
  );
}

const FREE_LABELS = {
  Whole: 'Available Whole Day',
  Morning: 'Available Morning',
  Afternoon: 'Available Afternoon',
  Custom: 'Available Custom Slot',
  Now: 'Available Now',
};

const MAX_CARD_OCCUPANTS = 3;

function ResourceCardContent({ r, live, status, filterType, showLive }) {
  const occupants = mergeOccupants(live?.occupantList);
  const current = showLive && live?.inUseNow ? live.currentOccupant : null;

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-base font-semibold text-ink">
            {(() => {
               const rawId = r.resourceId || '';
               const rawName = r.resourceName || '';

               const checkStr1 = rawId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
               const checkStr2 = rawName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

               const mappedName = SEMINAR_HALL_NAMES[checkStr1] || SEMINAR_HALL_NAMES[checkStr2];

               if (mappedName) {
                  const base = rawId.startsWith('RM-') ? rawName : rawId;
                  return `${base} - ${mappedName}`;
               }

               if (rawId.startsWith('RM-')) return r.resourceName;

               return (
                  <>
                    {rawId}
                    {r.resourceName && r.resourceName !== rawId && (
                      <span className="block text-sm font-normal text-ink/70 mt-0.5">{r.resourceName}</span>
                    )}
                  </>
               );
            })()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium bg-navy/10 text-navy"
          >
            {r.resourceType?.typeName}
          </span>
          {status === 'Partial' && (
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-amber/15 text-amber">
              <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse" />
              Partly booked
            </span>
          )}
          {status === 'Full' && (
            <span className="rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-brick/15 text-brick">
              {filterType === 'Now' ? 'In Use' : 'Fully booked'}
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
      {current && <LiveBadge occupant={current} className="mt-2" />}
      <div className="mt-auto pt-3">
        {status === 'Free' ? (
          <div className="flex h-10 flex-col items-center justify-center rounded border border-forest/20 bg-forest-light/30 px-3 py-1 text-xs font-semibold text-forest">
            {FREE_LABELS[filterType] || 'Available'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {status === 'Partial' && live?.freeSlots?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                <span className="font-semibold text-forest">Free:</span>
                {live.freeSlots.map((s) => (
                  <span key={s.startTime} className="rounded bg-forest-light px-1.5 py-0.5 font-mono text-forest">
                    {s.startTime}–{s.endTime}
                  </span>
                ))}
              </div>
            )}
            <ul className="divide-y divide-line rounded border border-line bg-white/70">
              {occupants.slice(0, MAX_CARD_OCCUPANTS).map((o, i) => (
                <li key={i} className="flex gap-2 px-2 py-1 text-[11px] text-ink/80">
                  <span className="shrink-0 font-mono text-ink/60">
                    {o.startTime}–{o.endTime}
                  </span>
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-ink">{occupantTitle(o)}</span>
                    {occupantSubtitle(o) && <span className="text-ink/60"> · {occupantSubtitle(o)}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {(occupants.length > MAX_CARD_OCCUPANTS || status === 'Full') && (
              <p className="text-[11px] text-ink/50">
                {occupants.length > MAX_CARD_OCCUPANTS && `+${occupants.length - MAX_CARD_OCCUPANTS} more · `}
                {status === 'Full' ? 'Tap for full schedule' : 'Open to see the full day'}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
