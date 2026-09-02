import React, { useState, useEffect, useCallback } from 'react';
import { masterDataApi, resourcesApi, timetableApi } from '../../api/endpoints';
import FullWeekTimetableGrid from '../../components/admin/FullWeekTimetableGrid';
import EditableTimetableGrid from '../../components/admin/EditableTimetableGrid';
import { Calendar, Search, Edit2, List, LayoutGrid } from 'lucide-react';
import SearchableSelect from '../../components/common/SearchableSelect';

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

          <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
            <div className="flex flex-wrap items-center gap-1 bg-white p-1.5 rounded-xl border border-line shadow-sm">
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
            </div>

            <button
              onClick={() => { setIsEditMode(true); setActiveTab(''); }}
              className={`flex items-center justify-center gap-2 p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors shadow-sm border ${
                isEditMode
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-indigo-600 border-line hover:bg-indigo-50'
              }`}
            >
              <Edit2 size={18} />
              <span className="hidden sm:inline">Edit Timetables</span>
            </button>
          </div>
        </div>

        {/* Filters Area */}
        <div className="bg-white p-4 rounded-xl border border-line shadow-sm flex flex-wrap items-center gap-4">
          <Search size={20} className="text-slate-400 shrink-0" />
          
          {(!isEditMode && activeTab === 'Classrooms') && (
            <>
              <SearchableSelect
                value={selectedBlock}
                onChange={setSelectedBlock}
                placeholder="All Blocks"
                options={[
                  { value: '', label: 'All Blocks' },
                  ...blocks.map(b => ({ value: b.blockId.toString(), label: b.blockName }))
                ]}
                className="min-w-[150px]"
              />
              <SearchableSelect
                value={selectedResource}
                onChange={setSelectedResource}
                placeholder="Select a Classroom / Lab..."
                options={[
                  { value: '', label: 'Select a Classroom / Lab...' },
                  ...resourceList
                    .filter(r => !selectedBlock || r.blockId === parseInt(selectedBlock))
                    .map(r => ({ value: r.resourceId, label: `${r.resourceName} (${r.resourceType?.typeName || 'Room'})` }))
                ]}
                className="min-w-[250px]"
              />
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
              <SearchableSelect
                value={selectedStudentYear}
                onChange={val => { setSelectedStudentYear(val); setSelectedSection(''); }}
                placeholder="Select Year..."
                options={[
                  { value: '', label: 'Select Year...' },
                  { value: '1', label: '1st Year' },
                  { value: '2', label: '2nd Year' },
                  { value: '3', label: '3rd Year' },
                  { value: '4', label: '4th Year' }
                ]}
                className="min-w-[140px]"
              />
              <SearchableSelect
                value={selectedDepartment}
                onChange={val => { setSelectedDepartment(val); setSelectedSection(''); }}
                placeholder="Select Branch..."
                options={[
                  { value: '', label: 'Select Branch...' },
                  ...sortedDepartments.map(d => ({ value: d.departmentId.toString(), label: d.departmentName }))
                ]}
                className="min-w-[200px]"
              />
              <SearchableSelect
                value={selectedSection}
                onChange={setSelectedSection}
                placeholder="Select Section..."
                disabled={!selectedStudentYear || !selectedDepartment}
                options={[
                  { value: '', label: 'Select Section...' },
                  ...availableSections.map(s => ({ value: s, label: s }))
                ]}
                className="min-w-[150px]"
              />
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
              <SearchableSelect
                value={selectedFaculty}
                onChange={setSelectedFaculty}
                placeholder="Select a Faculty Member..."
                options={[
                  { value: '', label: 'Select a Faculty Member...' },
                  ...facultyList.map(f => ({ value: (f.name || f).toString(), label: (f.label || f).toString() }))
                ]}
                className="min-w-[250px]"
              />
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
              <SearchableSelect
                value={selectedStudentYear}
                onChange={setSelectedStudentYear}
                placeholder="All Years"
                options={[
                  { value: '', label: 'All Years' },
                  { value: '1', label: '1st Year' },
                  { value: '2', label: '2nd Year' },
                  { value: '3', label: '3rd Year' },
                  { value: '4', label: '4th Year' }
                ]}
                className="min-w-[120px]"
              />
              <SearchableSelect
                value={selectedDepartment}
                onChange={setSelectedDepartment}
                placeholder="All Depts"
                options={[
                  { value: '', label: 'All Depts' },
                  ...sortedDepartments.map(d => ({ value: d.departmentId.toString(), label: d.branchCode }))
                ]}
                className="min-w-[120px]"
              />
              <SearchableSelect
                value={selectedSection}
                onChange={setSelectedSection}
                placeholder="All Sections"
                options={[
                  { value: '', label: 'All Sections' },
                  ...availableSections.map(s => ({ value: s, label: s }))
                ]}
                className="min-w-[120px]"
              />
              <SearchableSelect
                value={selectedFaculty}
                onChange={setSelectedFaculty}
                placeholder="All Faculty"
                options={[
                  { value: '', label: 'All Faculty' },
                  ...facultyList.map(f => ({ value: (f.name || f).toString(), label: (f.label || f).toString() }))
                ]}
                className="min-w-[180px]"
              />
              <SearchableSelect
                value={selectedDay}
                onChange={setSelectedDay}
                placeholder="All Days"
                options={[
                  { value: '', label: 'All Days' },
                  ...['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => ({ value: d, label: d }))
                ]}
                className="min-w-[140px]"
              />
            </>
          )}

          {/* View Mode Toggle (Grid/List) */}
          <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto md:ml-auto mt-2 md:mt-0 justify-center">
            <button
              onClick={() => { setViewMode('grid'); setIsEditMode(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'grid' && !isEditMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-navy'
              }`}
            >
              <LayoutGrid size={14} />
              Grid View
            </button>
            <button
              onClick={() => { setViewMode('list'); setIsEditMode(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'list' && !isEditMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-navy'
              }`}
            >
              <List size={14} />
              List View
            </button>
          </div>
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

          {!loading && timetables.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {isEditMode && (
                <div className="bg-white p-4 rounded-xl border border-line shadow-sm mb-4">
                  <p className="text-sm text-slate-600">
                    <strong>Edit Mode Active:</strong> {viewMode === 'grid' ? 'Click on any class in the grid to edit it directly.' : 'You can click the Edit icon on any row below to update the Course, Section, Faculty, or Room.'} Changes are saved instantly.
                  </p>
                </div>
              )}
              {viewMode === 'grid' ? (
                <FullWeekTimetableGrid 
                  timetables={timetables} 
                  viewMode={activeTab}
                  isEditMode={isEditMode}
                  resources={resourceList}
                  setTimetables={setTimetables}
                />
              ) : (
                <EditableTimetableGrid 
                  timetables={timetables} 
                  resources={resourceList} 
                  setTimetables={setTimetables}
                  readOnly={!isEditMode} 
                />
              )}
            </div>
          )}

          {!loading && timetables.length === 0 && (selectedResource || (selectedSection && selectedDepartment && selectedStudentYear) || selectedFaculty) && (
            <div className="bg-white p-12 rounded-xl border border-line text-center text-slate-500 shadow-sm">
              No classes scheduled for the selected {activeTab.toLowerCase().slice(0, -1)}.
            </div>
          )}
          
          {!loading && timetables.length === 0 && activeTab === 'Sections' && (!selectedSection || !selectedDepartment || !selectedStudentYear) && (
            <div className="bg-white p-12 rounded-xl border border-line text-center text-slate-500 shadow-sm">
              Please select a Year, Branch, and Section to view the timetable.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
