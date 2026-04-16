import { h, render as preactRender } from 'preact';

function ConfidenceRow({ row, onSelectRow, onTogglePractice }) {
  const rowClassName = row.isCurrent
    ? 'border-blue-200 bg-blue-50 shadow-sm'
    : 'border-transparent hover:border-gray-200 hover:bg-gray-50';
  const practiceButtonClassName = row.practiceActive
    ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200'
    : row.marking === 'learned'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
      : 'bg-white border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600';
  const practiceTitle = row.practiceActive
    ? 'Remove from practice list'
    : 'Mark for practice';

  return (
    <div
      className={`confidence-row flex items-center gap-2 px-2 py-1 rounded-lg border transition ${rowClassName}`}
      data-confidence-char={row.charKey}
      data-confidence-current={row.isCurrent ? 'true' : 'false'}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
        onClick={() => onSelectRow?.(row.charKey)}
        title={row.selectTitle}
      >
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <span className={`${row.charClass} font-semibold text-gray-900 truncate`} title={row.charTitle}>
            {row.charDisplay}
          </span>
          <div className="min-w-0 shrink-0">
            {row.pinyinDisplay ? (
              <div className="text-xs text-gray-600 truncate max-w-[60px]">{row.pinyinDisplay}</div>
            ) : null}
            <div className="text-[11px] text-gray-500 whitespace-nowrap">{row.metaLabel}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-10 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full ${row.barClass}`} style={{ width: `${row.barPercent}%` }} />
          </div>
          <span className="text-[10px] font-semibold text-gray-700">
            {row.scoreDisplay}
            {row.showMasteredBadge ? (
              <span className="ml-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">✓</span>
            ) : null}
          </span>
        </div>
      </button>
      <button
        type="button"
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-semibold transition shrink-0 ${practiceButtonClassName}`}
        onClick={(event) => {
          event.stopPropagation();
          onTogglePractice?.(row.charKey);
        }}
        title={practiceTitle}
        aria-label={practiceTitle}
      >
        {row.practiceActive ? '⚑' : (row.marking === 'learned' ? '✓' : '＋')}
      </button>
    </div>
  );
}

function ConfidenceSection({ section, onSelectRow, onTogglePractice }) {
  return (
    <div className="mb-4">
      {section.title ? (
        <div className={`text-xs font-semibold uppercase tracking-wide ${section.colorClass} mb-2 px-2`}>
          {section.title}
        </div>
      ) : null}
      {section.rows.map((row) => (
        <ConfidenceRow
          key={row.key}
          row={row}
          onSelectRow={onSelectRow}
          onTogglePractice={onTogglePractice}
        />
      ))}
    </div>
  );
}

function ConfidencePanelView({ summary, goalReached, goalLabel, sections, emptyMessage, onSelectRow, onTogglePractice }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-gray-400">Confidence</div>
          <div className="text-sm font-semibold text-gray-900">Least → Most sure</div>
          {goalReached ? (
            <div className="inline-flex items-center gap-1 mt-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {goalLabel}
            </div>
          ) : null}
        </div>
      </div>

      <div id="confidenceSummary" className="text-xs text-gray-500 mb-2">{summary || ''}</div>

      <div id="confidenceList" className="space-y-1 flex-1 overflow-y-auto pr-1">
        {sections.length ? (
          sections.map((section) => (
            <ConfidenceSection
              key={section.key}
              section={section}
              onSelectRow={onSelectRow}
              onTogglePractice={onTogglePractice}
            />
          ))
        ) : (
          <div className="text-xs text-gray-500">{emptyMessage}</div>
        )}
      </div>
    </div>
  );
}

function render(container, props) {
  if (!container) return;
  preactRender(<ConfidencePanelView {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeConfidencePanelUI = {
  render,
  unmount
};
