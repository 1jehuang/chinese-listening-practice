import { h, Fragment, render as preactRender } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function StudyRow({ char, pinyin, meaning, marking, audioButtonHtml, onMark }) {
  return (
    <div className="study-list-row flex items-center gap-2 px-2 py-1 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 transition">
      <div className="md:col-span-2 font-semibold text-gray-900 truncate min-w-[2rem] text-center text-lg">{char}</div>
      <div className="md:col-span-3 text-sm text-gray-600 truncate min-w-0 max-w-[120px]">{pinyin}</div>
      <div className="md:col-span-6 text-xs text-gray-500 truncate flex-1 min-w-0">{meaning}</div>
      <div className="md:col-span-1 shrink-0 flex items-center gap-1 justify-end">
        {audioButtonHtml ? <span dangerouslySetInnerHTML={{ __html: audioButtonHtml }} /> : null}
        <button
          type="button"
          className={`text-sm px-1.5 py-0.5 rounded border transition ${
            marking === 'learned' ? 'border-emerald-400 text-emerald-600 bg-emerald-50' :
            marking === 'needs-work' ? 'border-amber-400 text-amber-600 bg-amber-50' :
            'border-gray-200 text-gray-400 hover:border-gray-400'
          }`}
          onClick={() => onMark(char)}
        >
          {marking === 'learned' ? '✓' : marking === 'needs-work' ? '⚠' : '○'}
        </button>
      </div>
    </div>
  );
}

function StudyModeView({
  title,
  subtitle,
  filteredCount,
  totalCount,
  items,
  onMark,
  emptyMessage,
  searchValue,
  onSearchChange,
  filterValue,
  onFilterChange,
  sortValue,
  onSortChange,
  onShuffle,
  onReset
}) {
  return (
    <div className="study-mode-shell h-full flex flex-col gap-4 overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between px-4 lg:px-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">{title || 'Study Mode Reference'}</h2>
          <p className="text-sm text-gray-600">{subtitle || "Quick list of this lesson's vocab. Use search or sorting as needed."}</p>
        </div>
        <div id="studyStatsFiltered" className="text-sm text-gray-500">Showing {filteredCount || 0} / {totalCount || 0} terms</div>
      </div>
      <div className="study-body grid grid-cols-1 gap-4 px-4 lg:px-6 flex-1 min-h-0 overflow-y-auto">
        <div className="study-list-card flex flex-col gap-3 min-h-0">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="relative flex-1 w-full">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base pointer-events-none">⌕</span>
              <input
                id="studySearchInput"
                type="search"
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition bg-white shadow-sm text-gray-800"
                placeholder="Search character, pinyin, or meaning"
                autocomplete="off"
                value={searchValue || ''}
                onInput={(e) => onSearchChange?.(e.currentTarget.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3 items-center text-sm md:justify-end">
              <label htmlFor="studyFilterSelect" className="font-semibold text-gray-600">Filter:</label>
              <select
                id="studyFilterSelect"
                className="px-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:outline-none text-sm font-semibold text-gray-700 bg-white"
                value={filterValue || 'all'}
                onChange={(e) => onFilterChange?.(e.currentTarget.value)}
              >
                <option value="all">All words</option>
                <option value="needs-work">⚠ Needs work</option>
                <option value="learned">✓ Learned</option>
              </select>
              <label htmlFor="studySortSelect" className="font-semibold text-gray-600">Sort:</label>
              <select
                id="studySortSelect"
                className="px-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:outline-none text-sm font-semibold text-gray-700 bg-white"
                value={sortValue || 'original'}
                onChange={(e) => onSortChange?.(e.currentTarget.value)}
              >
                <option value="original">Original order</option>
                <option value="char">Character (A-Z)</option>
                <option value="pinyin">Pinyin (A-Z)</option>
                <option value="meaning">Meaning (A-Z)</option>
              </select>
              <button id="studyShuffleBtn" type="button" className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:border-blue-500 hover:text-blue-600 transition bg-white" onClick={onShuffle}>Shuffle</button>
              <button id="studyResetBtn" type="button" className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:border-blue-500 transition bg-white" onClick={onReset}>Reset</button>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm flex-1 min-h-0 flex flex-col">
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase bg-gray-50 rounded-t-2xl">
              <span className="md:col-span-2">Character</span>
              <span className="md:col-span-3">Pinyin</span>
              <span className="md:col-span-6">Meaning</span>
              <span className="md:col-span-1 text-right">Audio</span>
            </div>
            <div id="studyList" className="study-list flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100">
              {items && items.length > 0 ? (
                items.map((item) => (
                  <StudyRow
                    key={item.char}
                    char={item.char}
                    pinyin={item.pinyin}
                    meaning={item.meaning}
                    marking={item.marking}
                    audioButtonHtml={item.audioButtonHtml}
                    onMark={onMark}
                  />
                ))
              ) : (
                <div className="text-xs text-gray-500 py-4 text-center">{emptyMessage || 'No items to study'}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function render(container, props) {
  if (!container) return;
  preactRender(<StudyModeView {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeQuizStudyUI = {
  render,
  unmount
};
