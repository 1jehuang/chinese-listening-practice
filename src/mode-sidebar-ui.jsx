import { h, render as preactRender } from 'preact';

function ModeButton({ item, active, onSelect }) {
  const classes = [item.className || 'mode-btn'];
  if (active) {
    classes.push('active', 'bg-blue-500', 'text-white', 'border-blue-500');
  } else if (!(item.className || '').includes('border-gray-300')) {
    classes.push('border-gray-300');
  }

  return (
    <button
      type="button"
      className={classes.join(' ')}
      data-mode={item.mode}
      onClick={() => onSelect(item.mode)}
    >
      {item.label}
    </button>
  );
}

function ModeSidebarView({ items, activeMode, onSelectMode }) {
  return items.map((item) => (
    <ModeButton
      key={item.mode}
      item={item}
      active={item.mode === activeMode}
      onSelect={onSelectMode}
    />
  ));
}

function render(container, props) {
  if (!container) return;
  preactRender(<ModeSidebarView {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeModeSidebarUI = {
  render,
  unmount
};
