import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { masterDataApi, resourcesApi, timetableApi } from '../../api/endpoints';
import { useAuth } from '../../context/authStore';
import { ADMINS } from '../../constants/roles';
import FullWeekTimetableGrid from '../../components/admin/FullWeekTimetableGrid';
import EditableTimetableGrid from '../../components/admin/EditableTimetableGrid';
import TimetableUploadModal from '../../components/admin/TimetableUploadModal';
import BulkGridEditor from '../../components/admin/BulkGridEditor';
import { Search, Edit2, List, LayoutGrid, X, Upload, Download, Loader2 } from 'lucide-react';
import SearchableSelect from '../../components/common/SearchableSelect';
import { PROGRAMS, DEFAULT_PROGRAM, yearOptionsFor, sectionLabel, ordinal } from '../../constants/programs';

const STORAGE_KEY = 'crms_timetables_filters';

export default function TimetablesView() {
  const { user } = useAuth();
  // Everyone can read timetables; only admins can switch to editing.
  const canEdit = ADMINS.includes(user?.roleId);
  const savedFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');

  const [activeTab, setActiveTab] = useState(savedFilters.activeTab || 'Rooms'); // Rooms, Sections, Faculty
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewMode, setViewMode] = useState(savedFilters.viewMode || 'grid'); // 'grid' or 'list'
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadModalMode, setUploadModalMode] = useState('upload');

  const [resourceList, setResourceList] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [sectionsData, setSectionsData] = useState([]); // [{section, departmentId, studentYear, program}]
  
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedResource, setSelectedResource] = useState(savedFilters.selectedResource || '');
  const [selectedFaculty, setSelectedFaculty] = useState(savedFilters.selectedFaculty || '');
  
  const [selectedProgram, setSelectedProgram] = useState(savedFilters.selectedProgram || DEFAULT_PROGRAM);
  const [selectedStudentYear, setSelectedStudentYear] = useState(savedFilters.selectedStudentYear || '');
  const [selectedDepartment, setSelectedDepartment] = useState(savedFilters.selectedDepartment || '');
  const [selectedSection, setSelectedSection] = useState(savedFilters.selectedSection || '');
  
  const [selectedBlock, setSelectedBlock] = useState(savedFilters.selectedBlock || '');
  const [selectedDay, setSelectedDay] = useState(savedFilters.selectedDay || '');
  const [selectedDate, setSelectedDate] = useState(savedFilters.selectedDate || '');
  
  const [departments, setDepartments] = useState([]);
  const [blocks, setBlocks] = useState([]);

  const [isDownloading, setIsDownloading] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      activeTab, viewMode, selectedResource, selectedFaculty,
      selectedProgram, selectedStudentYear, selectedDepartment, selectedSection,
      selectedBlock, selectedDay, selectedDate
    }));
  }, [activeTab, viewMode, selectedResource, selectedFaculty, selectedProgram, selectedStudentYear, selectedDepartment, selectedSection, selectedBlock, selectedDay, selectedDate]);

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
      masterDataApi.departments().then(data => {
        setDepartments(data.filter(d => 
          !d.departmentName.includes('Institute (Shared') && 
          !d.departmentName.includes('Unspecified Programme')
        ));
      }),
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
      if (activeTab === 'Rooms') {
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
        params.program = selectedProgram;
        params.studentYear = selectedStudentYear;
        params.departmentId = selectedDepartment;
        params.section = selectedSection;
      } else if (activeTab === 'Faculty') {
        if (!selectedFaculty) {
          setTimetables([]);
          setLoading(false);
          return;
        }
        params.facultyName = selectedFaculty;
      }
    } else {
      // In Edit Mode, filters are combined
      if (!selectedStudentYear && !selectedDepartment && !selectedSection && !selectedFaculty && !selectedResource) {
        setTimetables([]);
        setLoading(false);
        return;
      }
      // Program qualifies year/section ("1st Year - A" exists in several programs)
      if (selectedStudentYear || selectedSection) params.program = selectedProgram;
      if (selectedStudentYear) params.studentYear = selectedStudentYear;
      if (selectedDepartment) params.departmentId = selectedDepartment;
      if (selectedSection) params.section = selectedSection;
      if (selectedFaculty) params.facultyName = selectedFaculty;
      if (selectedResource) params.resourceId = selectedResource;
    }
    
    const derivedDay = selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' }) : selectedDay;
    if (derivedDay) params.dayOfWeek = derivedDay;

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
  }, [activeTab, isEditMode, selectedResource, selectedSection, selectedFaculty, selectedDepartment, selectedBlock, selectedDay, selectedDate, selectedProgram, selectedStudentYear]);

  // Fetch when selection changes
  useEffect(() => {
    refreshTimetables();
  }, [refreshTimetables]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsEditMode(false);
    // Don't reset timetables or filters so state is preserved when switching back
  };

  const handleProgramChange = (val) => {
    const program = val || DEFAULT_PROGRAM;
    setSelectedProgram(program);
    if (Number(selectedStudentYear) > yearOptionsFor(program).length) setSelectedStudentYear('');
    if (!isEditMode) setSelectedDepartment('');
    setSelectedSection('');
  };

  const availableSections = sectionsData
    .filter(s => {
      if ((s.program || DEFAULT_PROGRAM) !== selectedProgram) return false;

      // If the DB has null studentYear (legacy data), don't filter it out
      if (selectedStudentYear && s.studentYear && s.studentYear !== selectedStudentYear) return false;
      
      // Allow CSBS to show under CSE even if its departmentId was null in legacy DB
      if (selectedDepartment && s.departmentId !== parseInt(selectedDepartment)) {
        const isCSE = parseInt(selectedDepartment) === departments.find(d => d.branchCode === 'CSE')?.departmentId;
        const isLegacyCSBS = s.section && s.section.toUpperCase().includes('CSBS') && !s.departmentId;
        if (!(isCSE && isLegacyCSBS)) {
          return false;
        }
      }
      return true;
    })
    .map(s => s.section)
    .filter((value, index, self) => self.indexOf(value) === index)
    .sort();

  const sortedDepartments = [...departments].sort((a, b) => {
    if (!selectedStudentYear) return a.departmentName.localeCompare(b.departmentName);
    
    const hasData = (deptId) => sectionsData.some(s =>
      s.departmentId === deptId && s.studentYear === selectedStudentYear && (s.program || DEFAULT_PROGRAM) === selectedProgram
    );
    const aHasData = hasData(a.departmentId);
    const bHasData = hasData(b.departmentId);
    
    if (aHasData && !bHasData) return -1;
    if (!aHasData && bHasData) return 1;
    return a.departmentName.localeCompare(b.departmentName);
  });

  // PG programs only run in a few branches (e.g. MCA is only under IT), so list just those
  const programDepartments = selectedProgram === DEFAULT_PROGRAM
    ? sortedDepartments
    : sortedDepartments.filter(d => sectionsData.some(s =>
        s.departmentId === d.departmentId && s.program === selectedProgram &&
        (!selectedStudentYear || s.studentYear === selectedStudentYear)
      ));

  const programLabel = PROGRAMS.find(p => p.value === selectedProgram)?.label;

  const getExportTitle = () => {
    if (activeTab === 'Rooms') {
      const room = resourceList.find(r => r.resourceId === selectedResource || r.resourceId?.toString() === selectedResource);
      return room ? `${room.resourceName} Timetable` : 'Room Timetable';
    }
    if (activeTab === 'Sections') {
      const dept = departments.find(d => d.departmentId.toString() === selectedDepartment);
      const yearLabel = selectedStudentYear ? `${ordinal(selectedStudentYear)} Year` : '';
      const parts = [
        programLabel,
        yearLabel,
        dept?.departmentName,
        selectedSection && `Section ${sectionLabel(selectedSection, selectedProgram)}`,
      ].filter(Boolean);
      return parts.length ? `${parts.join(' - ')} Timetable` : 'Section Timetable';
    }
    if (activeTab === 'Faculty') {
      return selectedFaculty ? `${selectedFaculty} Timetable` : 'Faculty Timetable';
    }
    return 'Timetable';
  };

  const handleDownloadPdf = async () => {
    if (!exportRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);
      const scale = 2;
      const canvas = await html2canvas(exportRef.current, {
        scale,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');

      // Size the page to the content itself (plus a small margin) instead of
      // fitting the image into a fixed A4 sheet, so there's no leftover
      // whitespace around a wide/short timetable grid.
      const pxToPt = 0.75; // 96dpi canvas pixels -> 72dpt PDF points
      const margin = 24;
      const titleHeight = 28;
      const maxContentDimension = 2500; // cap very large grids to a sane print size

      let contentWidth = (canvas.width / scale) * pxToPt;
      let contentHeight = (canvas.height / scale) * pxToPt;
      const shrink = Math.min(1, maxContentDimension / Math.max(contentWidth, contentHeight));
      contentWidth *= shrink;
      contentHeight *= shrink;

      const pageWidth = contentWidth + margin * 2;
      const pageHeight = contentHeight + margin * 2 + titleHeight;
      const orientation = pageWidth >= pageHeight ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'pt', format: [pageWidth, pageHeight] });

      const title = getExportTitle();
      pdf.setFontSize(14);
      pdf.text(title, margin, margin);
      pdf.addImage(imgData, 'PNG', margin, margin + titleHeight, contentWidth, contentHeight);

      const fileName = `${title.replace(/[^a-z0-9]+/gi, '_')}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Pre-select the branch when the program has only one (MCA -> Information Technology)
  useEffect(() => {
    if (isEditMode || activeTab !== 'Sections' || selectedProgram === DEFAULT_PROGRAM) return;
    if (programDepartments.length === 1) {
      const onlyId = programDepartments[0].departmentId.toString();
      if (selectedDepartment !== onlyId) setSelectedDepartment(onlyId);
    }
  }, [isEditMode, activeTab, selectedProgram, programDepartments, selectedDepartment]);

  return (
    <div>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Navigation */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="shrink-0">
            <h1 className="font-display text-2xl font-semibold text-navy">Timetables</h1>
            <p className="mt-1 text-sm text-ink/60">The weekly class schedule for any room, class section or faculty member.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2 lg:mt-0">
            <div className="flex flex-wrap items-center gap-1 bg-white p-1.5 rounded-xl border border-line shadow-sm mr-2">
              {['Rooms', 'Sections', 'Faculty'].map(tab => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab && !isEditMode
                      ? 'bg-navy text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-navy'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {isEditMode && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (isUploadModalOpen && uploadModalMode === 'manual') {
                      setIsUploadModalOpen(false);
                    } else {
                      setUploadModalMode('manual');
                      setIsUploadModalOpen(true);
                      setViewMode('grid');
                    }
                  }}
                  className={`flex items-center justify-center gap-2 p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors shadow-sm border ${
                    isUploadModalOpen && uploadModalMode === 'manual'
                      ? 'bg-navy text-white border-navy'
                      : 'bg-white text-slate-700 border-line hover:bg-slate-50'
                  }`}
                >
                  <LayoutGrid size={18} />
                  <span className="hidden sm:inline">{isUploadModalOpen && uploadModalMode === 'manual' ? 'Cancel Bulk Entry' : 'Manual Bulk Entry'}</span>
                </button>

                <button
                  onClick={() => { setUploadModalMode('upload'); setIsUploadModalOpen(true); }}
                  className="flex items-center justify-center gap-2 p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors shadow-sm border bg-white text-slate-700 border-line hover:bg-slate-50"
                >
                  <Upload size={18} />
                  <span className="hidden sm:inline">Auto-Extract PDF</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 ml-2">
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloading || timetables.length === 0}
                title="Download the current timetable as a PDF"
                className="flex items-center justify-center gap-2 p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors shadow-sm border bg-white text-slate-700 border-line hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                <span className="hidden sm:inline">{isDownloading ? 'Preparing...' : 'Download PDF'}</span>
              </button>

              {canEdit && <button
                onClick={() => { setIsEditMode(!isEditMode); setActiveTab(''); setIsUploadModalOpen(false); }}
                className={`flex items-center justify-center gap-2 p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors shadow-sm border ${
                  isEditMode
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-navy border-line hover:bg-navy/5'
                }`}
              >
                <Edit2 size={18} />
                <span className="hidden sm:inline">Edit Timetables</span>
              </button>}
            </div>
          </div>
        </div>

        {/* Filters Area */}
        <div className="bg-white p-4 rounded-xl border border-line shadow-sm flex flex-col xl:flex-row items-start xl:items-center gap-4">
          <div className="hidden lg:block shrink-0">
            <Search size={20} className="text-slate-400" />
          </div>
          
          <div className={`w-full flex-1 ${
            isEditMode
              ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3'
              : activeTab === 'Sections'
                // One row on desktop: short Program/Year/Day, wide Branch/Section
                ? 'grid grid-cols-2 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,0.85fr)_minmax(0,1.6fr)_minmax(0,1.9fr)_minmax(0,0.9fr)] gap-3'
                : 'flex flex-wrap items-center gap-3'
          }`}>
          {(!isEditMode && activeTab === 'Rooms') && (
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
                placeholder="Select a Room / Lab..."
                options={[
                  { value: '', label: 'Select a Room / Lab...' },
                  ...resourceList
                    .filter(r => !selectedBlock || r.blockId === parseInt(selectedBlock))
                    .map(r => ({ value: r.resourceId, label: `${r.resourceName} (${r.resourceType?.typeName || 'Room'})` }))
                ]}
                className="min-w-[250px]"
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

          {(!isEditMode && activeTab === 'Sections') && (
            <>
              <SearchableSelect
                value={selectedProgram}
                onChange={handleProgramChange}
                placeholder="Select Program..."
                options={PROGRAMS.map(p => ({ value: p.value, label: p.label }))}
                className="min-w-0"
              />
              <SearchableSelect
                value={selectedStudentYear}
                onChange={val => { setSelectedStudentYear(val); setSelectedSection(''); }}
                placeholder="Select Year..."
                options={[
                  { value: '', label: 'Select Year...' },
                  ...yearOptionsFor(selectedProgram)
                ]}
                className="min-w-0"
              />
              <SearchableSelect
                value={selectedDepartment}
                onChange={val => { setSelectedDepartment(val); setSelectedSection(''); }}
                placeholder={programDepartments.length === 0 ? `No ${programLabel} timetables yet` : 'Select Branch...'}
                options={[
                  { value: '', label: 'Select Branch...' },
                  ...programDepartments.map(d => ({ value: d.departmentId.toString(), label: d.departmentName }))
                ]}
                title={programDepartments.find(d => d.departmentId.toString() === selectedDepartment)?.departmentName}
                className="min-w-0 col-span-2 lg:col-span-1"
              />
              <SearchableSelect
                value={selectedSection}
                onChange={val => setSelectedSection(val ? val.toUpperCase() : '')}
                placeholder="Select or Type Section..."
                disabled={!selectedStudentYear || !selectedDepartment}
                allowCreate={true}
                options={[
                  ...availableSections.map(s => ({ value: s, label: sectionLabel(s, selectedProgram) }))
                ]}
                title={selectedSection ? sectionLabel(selectedSection, selectedProgram) : undefined}
                className="min-w-0 col-span-2 lg:col-span-1"
              />
              <SearchableSelect
                value={selectedDay}
                onChange={setSelectedDay}
                placeholder="All Days"
                options={[
                  { value: '', label: 'All Days' },
                  ...['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => ({ value: d, label: d }))
                ]}
                className="min-w-0 col-span-2 lg:col-span-1"
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

          {isEditMode && (
            <>
              <SearchableSelect
                value={selectedProgram}
                onChange={handleProgramChange}
                placeholder="Program"
                options={PROGRAMS.map(p => ({ value: p.value, label: p.label }))}
                className="min-w-[110px]"
              />
              <SearchableSelect
                value={selectedStudentYear}
                onChange={setSelectedStudentYear}
                placeholder="All Years"
                options={[
                  { value: '', label: 'All Years' },
                  ...yearOptionsFor(selectedProgram)
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
                onChange={val => setSelectedSection(val ? val.toUpperCase() : '')}
                placeholder="Select Section"
                allowCreate={true}
                options={[
                  ...availableSections.map(s => ({ value: s, label: sectionLabel(s, selectedProgram) }))
                ]}
                className="min-w-[120px]"
              />
              <SearchableSelect
                value={selectedResource}
                onChange={setSelectedResource}
                placeholder="All Rooms"
                options={[
                  { value: '', label: 'All Rooms' },
                  ...resourceList.map(r => ({ value: r.resourceId, label: r.resourceName }))
                ]}
                className="min-w-[140px]"
              />
              <SearchableSelect
                value={selectedFaculty}
                onChange={setSelectedFaculty}
                placeholder="All Faculty"
                allowCreate={true}
                options={[
                  { value: '', label: 'All Faculty' },
                  ...facultyList.map(f => ({ value: (f.name || f).toString(), label: (f.label || f).toString() }))
                ]}
                className="min-w-[150px]"
              />
              <SearchableSelect
                value={selectedDay}
                onChange={setSelectedDay}
                placeholder="All Days"
                options={[
                  { value: '', label: 'All Days' },
                  ...['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => ({ value: d, label: d }))
                ]}
                className="min-w-[120px]"
              />
            </>
          )}

          </div>

          {/* Clear Filters Button */}
          <AnimatePresence>
          {((activeTab === 'Rooms' && (selectedResource || selectedBlock || selectedDay || selectedDate)) ||
            (activeTab === 'Sections' && (selectedStudentYear || selectedDepartment || selectedSection || selectedDay || selectedDate)) ||
            (activeTab === 'Faculty' && (selectedFaculty || selectedDay || selectedDate))) && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (activeTab === 'Rooms') {
                  setSelectedResource('');
                  setSelectedBlock('');
                  setSelectedDay('');
                  setSelectedDate('');
                } else if (activeTab === 'Sections') {
                  setSelectedProgram(DEFAULT_PROGRAM);
                  setSelectedStudentYear('');
                  setSelectedDepartment('');
                  setSelectedSection('');
                  setSelectedDay('');
                  setSelectedDate('');
                } else if (activeTab === 'Faculty') {
                  setSelectedFaculty('');
                  setSelectedDay('');
                  setSelectedDate('');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors shrink-0 border border-red-200 mt-2 xl:mt-0"
            >
              <X size={14} /> Clear
            </motion.button>
          )}
          </AnimatePresence>

          {/* View Mode Toggle (Grid/List) */}
          <div className="flex bg-slate-100 p-1 rounded-lg w-full xl:w-auto justify-center shrink-0 mt-2 xl:mt-0 xl:ml-auto">
            <button
              onClick={() => { setViewMode('grid'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'grid' ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-navy'
              }`}
            >
              <LayoutGrid size={14} />
              Grid View
            </button>
            <button
              onClick={() => { setViewMode('list'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'list' ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-navy'
              }`}
            >
              <List size={14} />
              List View
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="relative min-h-[400px]">
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

          {(timetables.length > 0 || isEditMode) && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {isEditMode && (
                <div className="bg-white p-4 rounded-xl border border-line shadow-sm mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <p className="text-sm text-slate-600">
                    <strong>Edit Mode Active:</strong> {viewMode === 'grid' ? 'Click on any class in the grid to edit it directly, or click a Free slot to add a new class.' : 'You can click the Edit icon on any row below to update the Course, Section, Faculty, or Room.'} Changes are saved instantly.
                  </p>
                </div>
              )}
              
              {isUploadModalOpen && uploadModalMode === 'manual' && (
                <BulkGridEditor
                  departments={departments}
                  resources={resourceList}
                  onSaveSuccess={() => {
                    refreshTimetables();
                    setIsUploadModalOpen(false);
                  }}
                  onCancel={() => setIsUploadModalOpen(false)}
                  initialDepartment={selectedDepartment}
                  initialProgram={selectedProgram}
                  initialStudentYear={selectedStudentYear}
                  initialSection={selectedSection}
                  availableSections={availableSections}
                />
              )}

              {/* Only show main grid if we have data OR we are in edit mode with sufficient filters selected, AND we are not in Bulk Grid Editor mode */}
              {!(isUploadModalOpen && uploadModalMode === 'manual') && (timetables.length > 0 || (isEditMode && (selectedResource || selectedFaculty || (selectedSection && selectedDepartment && selectedStudentYear)))) && (
                <div ref={exportRef} className="bg-white">
                  {viewMode === 'grid' ? (
                    <FullWeekTimetableGrid
                      facultyList={facultyList}
                      timetables={timetables}
                      viewMode={activeTab}
                      isEditMode={isEditMode}
                      resources={resourceList}
                      setTimetables={setTimetables}
                      selectedDate={selectedDate}
                      selectedDay={selectedDay}
                      selectedProgram={selectedProgram}
                      selectedStudentYear={selectedStudentYear}
                      selectedDepartment={selectedDepartment}
                      selectedSection={selectedSection}
                      selectedFaculty={selectedFaculty}
                      selectedResource={selectedResource}
                    />
                  ) : (
                    <EditableTimetableGrid
                      timetables={timetables}
                      resources={resourceList}
                      facultyList={facultyList}
                      setTimetables={setTimetables}
                      readOnly={!isEditMode}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {(timetables.length === 0 && !loading && !(isUploadModalOpen && uploadModalMode === 'manual')) && (
            (!isEditMode && activeTab === 'Rooms' && selectedResource) ||
            (!isEditMode && activeTab === 'Sections' && (selectedSection && selectedDepartment && selectedStudentYear)) ||
            (!isEditMode && activeTab === 'Faculty' && selectedFaculty) ||
            (isEditMode && (selectedResource || selectedFaculty || selectedSection || selectedDepartment || selectedStudentYear))
          ) && (
            <div className="bg-white p-12 rounded-xl border border-line text-center text-slate-500 shadow-sm">
              No classes scheduled for the selected {isEditMode ? 'filters' : activeTab ? activeTab.toLowerCase().slice(0, -1) : 'filters'}.
            </div>
          )}
          
          {!loading && timetables.length === 0 && !isEditMode && activeTab === 'Sections' && (!selectedSection || !selectedDepartment || !selectedStudentYear) && !(isUploadModalOpen && uploadModalMode === 'manual') && (
            <div className="bg-white p-12 rounded-xl border border-line text-center text-slate-500 shadow-sm">
              Choose a program, year, branch and section above to see that class's timetable.
            </div>
          )}

          {!loading && timetables.length === 0 && !isEditMode && activeTab === 'Rooms' && !selectedResource && !(isUploadModalOpen && uploadModalMode === 'manual') && (
            <div className="bg-white p-12 rounded-xl border border-line text-center text-slate-500 shadow-sm">
              Choose a room or lab above to see its weekly timetable.
            </div>
          )}

          {!loading && timetables.length === 0 && !isEditMode && activeTab === 'Faculty' && !selectedFaculty && !(isUploadModalOpen && uploadModalMode === 'manual') && (
            <div className="bg-white p-12 rounded-xl border border-line text-center text-slate-500 shadow-sm">
              Choose a faculty member above to see their weekly timetable.
            </div>
          )}

          {!loading && timetables.length === 0 && isEditMode && (!selectedResource && !selectedFaculty && !selectedSection && !selectedDepartment && !selectedStudentYear) && !(isUploadModalOpen && uploadModalMode === 'manual') && (
            <div className="bg-white p-12 rounded-xl border border-line text-center text-slate-500 shadow-sm">
              Choose any of the filters above to find the timetables you want to edit.
            </div>
          )}
        </div>
        {/* End of max-w-7xl mx-auto space-y-6 */}
      </div>

      {isUploadModalOpen && uploadModalMode === 'upload' && (
        <TimetableUploadModal 
          isOpen={isUploadModalOpen} 
          onClose={() => setIsUploadModalOpen(false)} 
          initialMode={uploadModalMode}
          contextFilters={{
            departmentId: selectedDepartment,
            program: selectedProgram,
            studentYear: selectedStudentYear,
            section: selectedSection
          }}
          departments={departments}
          resources={resourceList}
          facultyList={facultyList}
          onSaveSuccess={() => {
            refreshTimetables();
          }}
          isInline={false}
        />
      )}
    </div>
  );
}
