import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';

export default function RoomQuickSearchModal({ isOpen, onClose, onSearch, resourceTypes = [] }) {
  // Initialize with tomorrow's date by default for convenience, or today
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  
  const [duration, setDuration] = useState('FN'); // 'FN', 'AN', 'FullDay'
  const [roomType, setRoomType] = useState('Room'); // 'Seminar', 'Room', 'Lab', or 'Size'
  const [minCapacity, setMinCapacity] = useState('');

  if (!isOpen) return null;

  const handleSearch = () => {
    // Map roomType to resourceTypeId
    let resourceTypeId = '';
    if (roomType !== 'Size' && resourceTypes.length > 0) {
      let match;
      if (roomType === 'Seminar') {
        match = resourceTypes.find(t => t.typeName.toLowerCase().includes('seminar') || t.typeName.toLowerCase().includes('hall'));
      } else if (roomType === 'Room') {
        match = resourceTypes.find(t => t.typeName.toLowerCase().includes('class') || t.typeName.toLowerCase() === 'room');
      } else if (roomType === 'Lab') {
        match = resourceTypes.find(t => t.typeName.toLowerCase().includes('lab'));
      }
      if (match) {
        resourceTypeId = match.resourceTypeId;
      }
    }

    onSearch({
      date,
      duration,
      roomType,
      resourceTypeId: resourceTypeId || '',
      minCapacity: roomType === 'Size' ? minCapacity : ''
    });
  };

  return (
    <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-line flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-display font-bold text-navy">Find a Room</h2>
            <p className="text-sm text-slate-500 mt-1">Answer a few simple questions</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-navy hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Question 1 */}
          <div>
            <label className="block text-sm font-bold text-navy mb-2">1. When do you need it?</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full p-3 rounded-xl border border-line bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          {/* Question 2 */}
          <div>
            <label className="block text-sm font-bold text-navy mb-2">2. For how long?</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setDuration('FN')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all border ${duration === 'FN' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-line hover:bg-slate-50'}`}
              >
                FN (Morning)
              </button>
              <button
                onClick={() => setDuration('AN')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all border ${duration === 'AN' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-line hover:bg-slate-50'}`}
              >
                AN (Afternoon)
              </button>
              <button
                onClick={() => setDuration('FullDay')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all border ${duration === 'FullDay' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-line hover:bg-slate-50'}`}
              >
                Full Day
              </button>
            </div>
          </div>

          {/* Question 3 */}
          <div>
            <label className="block text-sm font-bold text-navy mb-2">3. What type of room?</label>
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={() => setRoomType('Room')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all border ${roomType === 'Room' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-line hover:bg-slate-50'}`}
              >
                Room
              </button>
              <button
                onClick={() => setRoomType('Lab')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all border ${roomType === 'Lab' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-line hover:bg-slate-50'}`}
              >
                Lab
              </button>
              <button
                onClick={() => setRoomType('Seminar')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all border ${roomType === 'Seminar' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-line hover:bg-slate-50'}`}
              >
                Seminar
              </button>
              <button
                onClick={() => setRoomType('Size')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all border ${roomType === 'Size' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-line hover:bg-slate-50'}`}
              >
                By Size
              </button>
            </div>

            {roomType === 'Size' && (
              <div className="mt-3 animate-in slide-in-from-top-2">
                <select
                  value={minCapacity}
                  onChange={e => setMinCapacity(e.target.value)}
                  className="w-full p-3 rounded-xl border border-line bg-slate-50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                >
                  <option value="">Any Size</option>
                  <option value="30">30+ seats</option>
                  <option value="60">60+ seats</option>
                  <option value="100">100+ seats</option>
                  <option value="200">200+ seats</option>
                  <option value="300">300+ seats</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 pt-0 flex flex-col gap-3">
          <button
            onClick={handleSearch}
            className="w-full py-3.5 rounded-xl bg-navy hover:bg-navy/90 text-white font-bold shadow-lg shadow-navy/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            <Search size={18} />
            Find Available Rooms
          </button>
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            Skip & Explore All Rooms
          </button>
        </div>
      </div>
    </div>
  );
}
