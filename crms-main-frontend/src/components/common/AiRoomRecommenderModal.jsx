import React, { useState } from 'react';
import { resourcesApi } from '../../api/endpoints';

const QUICK_PROMPTS = [
  'Seminar Hall for 120 students tomorrow afternoon',
  'Air-conditioned Lab for 60 students in B-Block',
  'Large Auditorium for 250+ people next Monday',
  'Classroom with 70 seats near CSE department'
];

export default function AiRoomRecommenderModal({ isOpen, onClose, onSelectRoom }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSearch = async (queryText) => {
    const textToSearch = queryText || prompt;
    if (!textToSearch.trim()) return;

    setLoading(true);
    setError('');
    try {
      const data = await resourcesApi.aiRecommend({ query: textToSearch });
      setResults(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not fetch recommendations at this time.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header with Gradient Accent */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner">
              ✨
            </div>
            <div>
              <h2 className="font-display text-lg font-bold tracking-wide">AI Smart Room Recommender</h2>
              <p className="text-xs text-white/80">Real-time schedule collision checks & intelligent capacity matching</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Natural Language Search Bar */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Describe what you need in plain English:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. 'Seminar hall for 120 students in B-Block tomorrow afternoon'"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
              <button
                type="button"
                onClick={() => handleSearch()}
                disabled={loading || !prompt.trim()}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all shadow-md hover:shadow-indigo-500/25 disabled:opacity-50 flex items-center gap-2 shrink-0 cursor-pointer"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Thinking...
                  </>
                ) : (
                  <>
                    <span>Recommend</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Suggestions Chips */}
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-2">Quick Prompt Ideas:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(qp);
                    handleSearch(qp);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer text-left"
                >
                  ⚡ {qp}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Recommendation Results */}
          {results && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                <span>
                  Found <strong className="text-slate-800 dark:text-slate-200">{results.totalAvailable} verified available rooms</strong> with 0 conflicts.
                </span>
                <span>Sorted by AI Fit Score</span>
              </div>

              {results.recommendations.length === 0 && (!results.alternativeSuggestions || results.alternativeSuggestions.length === 0) ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No rooms fully matched your exact criteria for this time window. Try expanding your capacity or choosing a different slot.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Primary Recommendations */}
                  {results.recommendations.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <span>🎯 Recommended Matches</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {results.recommendations.map((rec) => {
                          const isHighMatch = rec.matchScore >= 80;
                          return (
                            <div
                              key={rec.resourceId}
                              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/50 bg-white dark:bg-slate-800/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                      {rec.resourceName}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {rec.resourceType} • Block {rec.block} (Floor {rec.floor})
                                    </p>
                                  </div>
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                                    isHighMatch 
                                      ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800' 
                                      : 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800'
                                  }`}>
                                    {rec.matchScore}% Match
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                    👥 {rec.capacity} Seats
                                  </span>
                                  {rec.tags.map((tag, tIdx) => (
                                    <span key={tIdx} className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                                      {tag}
                                    </span>
                                  ))}
                                </div>

                                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 mb-4">
                                  {rec.reasons.map((r, rIdx) => (
                                    <li key={rIdx} className="flex items-center gap-1.5">
                                      <span className={r.includes('Under required') ? 'text-amber-500' : 'text-emerald-500'}>
                                        {r.includes('Under required') ? '⚠' : '✓'}
                                      </span>
                                      <span>{r}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (onSelectRoom) {
                                    onSelectRoom(rec);
                                  }
                                  onClose();
                                }}
                                className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <span>Select & Book Room</span>
                                <span>→</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Alternative Suggestions for Capacity (Labs, Seminar Halls, Auditoriums) */}
                  {results.alternativeSuggestions && results.alternativeSuggestions.length > 0 && (
                    <div className="pt-3 border-t border-dashed border-slate-200 dark:border-slate-800">
                      <div className="p-3 mb-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                        <span className="text-base">💡</span>
                        <span className="font-medium">
                          {results.alternativeMessage || "There are also other halls/labs that meet this capacity:"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {results.alternativeSuggestions.map((rec) => (
                          <div
                            key={rec.resourceId}
                            className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/40 hover:border-amber-400 bg-amber-50/20 dark:bg-slate-800/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <h3 className="font-semibold text-slate-900 dark:text-white text-base group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                    {rec.resourceName}
                                  </h3>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    <strong className="text-amber-700 dark:text-amber-400">{rec.resourceType}</strong> • Block {rec.block} (Floor {rec.floor})
                                  </p>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0">
                                  {rec.matchScore}% Fit
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-1.5 mb-3">
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300">
                                  👥 {rec.capacity} Seats (Fits 200+)
                                </span>
                                {rec.tags.map((tag, tIdx) => (
                                  <span key={tIdx} className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                    {tag}
                                  </span>
                                ))}
                              </div>

                              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 mb-4">
                                {rec.reasons.map((r, rIdx) => (
                                  <li key={rIdx} className="flex items-center gap-1.5">
                                    <span className="text-emerald-500">✓</span>
                                    <span>{r}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectRoom) {
                                  onSelectRoom(rec);
                                }
                                onClose();
                              }}
                              className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>Select & Book Alternative</span>
                              <span>→</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex justify-between items-center shrink-0">
          <span>Powered by CRMS Real-time Conflict Engine</span>
          <button onClick={onClose} className="hover:underline cursor-pointer">Close</button>
        </div>

      </div>
    </div>
  );
}
