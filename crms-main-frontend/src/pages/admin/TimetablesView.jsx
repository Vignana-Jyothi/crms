import React, { useState, useEffect, useCallback } from 'react';
import { masterDataApi, resourcesApi, timetableApi } from '../../api/endpoints';
import FullWeekTimetableGrid from '../../components/admin/FullWeekTimetableGrid';
import EditableTimetableGrid from '../../components/admin/EditableTimetableGrid';
import { Calendar, Search, Edit2 } from 'lucide-react';

export default function TimetablesView() {
  const [activeTab, setActiveTab] = useState('Classrooms'); // Classrooms, Sections, Faculty
  const [isEditMode, setIsEditMode] = useState(false);

  const [resourceList, setResourceList] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [sections, setSections] = useState([]);
  
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Selections for the respective tabs
  const [selectedResource, setSelectedResource] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');

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
      masterDataApi.sections().then(data => {
        // We only want a list of unique section strings to populate dropdown, 
        // assuming sections from master data are objects { section: 'A' } or similar.
        // Actually, let's extract them from unique timetables or master data.
        // Usually, sections master data returns unique section strings directly.
        setSections(data);
      })
    ]).catch(err => {
      console.error('Failed to load master data', err);
    });
  }, []);

  const refreshTimetables = useCallback(() => {
    setLoading(true);
    setError('');

    let params = {};
    if (!isEditMode) {
      if (activeTab === 'Classrooms') {
        if (!selectedResource) {
          setTimetables([]);
          setLoading(false);
          return;
        }
        params.resourceId = selectedResource;
      } else if (activeTab === 'Sections') {
        if (!selectedSection) {
          setTimetables([]);
          setLoading(false);
          return;
        }
        params.section = selectedSection;
      } else if (activeTab === 'Faculty') {
        if (!selectedFaculty) {
          setTimetables([]);
          setLoading(false);
          return;
        }
        params.facultyName = selectedFaculty;
      }
    }

    timetableApi
      .list(params)
      .then(data => {
        // If edit mode is true, it fetches ALL timetables. This might be heavy, but allows global search/edit.
        setTimetables(data);
        setError('');
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to fetch timetables');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activeTab, isEditMode, selectedResource, selectedSection, selectedFaculty]);

  // Fetch when selection changes
  useEffect(() => {
    refreshTimetables();
  }, [refreshTimetables]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsEditMode(false);
    setTimetables([]);
  };

  return (
    <div className="p-6 bg-slate-50 min-h-full">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
              <Calendar className="text-primary" size={24} />
              Unified Timetables
            </h1>
            <p className="text-slate-500 mt-1">Manage and view weekly schedules</p>
          </div>

          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-line shadow-sm">
            {['Classrooms', 'Sections', 'Faculty'].map(tab => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab && !isEditMode
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-navy'
                }`}
              >
                {tab}
              </button>
            ))}
            
            <div className="w-px h-6 bg-line mx-2"></div>

            <button
              onClick={() => { setIsEditMode(true); setActiveTab(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isEditMode
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-600 hover:bg-indigo-50 border border-indigo-100'
              }`}
            >
              <Edit2 size={16} />
              Edit Timetables
            </button>
          </div>
        </div>

        {/* Filters Area (Only when NOT in edit mode) */}
        {!isEditMode && (
          <div className="bg-white p-4 rounded-xl border border-line shadow-sm flex items-center gap-4">
            <Search size={20} className="text-slate-400" />
            
            {activeTab === 'Classrooms' && (
              <select
                value={selectedResource}
                onChange={e => setSelectedResource(e.target.value)}
                className="w-full max-w-md p-2 border-none bg-slate-50 rounded-lg text-navy font-medium focus:ring-0 outline-none"
              >
                <option value="">Select a Classroom / Lab...</option>
                {resourceList.map(r => (
                  <option key={r.resourceId} value={r.resourceId}>{r.resourceName}</option>
                ))}
              </select>
            )}

            {activeTab === 'Sections' && (
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="w-full max-w-md p-2 border-none bg-slate-50 rounded-lg text-navy font-medium focus:ring-0 outline-none"
              >
                <option value="">Select a Section...</option>
                {sections.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}

            {activeTab === 'Faculty' && (
              <select
                value={selectedFaculty}
                onChange={e => setSelectedFaculty(e.target.value)}
                className="w-full max-w-md p-2 border-none bg-slate-50 rounded-lg text-navy font-medium focus:ring-0 outline-none"
              >
                <option value="">Select a Faculty Member...</option>
                {facultyList.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Content Area */}
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                <div className="text-sm font-medium text-navy">Loading Schedule...</div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 mb-4">
              {error}
            </div>
          )}

          {!isEditMode && !loading && timetables.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <FullWeekTimetableGrid timetables={timetables} viewMode={activeTab} />
            </div>
          )}

          {!isEditMode && !loading && timetables.length === 0 && (selectedResource || selectedSection || selectedFaculty) && (
            <div className="bg-white p-12 rounded-xl border border-line text-center text-slate-500 shadow-sm">
              No classes scheduled for the selected {activeTab.toLowerCase().slice(0, -1)}.
            </div>
          )}

          {isEditMode && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-white p-4 rounded-xl border border-line shadow-sm mb-4">
                <p className="text-sm text-slate-600">
                  <strong>Edit Mode Active:</strong> You can click the Edit icon on any row below to update the Course, Section, Faculty, or Room. Changes are saved instantly.
                </p>
              </div>
              <EditableTimetableGrid 
                timetables={timetables} 
                resources={resourceList} 
                setTimetables={setTimetables} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
