import React, { useState, useEffect, useCallback } from 'react';
import { masterDataApi, resourcesApi, timetableApi } from '../../api/endpoints';
import FullWeekTimetableGrid from '../../components/admin/FullWeekTimetableGrid';
import EditableTimetableGrid from '../../components/admin/EditableTimetableGrid';
import { Calendar, Search, Edit2, List, LayoutGrid } from 'lucide-react';

export default function TimetablesView() {
  const [activeTab, setActiveTab] = useState('Classrooms'); // Classrooms, Sections, Faculty
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  const [resourceList, setResourceList] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [sectionsData, setSectionsData] = useState([]); // [{section, departmentId, studentYear}]
  
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedResource, setSelectedResource] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  
  const [selectedStudentYear, setSelectedStudentYear] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  
  const [selectedBlock, setSelectedBlock] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  
  const [departments, setDepartments] = useState([]);
  const [blocks, setBlocks] = useState([]);

  // Load all master data on mount
  useEffect(() => {
    Promise.all([
      resourcesApi.list().then(data => {
        const filtered = data.filter(r => 
          (r.resourceType?.typeName === 'Classroom' || r.resourceType?.typeName === 'Laboratory' || r.resourceType?.typeName === 'Lab') &&
          !/^\d(?:st|nd|rd|th)\s+Year/i.test(r.resourceName)
        );
        setResourceList(filtered);
      }),
      masterDataApi.faculty().then(setFacultyList),
      masterDataApi.sections().then(setSectionsData),
      masterDataApi.departments().then(setDepartments),
      masterDataApi.blocks().then(setBlocks)
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
        if (!selectedSection || !selectedDepartment || !selectedStudentYear) {
          setTimetables([]);
          setLoading(false);
          return;
        }
      } else if (activeTab === 'Faculty') {
        if (!selectedFaculty) {
          setTimetables([]);
          setLoading(false);
          return;
        }
        params.facultyName = selectedFaculty;
      }
      
      // Pass any other selected filters to narrow down the view
      if (selectedStudentYear) params.studentYear = selectedStudentYear;
      if (selectedDepartment) params.departmentId = selectedDepartment;
      if (selectedSection) params.section = selectedSection;
      if (selectedResource && activeTab !== 'Classrooms') params.resourceId = selectedResource;
      if (selectedFaculty && activeTab !== 'Faculty') params.facultyName = selectedFaculty;
      
      const derivedDay = selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' }) : selectedDay;
      if (derivedDay) params.dayOfWeek = derivedDay;
    } else {
      if (selectedStudentYear) params.studentYear = selectedStudentYear;
      if (selectedDepartment) params.departmentId = selectedDepartment;
      if (selectedSection) params.section = selectedSection;
      if (selectedFaculty) params.facultyName = selectedFaculty;
      if (selectedResource) params.resourceId = selectedResource;
      const derivedDay = selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' }) : selectedDay;
      if (derivedDay) params.dayOfWeek = derivedDay;
    }

    timetableApi
      .list(params)
      .then(data => {
        setTimetables(data);
        setError('');
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to fetch timetables');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activeTab, isEditMode, selectedResource, selectedSection, selectedFaculty, selectedDepartment, selectedBlock, selectedDay, selectedDate, selectedStudentYear]);

  // Fetch when selection changes
  useEffect(() => {
    refreshTimetables();
  }, [refreshTimetables]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsEditMode(false);
    setTimetables([]);
    // Reset filters
    setSelectedResource('');
    setSelectedSection('');
    setSelectedFaculty('');
    setSelectedDepartment('');
    setSelectedStudentYear('');
    setSelectedDay('');
    setSelectedDate('');
  };

  const availableSections = sectionsData
    .filter(s => {
      if (selectedStudentYear && s.studentYear !== selectedStudentYear) return false;
      if (selectedDepartment && s.departmentId !== parseInt(selectedDepartment)) return false;
      return true;
    })
    .map(s => s.section)
    .filter((value, index, self) => self.indexOf(value) === index)
    .sort();

  const sortedDepartments = [...departments].sort((a, b) => {
    if (!selectedStudentYear) return a.departmentName.localeCompare(b.departmentName);
    
    const aHasData = sectionsData.some(s => s.departmentId === a.departmentId && s.studentYear === selectedStudentYear);
    const bHasData = sectionsData.some(s => s.departmentId === b.departmentId && s.studentYear === selectedStudentYear);
    
    if (aHasData && !bHasData) return -1;
    if (!aHasData && bHasData) return 1;
    return a.departmentName.localeCompare(b.departmentName);
  });

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
                    ? 'bg-indigo-600 text-white shadow-sm'
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

        {/* Filters Area */}
        <div className="bg-white p-4 rounded-xl border border-line shadow-sm flex flex-wrap items-center gap-4">
          <Search size={20} className="text-slate-400 shrink-0" />
          
          {(!isEditMode && activeTab === 'Classrooms') && (
            <>
              <select
                value={selectedBlock}
                onChange={e => setSelectedBlock(e.target.value)}
                className="flex-1 min-w-[150px] p-2 border border-line bg-slate-50 rounded-lg text-sm text-navy focus:ring-0 outline-none"
              >
                <option value="">All Blocks</option>
                {blocks.map(b => (
                  <option key={b.blockId} value={b.blockId}>{b.blockName}</option>
                ))}
              </select>
              <select
                value={selectedResource}
                onChange={e => setSelectedResource(e.target.value)}
                className="flex-1 min-w-[200px] p-2 border border-line bg-slate-50 rounded-lg text-sm text-navy focus:ring-0 outline-none"
              >
                <option value="">Select a Classroom / Lab...</option>
                {resourceList
                  .filter(r => !selectedBlock || r.blockId === parseInt(selectedBlock))
                  .map(r => (
                  <option key={r.resourceId} value={r.resourceId}>{r.resourceName} ({r.resourceType?.typeName || 'Room'})</option>
                ))}
              </select>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="flex-1 min-w-[140px] p-2 border border-line bg-slate-50 rounded-lg text-sm text-navy focus:ring-0 outline-none"
              />
            </>
          )}

          {(!isEditMode && activeTab === 'Sections') && (
            <>
              <select
                value={selectedStudentYear}
                onChange={e => { setSelectedStudentYear(e.target.value); setSelectedSection(''); }}
                className="flex-1 min-w-[120px] p-2 border border-line bg-slate-50 rounded-lg text-sm text-navy focus:ring-0 outline-none"
              >
                <option value="">Select Year...</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
              <select
                value={selectedDepartment}
                onChange={e => { setSelectedDepartment(e.target.value); setSelectedSection(''); }}
                className="flex-1 min-w-[150px] p-2 border border-line bg-slate-50 rounded-lg text-sm text-navy focus:ring-0 outline-none"
              >
                <option value="">Select Branch...</option>
                {sortedDepartments.map(d => (
                  <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>
                ))}
              </select>
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="flex-1 min-w-[120px] p-2 border border-line bg-slate-50 rounded-lg text-sm text-navy focus:ring-0 outline-none"
                disabled={!selectedStudentYear || !selectedDepartment}
              >
                <option value="">Select Section...</option>
                {availableSections.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="flex-1 min-w-[140px] p-2 border border-line bg-slate-50 rounded-lg text-sm text-navy focus:ring-0 outline-none"
              />
            </>
          )}

          {(!isEditMode && activeTab === 'Faculty') && (
            <>
              <select
                value={selectedFaculty}
                onChange={e => setSelectedFaculty(e.target.value)}
                className="flex-1 min-w-[200px] p-2 border border-line bg-slate-50 rounded-lg text-sm text-navy focus:ring-0 outline-none"
              >
                <option value="">Select a Faculty Member...</option>
                {facultyList.map((f, i) => (
                  <option key={f.name || f || i} value={f.name || f}>{f.label || f}</option>
                ))}
              </select>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="flex-1 min-w-[140px] p-2 border border-line bg-slate-50 rounded-lg text-sm text-navy focus:ring-0 outline-none"
              />
            </>
          )}

          {isEditMode && (
            <>
              <select
                value={selectedStudentYear}
                onChange={e => setSelectedStudentYear(e.target.value)}
                className="flex-1 min-w-[100px] p-2 border border-line bg-slate-50 rounded-lg text-sm text-navy focus:ring-0 outline-none"
              >
                <option value="">All Years</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                className="flex-1 min-w-[120px] p-2 border border-line bg-slate-50 rounded-lg text-sm text-navy focus:ring-0 outline-none"
              >
                <option value="">All Depts</option>
                {sortedDepartments.map(d => (
                  <option key={d.departmentId} value={d.departmentId}>{d.branchCode}</option>
                ))}
              </select>
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="flex-1 min-w-[100px] p-2 border border-line bg-slate-50 rounded-lg text-sm text-navy focus:ring-0 outline-none"
              >
                <option value="">All Sections</option>
                {availableSections.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={selectedFaculty}
                onChange={e => setSelectedFaculty(e.target.value)}
                className="flex-1 min-w-[150px] p-2 border border-line bg-slate-50 rounded-lg text-sm text-navy focus:ring-0 outline-none"
              >
                <option value="">All Faculty</option>
                {facultyList.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <select
                value={selectedDay}
                onChange={e => setSelectedDay(e.target.value)}
                className="flex-1 min-w-[110px] p-2 border border-line bg-slate-50 rounded-lg text-sm text-navy focus:ring-0 outline-none"
              >
                <option value="">All Days</option>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </>
          )}

          {/* View Mode Toggle (Grid/List) */}
          {!isEditMode && (
            <div className="flex bg-slate-100 p-1 rounded-lg ml-auto">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-navy'
                }`}
              >
                <LayoutGrid size={14} />
                Grid View
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-navy'
                }`}
              >
                <List size={14} />
                List View
              </button>
            </div>
          )}
        </div>

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
              {viewMode === 'grid' ? (
                <FullWeekTimetableGrid timetables={timetables} viewMode={activeTab} />
              ) : (
                <EditableTimetableGrid 
                  timetables={timetables} 
                  resources={resourceList} 
                  readOnly={true} 
                />
              )}
            </div>
          )}

          {!isEditMode && !loading && timetables.length === 0 && (selectedResource || (selectedSection && selectedDepartment && selectedStudentYear) || selectedFaculty) && (
            <div className="bg-white p-12 rounded-xl border border-line text-center text-slate-500 shadow-sm">
              No classes scheduled for the selected {activeTab.toLowerCase().slice(0, -1)}.
            </div>
          )}
          
          {!isEditMode && !loading && timetables.length === 0 && activeTab === 'Sections' && (!selectedSection || !selectedDepartment || !selectedStudentYear) && (
            <div className="bg-white p-12 rounded-xl border border-line text-center text-slate-500 shadow-sm">
              Please select a Year, Branch, and Section to view the timetable.
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
                readOnly={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
