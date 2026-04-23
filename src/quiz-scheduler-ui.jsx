import { h, Fragment, render as preactRender } from 'preact';

function SchedulerButton({ id, label, active, onClick }) {
  const classes = [
    'px-1.5', 'py-0.5', 'rounded', 'border', 'text-[10px]', 'font-medium',
    'transition'
  ];
  if (active) {
    classes.push('border-blue-500', 'text-blue-600', 'bg-blue-50');
  } else {
    classes.push('border-gray-200', 'text-gray-600', 'hover:border-blue-400', 'hover:text-blue-600');
  }

  return (
    <button
      type="button"
      id={id}
      className={classes.join(' ')}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function StatusLine({ id, className, html }) {
  if (!html) return null;
  return (
    <div
      id={id}
      className={className || 'hidden'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function SchedulerToolbarView({
  modeLabel,
  modeDescription,
  batchStatus,
  adaptiveStatus,
  composerStatus,
  feedStatus,
  buttons,
  activeMode
}) {
  return (
    <div id="schedulerToolbar" className="mb-2 flex flex-col items-center gap-1">
      {modeLabel ? (
        <div id="schedulerModeLabel" dangerouslySetInnerHTML={{ __html: modeLabel }} />
      ) : null}
      {modeDescription ? (
        <div id="schedulerModeDescription" dangerouslySetInnerHTML={{ __html: modeDescription }} />
      ) : null}
      <StatusLine id="batchModeStatus" html={batchStatus} />
      <StatusLine id="adaptiveModeStatus" html={adaptiveStatus} />
      <StatusLine id="composerModeStatus" html={composerStatus} />
      <StatusLine id="feedModeStatus" html={feedStatus} />
      <div className="flex flex-wrap gap-1 justify-center items-center max-w-full px-1">
        {(buttons || []).map((btn) => (
          <SchedulerButton
            key={btn.id}
            id={btn.id}
            label={btn.label}
            active={btn.id === activeMode}
            onClick={btn.onClick}
          />
        ))}
      </div>
    </div>
  );
}

function render(container, props) {
  if (!container) return;
  preactRender(<SchedulerToolbarView {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeQuizSchedulerUI = {
  render,
  unmount
};
