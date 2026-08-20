import { useEffect, useState } from 'react';
import { resourcesApi } from '../api/endpoints';
import { fmtTimeSlot } from '../utils/formatters';

function todayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TIME_OPTIONS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', 
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
];

export default function LiveStatus() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  // Track collapsed state for departments. Key = department name, Value = boolean (is collapsed)
  const [collapsedDepts, setCollapsedDepts] = useState({});

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedTime, setSelectedTime] = useState(''); // Empty means "Now"

  function refresh() {
    setLoading(true);
    setError('');
    
    // If a time is selected, pass the full ISO string, otherwise let backend use current time
    const timeParam = selectedTime ? `${selectedDate}T${selectedTime}:00` : null;
    
    resourcesApi
      .liveStatus(timeParam)
      .then((data) => {
        setRooms(data);
        setLastUpdated(new Date());
      })
      .catch(() => setError('Failed to fetch live status. Please try again.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [selectedDate, selectedTime]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedAvailability, setSelectedAvailability] = useState('All');

  const toggleDept = (dept) => {
    setCollapsedDepts(prev => ({ ...prev, [dept]: !prev[dept] }));
  };

  const filteredRooms = rooms.filter(r => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = 
      r.resourceName?.toLowerCase().includes(s) ||
      r.resourceType?.toLowerCase().includes(s) ||
      r.department?.toLowerCase().includes(s) ||
      r.occupant?.toLowerCase().includes(s);
      
    const matchesDept = selectedDept === 'All' || r.department === selectedDept;
    
    const matchesAvailability = 
      selectedAvailability === 'All' || 
      (selectedAvailability === 'Free' ? r.isFree : !r.isFree);
    
    return matchesSearch && matchesDept && matchesAvailability;
  });

  const grouped = filteredRooms.reduce((acc, room) => {
    const key = room.department;
    if (!acc[key]) acc[key] = [];
    acc[key].push(room);
    return acc;
  }, {});
  
  // Get unique departments for the dropdown
  const allDepts = [...new Set(rooms.map(r => r.department))].sort();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Live Campus Status</h1>
          <p className="mt-1 text-sm text-ink/60">
            Real-time view of all resources right now. Auto-refreshes every minute.
          </p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex gap-2 mr-2">
            <button onClick={() => setSelectedTime('09:00')} className="rounded bg-paper px-2 py-1 text-[11px] font-semibold text-navy hover:bg-paper/80 border border-line">Morning</button>
            <button onClick={() => setSelectedTime('13:00')} className="rounded bg-paper px-2 py-1 text-[11px] font-semibold text-navy hover:bg-paper/80 border border-line">Afternoon</button>
            <button onClick={() => setSelectedTime('17:00')} className="rounded bg-paper px-2 py-1 text-[11px] font-semibold text-navy hover:bg-paper/80 border border-line">Evening</button>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded border border-line px-2 py-2 text-sm bg-white"
          />
          <select
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="rounded border border-line px-3 py-2 text-sm bg-white font-medium"
          >
            <option value="">Current Time</option>
            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select 
            value={selectedAvailability}
            onChange={(e) => setSelectedAvailability(e.target.value)}
            className="rounded border border-line px-3 py-2 text-sm bg-white"
          >
            <option value="All">All Statuses</option>
            <option value="Free">Free</option>
            <option value="In Use">In Use</option>
          </select>
          <select 
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="rounded border border-line px-3 py-2 text-sm bg-white max-w-[150px] truncate"
          >
            <option value="All">All Departments</option>
            {allDepts.map(d => (
              <option key={d} value={d}>{d === 'Shared' ? 'Shared Resources' : d}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            className="rounded border border-line px-3 py-2 text-sm w-48"
          />
          <div className="text-right flex flex-col items-end whitespace-nowrap">
            <p className="text-[10px] text-ink/50 mb-1">Updated: {lastUpdated.toLocaleTimeString()}</p>
            <button
              onClick={refresh}
              disabled={loading}
              className="rounded bg-white border border-line px-3 py-1.5 text-xs font-medium text-navy hover:bg-paper"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded border border-brick/40 bg-brick-light p-4 text-sm text-brick">
          {error}
        </div>
      )}

      <div className="mt-8 space-y-8">
        {Object.entries(grouped).sort().map(([dept, deptRooms]) => {
          const forceOpen = searchTerm.length > 0 || selectedDept !== 'All';
          const isCollapsed = collapsedDepts[dept] !== undefined ? collapsedDepts[dept] : !forceOpen;
          
          return (
            <div key={dept} className="rounded-xl border border-line bg-white shadow-sm overflow-hidden">
              <button 
                onClick={() => toggleDept(dept)}
                className="w-full flex items-center justify-between bg-paper/50 px-6 py-4 hover:bg-paper transition-colors"
              >
                <h2 className="text-sm font-bold tracking-wide uppercase text-navy">
                  {dept === 'Shared' ? 'Institute Shared Resources' : `${dept} Department`}
                  <span className="ml-2 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] text-navy">
                    {deptRooms.length}
                  </span>
                </h2>
                <svg 
                  className={`w-5 h-5 text-ink/50 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} 
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {!isCollapsed && (
                <div className="p-6 border-t border-line">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {deptRooms.sort((a,b) => a.resourceName.localeCompare(b.resourceName)).map((r) => (
                      <button 
                        key={r.resourceId} 
                        onClick={() => setSelectedRoom(r)}
                        className={`text-left relative overflow-hidden rounded-lg border p-4 shadow-sm transition-all hover:shadow-md cursor-pointer ${
                          r.isFree 
                            ? 'border-forest/20 bg-forest-light hover:border-forest/40' 
                            : 'border-brick/20 bg-brick-light hover:border-brick/40'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <h3 className="font-medium text-ink">{r.resourceName}</h3>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.isFree ? 'bg-forest/10 text-forest' : 'bg-brick/10 text-brick'
                          }`}>
                            {r.isFree ? 'Free' : 'In Use'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink/50 font-mono">Block {r.block} • {r.resourceType}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal for Room Details */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className={`p-6 border-b ${selectedRoom.isFree ? 'bg-forest-light border-forest/20' : 'bg-brick-light border-brick/20'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-display font-bold text-navy">{selectedRoom.resourceName}</h2>
                  <p className="text-sm font-mono text-ink/60 mt-1">Block {selectedRoom.block} • {selectedRoom.resourceType}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                  selectedRoom.isFree ? 'bg-forest/20 text-forest-dark' : 'bg-brick/20 text-brick-dark'
                }`}>
                  {selectedRoom.isFree ? 'Free' : 'In Use'}
                </span>
              </div>
            </div>
            
            <div className="p-6">
              {selectedRoom.isFree ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-forest/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">✨</span>
                  </div>
                  <h3 className="text-lg font-medium text-ink">Room is Available</h3>
                  <p className="text-sm text-ink/60 mt-1">No classes or events are currently scheduled here.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink/40 mb-2">Current Activity</h4>
                    <p className="text-base font-medium text-ink bg-paper/50 p-3 rounded-lg border border-line">
                      {selectedRoom.occupant}
                    </p>
                    {selectedRoom.until && (
                      <p className="text-sm font-semibold text-brick mt-2">
                        {selectedRoom.since && selectedRoom.until ? `${selectedRoom.since.substring(11, 16)} to ${selectedRoom.until.substring(11, 16)}` : ''}
                      </p>
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
              )}
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
