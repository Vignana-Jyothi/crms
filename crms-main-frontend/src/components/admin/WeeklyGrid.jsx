import React from 'react';
import { fmtTimeSlot } from '../../utils/formatters';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function WeeklyGrid({ timetables, onAssignFaculty, facultyList }) {
  // Group by Day -> Time Slot -> Item
  const grid = {};
  DAYS.forEach(d => {
    grid[d] = {};
  });

  timetables.forEach(t => {
    if (!grid[t.dayOfWeek]) return; // ignore Sunday or bad data for now
    const timeKey = `${t.startTime}-${t.endTime}`;
    if (!grid[t.dayOfWeek][timeKey]) {
      grid[t.dayOfWeek][timeKey] = [];
    }
    grid[t.dayOfWeek][timeKey].push(t);
  });

  // Extract all unique time slots across the week, sort them
  const allTimeKeys = new Set();
  timetables.forEach(t => allTimeKeys.add(`${t.startTime}-${t.endTime}`));
  
  const sortedTimeKeys = Array.from(allTimeKeys).sort((a, b) => {
    return new Date(a.split('-')[0]) - new Date(b.split('-')[0]);
  });

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
    
    // Normalize to current date to compare times
    const startObj = new Date(today.getFullYear(), today.getMonth(), today.getDate(), s.getUTCHours(), s.getUTCMinutes());
    const endObj = new Date(today.getFullYear(), today.getMonth(), today.getDate(), e.getUTCHours(), e.getUTCMinutes());
    
    return today >= startObj && today <= endObj;
  };

  if (sortedTimeKeys.length === 0) {
    return (
      <div className="py-12 text-center bg-white rounded-xl shadow-sm border border-line">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-line/50">
          <svg className="h-6 w-6 text-ink/40" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </div>
        <h3 className="mt-4 text-sm font-semibold text-navy">No schedules found</h3>
        <p className="mt-1 text-sm text-ink/60">Try adjusting your filters to see more results.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-line mt-6 print:mt-0 print:border-none print:shadow-none">
      <table className="min-w-full divide-y divide-line border-collapse">
        <thead className="bg-navy/5">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-navy w-32 border border-line">Time / Day</th>
            {DAYS.map(day => (
              <th key={day} className="px-4 py-3 text-center text-xs font-semibold text-navy border border-line min-w-[180px]">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedTimeKeys.map((timeKey) => {
            const [sTime, eTime] = timeKey.split('-');
            const formattedTime = fmtTimeSlot(sTime, eTime);
            
            return (
              <tr key={timeKey}>
                <td className="px-4 py-3 text-xs font-medium text-ink/70 whitespace-nowrap align-top border border-line">
                  {formattedTime}
                </td>
                
                {DAYS.map(day => {
                  const items = grid[day][timeKey] || [];
                  
                  return (
                    <td key={day} className="p-2 align-top border border-line bg-line/10 hover:bg-white transition-colors">
                      <div className="flex flex-col gap-2">
                        {items.map((t, idx) => {
                          const live = isLive(t);
                          
                          return (
                            <div 
                              key={t.timetableId || idx}
                              className={`p-2 rounded border text-xs relative shadow-sm ${
                                live ? 'bg-amber-50 border-amber-300' : 'bg-white border-line'
                              }`}
                            >
                              {live && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                                </span>
                              )}
                              
                              <div className="font-semibold text-navy mb-1 flex items-center justify-between">
                                <span className="truncate">{t.courseCode}</span>
                                {t.department && t.section && (
                                  <span className="text-[10px] text-ink/70 bg-line/50 px-1.5 py-0.5 rounded ml-1 shrink-0">
                                    {t.department.branchCode}-{t.section}
                                  </span>
                                )}
                              </div>
                              
                              <div className="text-ink/70 mb-1 truncate">
                                {t.resource?.block?.blockCode ? `Block ${t.resource.block.blockCode} ` : ''}{t.resource?.resourceName}
                              </div>
                              
                              <div className="mt-1 pt-1 border-t border-line/50">
                                {t.facultyName ? (
                                  <span className="text-ink font-medium truncate block">{t.facultyName}</span>
                                ) : (
                                  <div className="print:hidden">
                                    <select 
                                      className="w-full text-[10px] py-1 px-1 border border-line rounded focus:ring-1 focus:ring-navy focus:border-navy bg-white"
                                      onChange={(e) => onAssignFaculty(t.timetableId, e.target.value)}
                                      value=""
                                    >
                                      <option value="" disabled>Assign Faculty...</option>
                                      {facultyList.map(f => (
                                        <option key={f} value={f}>{f}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                {!t.facultyName && <span className="hidden print:inline text-ink/40 italic">No Faculty</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
