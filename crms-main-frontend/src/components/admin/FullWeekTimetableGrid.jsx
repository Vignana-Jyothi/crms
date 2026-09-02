import React, { useState } from 'react';
import { X } from 'lucide-react';
import { fmtTimeSlot } from '../../utils/formatters';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS_STANDARD = [
  { start: '10:00', end: '11:00' },
  { start: '11:00', end: '12:00' },
  { start: '12:00', end: '13:00' },
  { start: '13:00', end: '13:40', isLunch: true },
  { start: '13:40', end: '14:40' },
  { start: '14:40', end: '15:40' },
  { start: '15:40', end: '16:40' }
];

const TIME_SLOTS_FIRST_YEAR = [
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  { start: '11:00', end: '12:00' },
  { start: '12:00', end: '12:40', isLunch: true },
  { start: '12:40', end: '13:40' },
  { start: '13:40', end: '14:40' },
  { start: '14:40', end: '15:40' }
];

export default function FullWeekTimetableGrid({ timetables, viewMode }) {
  const [selectedSlotClasses, setSelectedSlotClasses] = useState(null);
  const [selectedSlotInfo, setSelectedSlotInfo] = useState({ day: '', time: '' });
  // Determine if this view is predominantly 1st year
  const isFirstYearView = timetables.length > 0 && timetables.every(t => t.studentYear === '1');
  const activeTimeSlots = isFirstYearView ? TIME_SLOTS_FIRST_YEAR : TIME_SLOTS_STANDARD;

  // Helper to find all classes for a specific day and time slot
  const getClassesForSlot = (day, startSlot, endSlot) => {
    // We convert everything to minutes for easier intersection checking
    const toMins = (t) => {
      if (!t) return 0;
      if (typeof t === 'string') {
        if (t.includes('T')) {
          const d = new Date(t);
          return d.getUTCHours() * 60 + d.getUTCMinutes();
        }
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      }
      // Date object
      const d = new Date(t);
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    };

    const slotStartMins = toMins(startSlot);
    const slotEndMins = toMins(endSlot);

    return timetables.filter(t => {
      if (t.dayOfWeek !== day) return false;
      const tStartMins = toMins(t.startTime);
      const tEndMins = toMins(t.endTime);

      // Overlap condition: max(start1, start2) < min(end1, end2)
      return Math.max(slotStartMins, tStartMins) < Math.min(slotEndMins, tEndMins);
    });
  };
  // Helper to format ISO time to HH:MM
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const d = new Date(timeStr);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
    } catch(e) {
      return '';
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
      <table className="w-full text-left text-sm text-ink border-collapse table-fixed">
        <thead className="bg-paper border-b border-line text-xs uppercase text-navy">
          <tr>
            <th className="px-4 py-3 border-r border-line w-28 font-semibold bg-white/50 sticky left-0 z-10 backdrop-blur-md">Day \ Time</th>
            {activeTimeSlots.map((slot, idx) => (
              <th key={idx} className="px-2 py-3 border-r border-line font-semibold text-center whitespace-nowrap overflow-hidden text-ellipsis">
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
              {activeTimeSlots.map((slot, idx) => {
                const classesForSlotRaw = getClassesForSlot(day, slot.start, slot.end);
                
                // Aggregate ALL overlapping classes into a single display object for the grid cell
                // We still keep groupedClasses for the modal
                const groupedClasses = [];
                const aggregatedDisplay = {
                  courseShortNames: [],
                  resourceNames: [],
                  facultyNames: []
                };

                classesForSlotRaw.forEach(c => {
                  // For the modal grouping (groups by courseCode + section)
                  const existing = groupedClasses.find(g => g.courseCode === c.courseCode && g.section === c.section);
                  if (existing) {
                    if (c.resource?.resourceName && !existing.resourceNames.includes(c.resource.resourceName)) {
                      existing.resourceNames.push(c.resource.resourceName);
                    }
                    if (c.facultyName && !existing.facultyNames.includes(c.facultyName)) {
                      existing.facultyNames.push(c.facultyName);
                    }
                  } else {
                    groupedClasses.push({
                      ...c,
                      resourceNames: c.resource?.resourceName ? [c.resource.resourceName] : [],
                      facultyNames: c.facultyName ? [c.facultyName] : []
                    });
                  }

                  // For the single grid cell display (aggregates everything)
                  const shortName = c.courseShortName || c.courseCode;
                  if (shortName && !aggregatedDisplay.courseShortNames.includes(shortName)) {
                    aggregatedDisplay.courseShortNames.push(shortName);
                  }
                  if (c.resource?.resourceName && !aggregatedDisplay.resourceNames.includes(c.resource.resourceName)) {
                    aggregatedDisplay.resourceNames.push(c.resource.resourceName);
                  }
                  if (c.facultyName && !aggregatedDisplay.facultyNames.includes(c.facultyName)) {
                    aggregatedDisplay.facultyNames.push(c.facultyName);
                  }
                });

                const hasClasses = classesForSlotRaw.length > 0;
                // Just use the first class for base properties like section/department, which should be the same
                const baseClass = hasClasses ? classesForSlotRaw[0] : null;
                
                if (slot.isLunch) {
                  return (
                    <td key={idx} className="border-r border-line p-2 text-center align-middle h-full bg-slate-50/80">
                      <div className="flex items-center justify-center h-full w-full text-slate-500 font-medium text-xs py-4">
                        Lunch
                      </div>
                    </td>
                  );
                }

                return (
                  <td key={idx} className={`border-r border-line p-2 text-center align-middle h-full ${!hasClasses ? 'bg-slate-50/50' : 'bg-white hover:bg-slate-50 cursor-pointer transition-colors'}`}
                      onClick={() => hasClasses && (setSelectedSlotClasses(groupedClasses), setSelectedSlotInfo({day, time: fmtTimeSlot(`1970-01-01T${slot.start}:00Z`, `1970-01-01T${slot.end}:00Z`)}))}>
                    {hasClasses ? (
                      <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-indigo-50 border border-indigo-100 w-full h-[85px] overflow-hidden">
                        <div className="font-bold text-indigo-900 text-[10px] text-center leading-tight line-clamp-2 mb-0.5">
                          {aggregatedDisplay.courseShortNames.join(' / ')}
                        </div>
                        
                        {viewMode === 'Classrooms' && (
                          <>
                            <div className="text-[9px] text-indigo-700 font-medium whitespace-nowrap">
                              {baseClass.studentYear && `${baseClass.studentYear}${baseClass.studentYear === '1' ? 'st' : baseClass.studentYear === '2' ? 'nd' : baseClass.studentYear === '3' ? 'rd' : 'th'} Yr`} {baseClass.department?.branchCode} - {baseClass.section}
                            </div>
                            <div className="text-[9px] text-indigo-600/80 line-clamp-1">
                              {aggregatedDisplay.facultyNames?.length > 0 ? aggregatedDisplay.facultyNames.join(' / ') : 'Unassigned'}
                            </div>
                          </>
                        )}

                        {viewMode === 'Sections' && (
                          <>
                            <div className="text-[9px] text-indigo-700 font-medium whitespace-nowrap">
                              {baseClass.studentYear && `${baseClass.studentYear}${baseClass.studentYear === '1' ? 'st' : baseClass.studentYear === '2' ? 'nd' : baseClass.studentYear === '3' ? 'rd' : 'th'} Yr`} {baseClass.department?.branchCode} - {baseClass.section}
                            </div>
                            <div className="text-[9px] text-indigo-600/80 line-clamp-1 text-center px-1">
                              {aggregatedDisplay.resourceNames?.length > 0 ? aggregatedDisplay.resourceNames.join(' / ') : 'No Room'} • {aggregatedDisplay.facultyNames?.length > 0 ? aggregatedDisplay.facultyNames.join(' / ') : 'Unassigned'}
                            </div>
                          </>
                        )}

                        {viewMode === 'Faculty' && (
                          <>
                            <div className="text-[9px] text-indigo-700 font-medium whitespace-nowrap">
                              {baseClass.studentYear && `${baseClass.studentYear}${baseClass.studentYear === '1' ? 'st' : baseClass.studentYear === '2' ? 'nd' : baseClass.studentYear === '3' ? 'rd' : 'th'} Yr`} {baseClass.department?.branchCode} - {baseClass.section}
                            </div>
                            <div className="text-[9px] text-indigo-600/80 line-clamp-1">
                              {aggregatedDisplay.resourceNames?.length > 0 ? aggregatedDisplay.resourceNames.join(' / ') : 'No Room'}
                            </div>
                          </>
                        )}
                        
                        {/* Default fallback for when viewMode is undefined or empty */}
                        {!viewMode && (
                          <>
                            <div className="text-[9px] text-indigo-700 font-medium whitespace-nowrap">
                              {baseClass.studentYear && `${baseClass.studentYear}${baseClass.studentYear === '1' ? 'st' : baseClass.studentYear === '2' ? 'nd' : baseClass.studentYear === '3' ? 'rd' : 'th'} Yr`} {baseClass.department?.branchCode} - {baseClass.section}
                            </div>
                            <div className="text-[9px] text-indigo-600/80 line-clamp-1 text-center px-1">
                              {aggregatedDisplay.resourceNames?.length > 0 ? aggregatedDisplay.resourceNames.join(' / ') : 'No Room'} • {aggregatedDisplay.facultyNames?.length > 0 ? aggregatedDisplay.facultyNames.join(' / ') : 'Unassigned'}
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
      
      {/* Detailed Modal for overlapping classes */}
      {selectedSlotClasses && selectedSlotClasses.length > 0 && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedSlotClasses(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-line w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-line bg-slate-50">
              <div>
                <h3 className="font-bold text-navy text-lg">{selectedSlotInfo.day} • {selectedSlotInfo.time}</h3>
                <p className="text-xs text-slate-500 font-medium">{selectedSlotClasses.length} Scheduled Class{selectedSlotClasses.length !== 1 ? 'es' : ''}</p>
              </div>
              <button onClick={() => setSelectedSlotClasses(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto bg-slate-50 flex-1 space-y-3">
              {selectedSlotClasses.map((c, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-line shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-indigo-900 mb-1">
                        {c.courseName ? `${c.courseName} (${c.courseCode})` : c.courseCode}
                      </h4>
                      <p className="text-xs text-indigo-700 font-medium mb-2">
                        {c.studentYear && `${c.studentYear}${c.studentYear === '1' ? 'st' : c.studentYear === '2' ? 'nd' : c.studentYear === '3' ? 'rd' : 'th'} Year`} {c.department?.branchCode} - {c.section}
                      </p>
                    </div>
                    <div className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-bold border border-indigo-100 whitespace-nowrap">
                      {c.resourceNames?.length > 0 ? c.resourceNames.join(' / ') : 'No Room Assigned'}
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-line/50">
                    <p className="text-xs text-slate-600 flex items-center gap-2">
                      <span className="font-semibold text-slate-400">Faculty:</span> {c.facultyNames?.length > 0 ? c.facultyNames.join(' / ') : 'Unassigned'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
