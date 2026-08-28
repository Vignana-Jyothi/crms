import React from 'react';
import { fmtTimeSlot } from '../../utils/formatters';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  { start: '11:00', end: '12:00' },
  { start: '12:00', end: '13:00' },
  { start: '13:00', end: '14:00' },
  { start: '14:00', end: '15:00' },
  { start: '15:00', end: '16:00' },
  { start: '16:00', end: '17:00' }
];

export default function FullWeekTimetableGrid({ timetables, viewMode }) {
  // timetables is an array of timetable objects for the selected entity (classroom, section, or faculty).

  // Helper to find a class for a specific day and time slot
  const getClassForSlot = (day, startSlot, endSlot) => {
    // We convert everything to minutes for easier intersection checking
    const toMins = (t) => {
      if (!t) return 0;
      if (typeof t === 'string') {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      }
      // Date object
      const d = new Date(t);
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    };

    const slotStartMins = toMins(startSlot);
    const slotEndMins = toMins(endSlot);

    return timetables.find(t => {
      if (t.dayOfWeek !== day) return false;
      const tStartMins = toMins(t.startTime);
      const tEndMins = toMins(t.endTime);

      // Overlap condition: max(start1, start2) < min(end1, end2)
      return Math.max(slotStartMins, tStartMins) < Math.min(slotEndMins, tEndMins);
    });
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
      <table className="w-full text-left text-sm text-ink border-collapse">
        <thead className="bg-paper border-b border-line text-xs uppercase text-navy">
          <tr>
            <th className="px-4 py-3 border-r border-line w-32 font-semibold bg-white/50 sticky left-0 z-10 backdrop-blur-md">Day \ Time</th>
            {TIME_SLOTS.map((slot, idx) => (
              <th key={idx} className="px-2 py-3 border-r border-line font-semibold text-center whitespace-nowrap min-w-[140px]">
                {fmtTimeSlot(`1970-01-01T${slot.start}:00Z`, `1970-01-01T${slot.end}:00Z`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {DAYS.map(day => (
            <tr key={day} className="hover:bg-paper/50 transition-colors">
              <td className="px-4 py-4 border-r border-line font-semibold text-navy bg-paper/20 sticky left-0 z-10 backdrop-blur-md">
                {day}
              </td>
              {TIME_SLOTS.map((slot, idx) => {
                const classData = getClassForSlot(day, slot.start, slot.end);
                
                return (
                  <td key={idx} className={`border-r border-line p-2 text-center align-middle h-full ${!classData ? 'bg-slate-50/50' : 'bg-white'}`}>
                    {classData ? (
                      <div className="flex flex-col gap-1 items-center justify-center p-2 rounded-lg bg-indigo-50 border border-indigo-100 h-full w-full min-h-[80px]">
                        <div className="font-bold text-indigo-900 text-xs text-center leading-tight">
                          {classData.courseCode}
                        </div>
                        
                        {viewMode === 'Classrooms' && (
                          <>
                            <div className="text-[10px] text-indigo-700 font-medium">
                              {classData.department?.branchCode} - Sec {classData.section}
                            </div>
                            <div className="text-[10px] text-indigo-600/80">
                              {classData.facultyName || 'Unassigned'}
                            </div>
                          </>
                        )}

                        {viewMode === 'Sections' && (
                          <>
                            <div className="text-[10px] text-indigo-700 font-medium">
                              {classData.resource?.resourceName || 'No Room'}
                            </div>
                            <div className="text-[10px] text-indigo-600/80">
                              {classData.facultyName || 'Unassigned'}
                            </div>
                          </>
                        )}

                        {viewMode === 'Faculty' && (
                          <>
                            <div className="text-[10px] text-indigo-700 font-medium">
                              {classData.department?.branchCode} - Sec {classData.section}
                            </div>
                            <div className="text-[10px] text-indigo-600/80">
                              {classData.resource?.resourceName || 'No Room'}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full w-full text-slate-400 italic text-xs py-4">
                        Free
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
