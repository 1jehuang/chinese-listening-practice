import { h, render as preactRender } from 'preact';

function PaletteItem({ item, index, selected, onSelect, getTypeMeta, getActionLabel, getDefaultDescription }) {
  const typeMeta = getTypeMeta(item);
  const description = item.description || getDefaultDescription(item);
  return (
    <div
      className={`palette-item px-5 py-3.5 cursor-pointer transition-all duration-150 flex items-start gap-3 border-l-4 ${selected ? 'bg-blue-50 border-blue-500' : 'border-transparent hover:bg-gray-50 hover:border-gray-300'}`}
      data-index={String(index)}
      onClick={() => onSelect(item)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="font-semibold text-gray-900 text-base">{item.name}</div>
          <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded border ${typeMeta.className}`}>{typeMeta.text}</span>
          {item.scope ? (
            <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">{item.scope}</span>
          ) : null}
        </div>
        <div className="text-sm text-gray-600 leading-relaxed">{description}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {item.shortcut ? (
          <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-gray-600 bg-gray-100 border border-gray-300 rounded px-2 py-1 ml-2">{item.shortcut}</span>
        ) : null}
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{getActionLabel(item)}</span>
      </div>
    </div>
  );
}

function CommandPaletteView({ visible, query, searchPlaceholder, items, selectedIndex, onQueryChange, onKeyDown, onSelect, onBackdrop, getTypeMeta, getActionLabel, getDefaultDescription }) {
  return (
    <div
      id="commandPalette"
      className={`fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm ${visible ? 'flex' : 'hidden'} items-center justify-center z-50 transition-opacity duration-200`}
      style={{ display: visible ? 'flex' : 'none' }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onBackdrop();
        }
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <input
            type="text"
            id="paletteSearch"
            className="w-full px-4 py-3 text-lg bg-transparent border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all placeholder-gray-400"
            placeholder={searchPlaceholder}
            value={query}
            onInput={(event) => onQueryChange(event.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <div id="paletteResults" className="max-h-96 overflow-y-auto">
          {items.length ? (
            items.map((item, index) => (
              <PaletteItem
                key={`${item.type || 'action'}:${item.mode || item.url || item.name}`}
                item={item}
                index={index}
                selected={index === selectedIndex}
                onSelect={onSelect}
                getTypeMeta={getTypeMeta}
                getActionLabel={getActionLabel}
                getDefaultDescription={getDefaultDescription}
              />
            ))
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">No commands match “{query.trim()}”.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function render(container, props) {
  if (!container) return;
  preactRender(<CommandPaletteView {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeCommandPaletteUI = {
  render,
  unmount
};
