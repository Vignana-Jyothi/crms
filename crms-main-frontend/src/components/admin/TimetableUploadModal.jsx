import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Check, Loader2, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { timetableApi } from '../../api/endpoints';
import SearchableSelect from '../common/SearchableSelect';

export default function TimetableUploadModal({ isOpen, onClose, contextFilters, onSaveSuccess, initialMode = 'upload', departments = [], resources = [], facultyList = [], isInline = false }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState('');
  const [extractedData, setExtractedData] = useState(initialMode === 'manual' ? [] : null);
  const [isSaving, setIsSaving] = useState(false);

  // Update extractedData if initialMode changes while opening
  React.useEffect(() => {
    if (isOpen) {
      setExtractedData(initialMode === 'manual' ? [] : null);
    }
  }, [isOpen, initialMode]);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const resetState = () => {
    setFile(null);
    setExtractedData(null);
    setError('');
    setIsExtracting(false);
    setIsSaving(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const onFileSelect = (selectedFile) => {
    setError('');
    if (!selectedFile) return;
    
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please upload a PDF or Image (PNG, JPG) file.');
      return;
    }
    
    setFile(selectedFile);
  };

  const handleExtract = async () => {
    if (!file) return;
    
    setIsExtracting(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('departmentId', contextFilters.departmentId || '');
    formData.append('studentYear', contextFilters.studentYear || '');
    formData.append('section', contextFilters.section || '');

    try {
      const data = await timetableApi.extract(formData);
      setExtractedData(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to extract timetable data. Please try again or enter manually.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRowChange = (index, field, value) => {
    const newData = [...extractedData];
    newData[index][field] = value;
    setExtractedData(newData);
  };

  const handleRemoveRow = (index) => {
    const newData = [...extractedData];
    newData.splice(index, 1);
    setExtractedData(newData);
  };
  
  const handleAddRow = () => {
    const newRow = {
      id: `manual-${Date.now()}`,
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '10:00',
      courseName: 'New Subject',
      departmentId: contextFilters.departmentId || null,
      studentYear: contextFilters.studentYear || '',
      section: contextFilters.section || '',
      facultyName: '',
      resourceId: ''
    };
    setExtractedData([...(extractedData || []), newRow]);
  };

  const handleSaveToDatabase = async () => {
    if (!extractedData || extractedData.length === 0) {
       setError("No data to save.");
       return;
    }
    
    setIsSaving(true);
    setError('');
    try {
      await timetableApi.batch(extractedData);
      onSaveSuccess();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save timetable to database.');
    } finally {
      setIsSaving(false);
    }
  };

  const content = (
    <div className={isInline ? "bg-white rounded-2xl border border-line shadow-sm w-full flex flex-col overflow-hidden mb-6 animate-in fade-in" : "bg-white rounded-2xl shadow-xl w-full max-w-[95vw] lg:max-w-[90vw] xl:max-w-[1400px] max-h-[95vh] flex flex-col overflow-hidden"}>
      
      {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line shrink-0">
          <div>
            <h2 className="text-xl font-bold text-navy">
              {initialMode === 'manual' 
                ? 'Manual Bulk Entry'
                : extractedData 
                  ? 'Review Extracted Timetable' 
                  : 'Upload Timetable'
              }
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {initialMode === 'manual'
                ? 'Quickly add multiple classes to the schedule by filling out the table below.'
                : extractedData 
                  ? 'Review and correct the extracted data below before saving to the database.'
                  : 'Upload an image or PDF of a timetable to auto-extract the classes.'
              }
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-100 rounded-xl flex items-start gap-3">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div className="text-sm">{error}</div>
            </div>
          )}

          {!extractedData ? (
            /* Upload State */
            <div className="flex flex-col items-center justify-center space-y-6 max-w-lg mx-auto py-10">
              
              <div 
                className={`w-full p-10 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all ${
                  isDragging 
                    ? 'border-primary bg-primary/5 scale-[1.02]' 
                    : file 
                      ? 'border-green-400 bg-green-50' 
                      : 'border-slate-300 bg-white hover:border-primary/50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    onFileSelect(e.dataTransfer.files[0]);
                  }
                }}
              >
                {file ? (
                  <div className="flex flex-col items-center text-green-600">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <Check size={32} />
                    </div>
                    <p className="font-semibold">{file.name}</p>
                    <p className="text-sm text-green-600/70 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button 
                      onClick={() => setFile(null)}
                      className="mt-4 text-xs font-medium text-slate-500 hover:text-red-500 underline"
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-500">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                      <Upload size={32} />
                    </div>
                    <p className="font-medium text-navy">Drag & Drop your file here</p>
                    <p className="text-sm mt-1">or click to browse</p>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-6 px-6 py-2.5 bg-white border border-line shadow-sm rounded-xl text-sm font-medium text-navy hover:bg-slate-50 transition-colors"
                    >
                      Select File
                    </button>
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={fileInputRef}
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          onFileSelect(e.target.files[0]);
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-4 w-full">
                <button
                  onClick={handleExtract}
                  disabled={!file || isExtracting}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-medium shadow-md shadow-primary/20 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isExtracting ? (
                    <><Loader2 size={18} className="animate-spin" /> Extracting Data...</>
                  ) : (
                    <>Extract Timetable</>
                  )}
                </button>
              </div>
              
              {/* Context Notice */}
              <div className="w-full text-center text-xs text-slate-500 bg-white p-3 border border-line rounded-lg">
                <p><strong>Note:</strong> Classes will be automatically assigned to the current filters:</p>
                <div className="flex justify-center gap-4 mt-1 font-medium text-navy">
                  <span>Year: {contextFilters.studentYear || 'Any'}</span>
                  <span>Dept ID: {contextFilters.departmentId || 'Any'}</span>
                  <span>Section: {contextFilters.section || 'Any'}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Preview State */
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                 <h3 className="font-semibold text-navy">{initialMode === 'manual' ? 'Classes to Add' : 'Extracted Classes'} ({extractedData.length})</h3>
                 <button 
                    onClick={handleAddRow}
                    className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                 >
                    + Add Row
                 </button>
              </div>
              <div className="bg-white rounded-xl border border-line shadow-sm overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap min-w-[1200px]">
                  <thead className="bg-slate-50 border-b border-line text-slate-600 font-medium">
                    <tr>
                      <th className="px-3 py-3 w-32">Day</th>
                      <th className="px-3 py-3 w-32">Start Time</th>
                      <th className="px-3 py-3 w-32">End Time</th>
                      <th className="px-3 py-3 w-48">Subject</th>
                      <th className="px-3 py-3 w-32">Year</th>
                      <th className="px-3 py-3 w-32">Dept</th>
                      <th className="px-3 py-3 w-24">Section</th>
                      <th className="px-3 py-3 w-48">Faculty</th>
                      <th className="px-3 py-3 w-48">Classroom</th>
                      <th className="px-3 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {extractedData.map((row, index) => (
                      <tr key={row.id || index} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2">
                          <SearchableSelect 
                            value={row.dayOfWeek}
                            onChange={(val) => handleRowChange(index, 'dayOfWeek', val)}
                            options={[
                               { value: 'Monday', label: 'Monday' },
                               { value: 'Tuesday', label: 'Tuesday' },
                               { value: 'Wednesday', label: 'Wednesday' },
                               { value: 'Thursday', label: 'Thursday' },
                               { value: 'Friday', label: 'Friday' },
                               { value: 'Saturday', label: 'Saturday' }
                            ]}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input 
                            type="time" 
                            value={row.startTime}
                            onChange={(e) => handleRowChange(index, 'startTime', e.target.value)}
                            className="w-full p-2 border border-line rounded-lg bg-white"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input 
                            type="time" 
                            value={row.endTime}
                            onChange={(e) => handleRowChange(index, 'endTime', e.target.value)}
                            className="w-full p-2 border border-line rounded-lg bg-white"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input 
                            type="text" 
                            value={row.courseName || ''}
                            onChange={(e) => handleRowChange(index, 'courseName', e.target.value)}
                            className="w-full p-2 border border-line rounded-lg bg-white placeholder:text-slate-300 min-h-[38px]"
                            placeholder="Subject..."
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[120px]">
                          <SearchableSelect 
                            value={row.studentYear ? String(row.studentYear) : ''}
                            onChange={(val) => handleRowChange(index, 'studentYear', val)}
                            placeholder="Any"
                            options={[
                              { value: '', label: 'Any' },
                              { value: '1', label: '1st Year' },
                              { value: '2', label: '2nd Year' },
                              { value: '3', label: '3rd Year' },
                              { value: '4', label: '4th Year' }
                            ]}
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[150px]">
                          <SearchableSelect 
                            value={row.departmentId ? String(row.departmentId) : ''}
                            onChange={(val) => handleRowChange(index, 'departmentId', val ? parseInt(val) : '')}
                            placeholder="Any"
                            options={[
                              { value: '', label: 'Any' },
                              ...departments.map(d => ({ value: String(d.departmentId), label: d.departmentName }))
                            ]}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input 
                            type="text" 
                            value={row.section || ''}
                            onChange={(e) => handleRowChange(index, 'section', e.target.value)}
                            className="w-full p-2 border border-line rounded-lg bg-white placeholder:text-slate-300 min-h-[38px]"
                            placeholder="Section..."
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[180px]">
                          <SearchableSelect 
                            value={row.facultyName || ''}
                            onChange={(val) => handleRowChange(index, 'facultyName', val)}
                            placeholder="Faculty..."
                            options={[
                              { value: '', label: 'Faculty...' },
                              ...facultyList.map(f => ({ value: (f.name || f).toString(), label: (f.label || f).toString() }))
                            ]}
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[180px]">
                          <SearchableSelect 
                            value={row.resourceId ? String(row.resourceId) : ''}
                            onChange={(val) => handleRowChange(index, 'resourceId', val ? parseInt(val) : '')}
                            placeholder="No Room"
                            options={[
                              { value: '', label: 'No Room' },
                              ...resources.map(r => ({ value: String(r.resourceId), label: r.resourceName }))
                            ]}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button 
                            onClick={() => handleRemoveRow(index)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                            title="Remove row"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {extractedData.length === 0 && (
                      <tr>
                        <td colSpan="10" className="px-4 py-12 text-center text-slate-500">
                           No classes to show. Click "Add Row" above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {extractedData && (
          <div className="p-4 border-t border-line bg-white flex justify-between items-center shrink-0">
             {initialMode === 'manual' ? (
                <div></div>
             ) : (
               <button
                  onClick={() => setExtractedData(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-navy transition-colors"
                >
                  Back to Upload
                </button>
             )}
              
              <button
                onClick={handleSaveToDatabase}
                disabled={isSaving || extractedData.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm shadow-green-600/20"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Save to Database
              </button>
          </div>
        )}
      </div>
  );

  if (isInline) {
    return isOpen ? content : null;
  }

  return isOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/50 backdrop-blur-sm animate-in fade-in duration-200">
       {content}
    </div>
  ) : null;
}
