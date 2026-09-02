import React, { useState } from 'react';
import { timetableApi } from '../../api/endpoints';
import { Check, X, Edit2 } from 'lucide-react';
import { fmtTime } from '../../utils/formatters';

export default function EditableTimetableGrid({ timetables, resources, setTimetables, readOnly = false }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const handleEdit = (t) => {
    setEditingId(t.timetableId);
    setEditForm({
      courseCode: t.courseCode || '',
      courseName: t.courseName || '',
      facultyName: t.facultyName || '',
      resourceId: t.resourceId || '',
      section: t.section || ''
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (timetableId) => {
    try {
      setSaving(true);
      await timetableApi.update(timetableId, editForm);
      
      // Update local state so it reflects instantly
      setTimetables(prev => prev.map(t => {
        if (t.timetableId === timetableId) {
          const res = resources.find(r => r.resourceId === editForm.resourceId);
          return {
            ...t,
            courseCode: editForm.courseCode,
            courseName: editForm.courseName,
            facultyName: editForm.facultyName,
            resourceId: editForm.resourceId,
            section: editForm.section,
            resource: res ? res : t.resource
          };
        }
        return t;
      }));
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update timetable', err);
      alert('Failed to update timetable. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
      <table className="w-full text-left text-sm text-ink border-collapse">
        <thead className="bg-paper border-b border-line text-xs uppercase text-navy">
          <tr>
            <th className="px-4 py-3 font-semibold">Day</th>
            <th className="px-4 py-3 font-semibold">Time</th>
            <th className="px-4 py-3 font-semibold">Classroom</th>
            <th className="px-4 py-3 font-semibold">Course</th>
            <th className="px-4 py-3 font-semibold">Section</th>
            <th className="px-4 py-3 font-semibold">Faculty</th>
            {!readOnly && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {timetables.map(t => {
            const isEditing = editingId === t.timetableId;
            return (
              <tr key={t.timetableId} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium">{t.dayOfWeek}</td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  {fmtTime(t.startTime)} - {fmtTime(t.endTime)}
                </td>
                
                {/* Editable Columns */}
                <td className="px-4 py-3">
                  {isEditing ? (
                    <select
                      value={editForm.resourceId}
                      onChange={e => setEditForm({...editForm, resourceId: e.target.value})}
                      className="w-full p-1 border border-line rounded text-sm bg-white"
                      disabled={saving}
                    >
                      <option value="">Select Room</option>
                      {resources.map(r => (
                        <option key={r.resourceId} value={r.resourceId}>{r.resourceName}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-medium text-navy">{t.resource?.resourceName || t.resourceId || 'Unassigned'}</span>
                  )}
                </td>
                
                <td className="px-4 py-3">
                  {isEditing ? (
                    <div className="flex flex-col gap-1.5">
                      <input
                        type="text"
                        value={editForm.courseCode}
                        onChange={e => setEditForm({...editForm, courseCode: e.target.value})}
                        className="w-full p-1 border border-line rounded text-sm"
                        placeholder="Course Code"
                        disabled={saving}
                      />
                      <input
                        type="text"
                        value={editForm.courseName}
                        onChange={e => setEditForm({...editForm, courseName: e.target.value})}
                        className="w-full p-1 border border-line rounded text-sm bg-slate-50"
                        placeholder="Course Name"
                        disabled={saving}
                      />
                    </div>
                  ) : (
                    <span className="text-navy">{t.courseName && t.courseName !== t.courseCode ? `${t.courseName} (${t.courseCode})` : (t.courseCode || '-')}</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.section}
                      onChange={e => setEditForm({...editForm, section: e.target.value})}
                      className="w-full p-1 border border-line rounded text-sm"
                      placeholder="Section"
                      disabled={saving}
                    />
                  ) : (
                    <span className="text-slate-600">{t.section || '-'}</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.facultyName}
                      onChange={e => setEditForm({...editForm, facultyName: e.target.value})}
                      className="w-full p-1 border border-line rounded text-sm"
                      placeholder="Faculty Name"
                      disabled={saving}
                    />
                  ) : (
                    <span className="text-slate-600">{t.facultyName || '-'}</span>
                  )}
                </td>
                
                {!readOnly && (
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleSave(t.timetableId)}
                          disabled={saving}
                          className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 disabled:opacity-50"
                          title="Save"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          onClick={handleCancel}
                          disabled={saving}
                          className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleEdit(t)}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {timetables.length === 0 && (
            <tr>
              <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                No timetables found matching your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
