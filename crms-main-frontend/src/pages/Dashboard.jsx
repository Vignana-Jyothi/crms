import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, MapPin, SearchX, Users } from 'lucide-react';
import { masterDataApi, resourcesApi } from '../api/endpoints';
import { useAuth } from '../context/authStore';
import { ROLES, BOOKERS } from '../constants/roles';
import RoomQuickSearchModal from '../components/common/RoomQuickSearchModal';
import AiRoomRecommenderModal from '../components/common/AiRoomRecommenderModal';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import StatusPill from '../components/common/StatusPill';
import TimeSelect from '../components/common/TimeSelect';
import { STRIPE_TONES } from '../constants/status';

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

// Status shows as the card's left stripe and a pill in its header.
const ROOM_STATUS = {
  Free: { label: 'Free', tone: 'green' },
  Partial: { label: 'Partly booked', tone: 'amber' },
  Full: { label: 'Fully booked', tone: 'red' },
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

const isAllCaps = (s) => /[A-Z]/.test(s) && s === s.toUpperCase();

// For the card: sections sharing a class in the same slot (often entered
// with different capitalisation) become one line with a count of the rest.
function groupOccupants(list = []) {
  const groups = [];
  mergeOccupants(list).forEach((occ) => {
    const title = occupantTitle(occ);
    const key = `${occ.type}|${occ.startTime}|${occ.endTime}|${title.toLowerCase()}`;
    const group = groups.find((g) => g.key === key);
    if (!group) {
      groups.push({ ...occ, key, title, others: 0 });
      return;
    }
    group.others += 1;
    if (isAllCaps(group.title) && !isAllCaps(title)) group.title = title;
  });
  return groups;
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
  const canBook = BOOKERS.includes(user?.roleId);

  const [resourceTypes, setResourceTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [blocks, setBlocks] = useState([]);
  
  const savedFiltersStr = sessionStorage.getItem(STORAGE_KEY);
  const savedFilters = JSON.parse(savedFiltersStr || '{}');
  const hasShownQuickSearch = sessionStorage.getItem(QUICK_SEARCH_SHOWN_KEY) === 'true';
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(!hasShownQuickSearch);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

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
  const lastSearchRef = useRef(filters.search);

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

    // Only wait while the search box is being typed in; the first load and
    // dropdown/date changes fetch straight away.
    const typing = filters.search !== lastSearchRef.current;
    lastSearchRef.current = filters.search;

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
    }, typing ? 250 : 0); // light debounce on the search box

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
    <div className="mx-auto max-w-7xl">
      <RoomQuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        onSearch={handleQuickSearch}
        resourceTypes={resourceTypes}
      />

      <AiRoomRecommenderModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onSelectRoom={(rec) => {
          if (rec.targetDate) setSelectedDate(rec.targetDate);
          if (rec.targetStart && rec.targetEnd) {
            setFilterType('Custom');
            setCustomStart(rec.targetStart);
            setCustomEnd(rec.targetEnd);
          }
          setFilters(prev => ({
            ...prev,
            search: rec.resourceName,
            availability: 'Free'
          }));
          const fullRoom = resources.find(r => r.resourceId === rec.resourceId);
          if (fullRoom) {
            setSelectedRoom(fullRoom);
          }
        }}
      />

      <PageHeader
        title={canBook ? 'Book a Room' : 'Room Availability'}
        description={canBook
          ? 'Find a free classroom, lab, seminar hall or auditorium, then click it to send a booking request.'
          : 'See which classrooms, labs, seminar halls and auditoriums are free or booked. Click a room to see its day.'}
      >
        {/* AI Recommender button disabled for now */}
        {/* <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-medium text-sm shadow-md hover:shadow-indigo-500/25 hover:opacity-95 transition-all cursor-pointer"
          >
            <span>✨ AI Room Recommender</span>
          </button>
        </div> */}
      </PageHeader>

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
            <TimeSelect value={customStart} onChange={setCustomStart} />
            <span className="text-sm text-ink/60">to</span>
            <TimeSelect value={customEnd} onChange={setCustomEnd} />
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
        <p className="mt-10 text-sm text-ink/50">Loading rooms…</p>
      ) : filteredResources.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={SearchX} title="No rooms match">
            Try a different time or date, or use Clear filters to see every room.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredResources.map((r) => {
            const live = liveStatusMap[r.resourceId];
            const status = live?.status || 'Free';
            const { startTimeParam, endTimeParam } = getFilterTimes();
            // For a partly booked room, open the booking form on its first free gap.
            const firstFree = status === 'Partial' ? live?.freeSlots?.[0] : null;
            const cardClass = `group block h-full w-full flex flex-col text-left rounded-lg border border-line border-l-4 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${STRIPE_TONES[ROOM_STATUS[status].tone]}`;
            const content = (
              <ResourceCardContent r={r} live={live} status={status} filterType={filterType} showLive={isToday} canBook={canBook} />
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
  Whole: 'Available all day',
  Morning: 'Available all morning',
  Afternoon: 'Available all afternoon',
  Custom: 'Available for this slot',
  Now: 'Available now',
};

const MAX_CARD_OCCUPANTS = 3;

function ResourceCardContent({ r, live, status, filterType, showLive, canBook }) {
  const occupants = groupOccupants(live?.occupantList);
  const current = showLive && live?.inUseNow ? live.currentOccupant : null;
  const pill = ROOM_STATUS[status];
  const location = [r.block?.blockName, r.floor ? `Floor ${r.floor}` : ''].filter(Boolean).join(', ');

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">
          {r.resourceType?.typeName}
        </p>
        <StatusPill tone={pill.tone}>
          {status === 'Full' && filterType === 'Now' ? 'In use' : pill.label}
        </StatusPill>
      </div>
      <div className="mt-1">
        <div>
          <p className="font-display text-lg font-semibold leading-snug text-ink">
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
                      <span className="block text-sm font-medium text-ink/90 mt-0.5">{r.resourceName}</span>
                    )}
                  </>
               );
            })()}
          </p>
        </div>
        {r.department && (
          <p className="mt-0.5 truncate text-sm text-ink/70" title={r.department.departmentName}>
            {r.department.departmentName}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/60">
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {location}
            </span>
          )}
          {r.capacityOrAreaSqm && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {Math.floor(r.capacityOrAreaSqm)} seats
            </span>
          )}
        </div>
      </div>
      {current && <LiveBadge occupant={current} className="mt-3" />}
      <div className="mt-auto pt-4">
        <div className="border-t border-line pt-3">
          {status === 'Free' ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 font-medium text-forest">
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{FREE_LABELS[filterType] || 'Available'}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 font-semibold text-navy">
                {canBook ? 'Book' : 'View'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {status === 'Partial' && live?.freeSlots?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="font-semibold text-forest">Free</span>
                  {live.freeSlots.map((s) => (
                    <span key={s.startTime} className="rounded bg-forest-light px-1.5 py-0.5 font-mono text-forest">
                      {s.startTime}–{s.endTime}
                    </span>
                  ))}
                </div>
              )}
              <ul className="space-y-1">
                {occupants.slice(0, MAX_CARD_OCCUPANTS).map((o) => (
                  <li
                    key={o.key}
                    className="flex gap-2 text-xs"
                    title={`${o.startTime}–${o.endTime} ${o.title} · ${o.others > 0 ? `${o.others + 1} sections` : occupantSubtitle(o)}`}
                  >
                    <span className="shrink-0 font-mono text-ink/50">{o.startTime}–{o.endTime}</span>
                    <span className="min-w-0 truncate text-ink/60">
                      <span className="font-medium text-ink">{o.title}</span>
                      {o.others > 0
                        ? ` · ${o.others + 1} ${o.type === 'class' ? 'sections' : 'bookings'}`
                        : occupantSubtitle(o) && ` · ${occupantSubtitle(o)}`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="flex items-center justify-between gap-2 text-xs">
                <span className="text-ink/50">
                  {occupants.length > MAX_CARD_OCCUPANTS && `+${occupants.length - MAX_CARD_OCCUPANTS} more`}
                </span>
                <span className="flex items-center gap-1 font-semibold text-navy">
                  {status === 'Full' ? 'Full schedule' : canBook ? 'Book a free slot' : 'See the day'}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
