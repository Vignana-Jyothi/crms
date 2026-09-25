import React, { useState, useEffect } from 'react';
import { X, Check, Save } from 'lucide-react';
import { fmtTimeSlot } from '../../utils/formatters';
import { timetableApi } from '../../api/endpoints';
import SearchableSelect from '../common/SearchableSelect';

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

export default function BulkGridEditor({
  departments = [],
  resources = [],
  onSaveSuccess,
  onCancel,
  initialDepartment = '',
  initialStudentYear = '',
  initialSection = '',
  availableSections = []
}) {
  const [selectedStudentYear, setSelectedStudentYear] = useState(initialStudentYear);
  const [selectedDepartment, setSelectedDepartment] = useState(initialDepartment);
  const [selectedSection, setSelectedSection] = useState(initialSection);

  // Array of locally added classes
  const [localClasses, setLocalClasses] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  useEffect(() => {
    if (selectedStudentYear && selectedDepartment && selectedSection) {
      setLoadingExisting(true);
      timetableApi.list({
        studentYear: selectedStudentYear,
        departmentId: selectedDepartment,
        section: selectedSection
      }).then(data => {
        setLocalClasses(data);
      }).catch(err => {
        console.error('Failed to load existing timetable', err);
      }).finally(() => {
        setLoadingExisting(false);
      });
    } else {
      setLocalClasses([]);
    }
  }, [selectedStudentYear, selectedDepartment, selectedSection]);
  
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isFirstYearView = selectedStudentYear === '1';
  const activeTimeSlots = isFirstYearView ? TIME_SLOTS_FIRST_YEAR : TIME_SLOTS_STANDARD;

  // Use the exact same overlap logic as FullWeekTimetableGrid
  const getClassesForSlot = (day, startSlot, endSlot) => {
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
      return 0;
    };

    const sMins = toMins(startSlot);
    const eMins = toMins(endSlot);

    return localClasses.filter(t => {
      if (t.dayOfWeek !== day) return false;
      const tStartMins = toMins(t.startTime);
      let tEndMins = toMins(t.endTime);
      
      // Fix DB parsing bug: 12:00 PM was saved as 00:00:00 (12:00 AM)
      if (tEndMins === 0 && tStartMins === 660) {
        tEndMins = 720; // 12:00 PM
      }
      
      return Math.max(sMins, tStartMins) < Math.min(eMins, tEndMins);
    });
  };

  const handleSaveSlot = () => {
    if (!editForm.courseCode) {
      alert('Course Code is required');
      return;
    }

    const newClass = {
      ...editForm,
      // Create a fake unique ID if it's new so we can edit/delete it locally before batch save
      timetableId: editingId === 'new' ? `temp-${Date.now()}` : editingId, 
      studentYear: selectedStudentYear,
      departmentId: selectedDepartment,
      section: editForm.section || selectedSection,
      startTime: `1970-01-01T${editForm.startTime}:00Z`,
      endTime: `1970-01-01T${editForm.endTime}:00Z`,
      resource: editForm.resourceId ? resources.find(r => r.resourceId === parseInt(editForm.resourceId)) : null
    };

    if (editingId !== 'new') {
      const updated = localClasses.map(c => c.timetableId === editingId ? newClass : c);
      setLocalClasses(updated);
    } else {
      setLocalClasses([...localClasses, newClass]);
    }

    setSelectedSlot(null);
  };

  const handleRemoveSlot = (id) => {
    const updated = localClasses.filter(c => c.timetableId !== id);
    setLocalClasses(updated);
  };

  const handleBatchSave = async () => {
    if (!selectedStudentYear || !selectedDepartment || !selectedSection) {
      setError('Please select Year, Branch, and Section at the top before saving.');
      return;
    }
    
    if (localClasses.length === 0) {
      setError('No classes added to the grid.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = localClasses.map(c => ({
        courseCode: c.courseCode,
        courseName: c.courseName || c.courseCode,
        courseShortName: c.courseCode,
        facultyName: c.facultyName,
        dayOfWeek: c.dayOfWeek,
        startTime: c.startTime,
        endTime: c.endTime,
        departmentId: selectedDepartment,
        studentYear: selectedStudentYear,
        section: c.section || selectedSection,
        resourceId: c.resourceId || null
      }));

      await timetableApi.batch(payload);
      if (onSaveSuccess) onSaveSuccess();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save timetables');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden mb-6 flex flex-col animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-bold text-indigo-900 text-lg">Bulk Grid Editor</h3>
          <p className="text-sm text-indigo-700/80">Select context below, fill out the grid, and save all at once.</p>
        </div>
        <button onClick={onCancel} className="p-2 text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="p-6 flex flex-col gap-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-100 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-4 p-4 bg-slate-50 rounded-xl border border-line">
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Year <span className="text-red-500">*</span></label>
            <SearchableSelect
              value={selectedStudentYear}
              onChange={setSelectedStudentYear}
              placeholder="Select or Type Year"
              options={[{value: '1', label: '1st Year'}, {value: '2', label: '2nd Year'}, {value: '3', label: '3rd Year'}, {value: '4', label: '4th Year'}]}
              allowCreate={true}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Branch <span className="text-red-500">*</span></label>
            <SearchableSelect
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              placeholder="Select Branch"
              options={departments.map(d => ({ value: d.departmentId, label: `${d.branchCode} - ${d.departmentName}` }))}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Section <span className="text-red-500">*</span></label>
            <SearchableSelect
              value={selectedSection}
              onChange={val => setSelectedSection(val ? val.toUpperCase() : '')}
              placeholder="Select or Type Section"
              options={availableSections.map(s => ({ value: s, label: s }))}
              allowCreate={true}
              className="w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-line shadow-sm relative">
          {(!selectedStudentYear || !selectedDepartment || !selectedSection) && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
              <div className="bg-white px-6 py-3 rounded-full shadow-lg border border-line text-sm font-semibold text-slate-600">
                Select Year, Branch, and Section above to unlock the grid
              </div>
            </div>
          )}
          {loadingExisting && selectedStudentYear && selectedDepartment && selectedSection && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
              <div className="bg-white px-6 py-3 rounded-full shadow-lg border border-line text-sm font-semibold text-slate-600 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                Loading existing timetable...
              </div>
            </div>
          )}
          
          <table className="w-full text-sm text-left border-collapse bg-white min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-line text-navy sticky top-0 z-20">
              <tr>
                <th className="px-4 py-4 font-bold uppercase tracking-wider text-xs border-r border-line bg-slate-50 sticky left-0 z-30 shadow-[1px_0_0_0_#e2e8f0]">
                  Day \ Time
                </th>
                {activeTimeSlots.map((slot, i) => (
                  <th key={i} className="px-4 py-4 font-bold text-center border-r border-line min-w-[140px] whitespace-nowrap">
                    {slot.isLunch ? '' : fmtTimeSlot(`1970-01-01T${slot.start}:00Z`, `1970-01-01T${slot.end}:00Z`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {DAYS.map((day) => {
                const daySlots = [];
                let skipUntil = 0;

                const getDisplayNames = (classesRaw) => {
                  if (classesRaw.length === 0) return '';
                  const shortNames = classesRaw.flatMap(c => (c.courseShortName || c.courseCode || '').split('/').map(s => s.trim())).filter(Boolean);
                  return Array.from(new Set(shortNames)).sort().join(' / ');
                };

                for (let i = 0; i < activeTimeSlots.length; i++) {
                  if (i < skipUntil) continue;
                  const slot = activeTimeSlots[i];
                  
                  if (slot.isLunch) {
                    daySlots.push({ ...slot, idx: i, colSpan: 1, isLunch: true, classesRaw: [] });
                    continue;
                  }

                  const classesRaw = getClassesForSlot(day, slot.start, slot.end);
                  const displayNames = getDisplayNames(classesRaw);
                  const hasClasses = classesRaw.length > 0;

                  let colSpan = 1;
                  let j = i + 1;
                  let endSlot = slot.end;

                  if (hasClasses) {
                    while (j < activeTimeSlots.length) {
                      const nextSlot = activeTimeSlots[j];
                      if (nextSlot.isLunch) break;
                      
                      const nextClassesRaw = getClassesForSlot(day, nextSlot.start, nextSlot.end);
                      const nextDisplayNames = getDisplayNames(nextClassesRaw);
                      
                      if (nextClassesRaw.length > 0 && nextDisplayNames === displayNames) {
                        colSpan++;
                        endSlot = nextSlot.end;
                        j++;
                      } else {
                        break;
                      }
                    }
                  }

                  daySlots.push({
                    ...slot,
                    idx: i,
                    colSpan,
                    hasClasses,
                    classesRaw,
                    displayNames,
                    mergedStart: slot.start,
                    mergedEnd: endSlot
                  });
                  
                  skipUntil = j;
                }

                return (
                  <tr key={day} className="border-b border-line group">
                    <td className="px-4 py-4 border-r border-line font-semibold text-navy bg-slate-50/50 sticky left-0 z-10">
                      {day}
                    </td>
                    {daySlots.map((slotData) => {
                      if (slotData.isLunch) {
                        return (
                          <td key={slotData.idx} colSpan={slotData.colSpan} className="border-r border-line p-2 text-center align-middle h-full bg-slate-50/80">
                            <div className="flex items-center justify-center h-full w-full text-slate-400 font-medium text-xs py-4">
                              Lunch
                            </div>
                          </td>
                        );
                      }

                      const { idx, colSpan, hasClasses, classesRaw, mergedStart, mergedEnd } = slotData;

                      return (
                        <td key={idx} colSpan={colSpan} className={`border-r border-line p-2 text-center align-top h-full ${!hasClasses ? 'bg-white hover:bg-indigo-50/50 cursor-pointer transition-colors' : 'bg-white'}`}
                            onClick={() => {
                              if (!hasClasses) {
                                setSelectedSlot({ day, start: mergedStart, end: mergedEnd, label: `${day} • ${fmtTimeSlot(`1970-01-01T${mergedStart}:00Z`, `1970-01-01T${mergedEnd}:00Z`)}` });
                                setEditingId('new');
                                setEditForm({
                                  courseCode: '', courseName: '', section: selectedSection, facultyName: '', resourceId: '',
                                  dayOfWeek: day, startTime: `${mergedStart}`, endTime: `${mergedEnd}`
                                });
                              }
                            }}>
                          {hasClasses ? (
                            <div className="flex flex-col gap-1.5 min-h-[85px] max-h-[250px] overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
                              {classesRaw.map(c => {
                                const shortName = c.courseShortName || c.courseName || c.courseCode;
                                const resourceName = c.resource?.resourceName || (resources.find(r => r.resourceId === c.resourceId)?.resourceName) || c.resourceId;
                                
                                return (
                                  <div key={c.timetableId} className="flex flex-col items-center justify-center p-2 rounded-lg bg-indigo-50 border border-indigo-100 w-full relative group/item text-center hover:border-indigo-400 transition-colors cursor-pointer"
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setSelectedSlot({ day, start: mergedStart, end: mergedEnd, label: `${day} • ${fmtTimeSlot(`1970-01-01T${mergedStart}:00Z`, `1970-01-01T${mergedEnd}:00Z`)}` });
                                         setEditingId(c.timetableId);
                                         setEditForm({
                                           ...c, 
                                           startTime: c.startTime.length > 5 && c.startTime.includes('T') ? c.startTime.substring(11, 16) : c.startTime.substring(0,5),
                                           endTime: c.endTime.length > 5 && c.endTime.includes('T') ? c.endTime.substring(11, 16) : c.endTime.substring(0,5)
                                         });
                                       }}>
                                    <div className="font-bold text-indigo-900 text-[10px] text-center leading-tight line-clamp-2 mb-0.5">
                                      {shortName}
                                    </div>
                                    <div className="text-[9px] text-indigo-600/80 line-clamp-2 text-center px-1">
                                      {resourceName || 'No Room'} • {c.facultyName || 'Unassigned'}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full w-full text-xs py-4 text-indigo-400 font-medium hover:text-indigo-600">
                              + Add
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-4 border-t border-line">
          <button
            onClick={handleBatchSave}
            disabled={saving || localClasses.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg font-bold shadow-sm transition-all"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Save to Database ({localClasses.length} classes)
          </button>
        </div>
      </div>

      {selectedSlot && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedSlot(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-line w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-line bg-slate-50">
              <div>
                <h3 className="font-bold text-navy text-lg">{selectedSlot.label}</h3>
                <p className="text-xs text-slate-500 font-medium">Add/Edit Class Details</p>
              </div>
              <button onClick={() => setSelectedSlot(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 bg-slate-50 flex-1 overflow-y-auto">
              <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Course Code</label>
                      <input type="text" value={editForm.courseCode} onChange={e => setEditForm({...editForm, courseCode: e.target.value})} className="w-full p-2 border border-line rounded-lg text-sm bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" placeholder="e.g. CS101" autoFocus />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Course Name</label>
                      <input type="text" value={editForm.courseName} onChange={e => setEditForm({...editForm, courseName: e.target.value})} className="w-full p-2 border border-line rounded-lg text-sm bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" placeholder="e.g. Intro to CS (Optional)" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Faculty Name</label>
                      <input type="text" value={editForm.facultyName} onChange={e => setEditForm({...editForm, facultyName: e.target.value})} className="w-full p-2 border border-line rounded-lg text-sm bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" placeholder="e.g. Dr. John Doe" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Classroom</label>
                      <select value={editForm.resourceId} onChange={e => setEditForm({...editForm, resourceId: e.target.value})} className="w-full p-2.5 border border-line rounded-lg text-sm bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all outline-none">
                        <option value="">No Room / Theory</option>
                        {resources.map(r => (
                          <option key={r.resourceId} value={r.resourceId}>{r.resourceName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-line">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Section Override</label>
                    <input type="text" value={editForm.section} onChange={e => setEditForm({...editForm, section: e.target.value})} className="w-full max-w-[200px] p-2 border border-line rounded-lg text-sm bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" placeholder="Defaults to top filter" />
                    <p className="text-[10px] text-slate-400 mt-1">Leave as is unless this specific class is for a different section (e.g. merged labs).</p>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-line">
                  {editingId !== 'new' && editingId !== null ? (
                    <button onClick={() => { handleRemoveSlot(editingId); setSelectedSlot(null); }} className="px-3 py-1.5 rounded text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors">
                      Delete
                    </button>
                  ) : <div></div>}
                  
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedSlot(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                    <button onClick={handleSaveSlot} className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
                      <Check size={16} /> Save to Grid
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
