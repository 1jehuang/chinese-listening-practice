import { h, Fragment, render as preactRender } from 'preact';

function DifficultyButton({ option, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`sentence-mode-chip${selected ? ' is-selected' : ''}`}
      aria-pressed={selected ? 'true' : 'false'}
      onClick={() => onSelect(option.id)}
    >
      {option.label}
    </button>
  );
}

function SentenceModeView({
  title,
  subtitle,
  sentence,
  prompt,
  helperText,
  difficultyLabel,
  difficultyDescription,
  difficultyOptions,
  activeDifficulty,
  onSelectDifficulty
}) {
  return (
    <div className="sentence-mode-shell">
      <div className="sentence-mode-header">
        <div className="sentence-mode-kicker">{title}</div>
        {difficultyOptions.length > 1 ? (
          <Fragment>
            <div className="sentence-mode-toolbar-label">{difficultyLabel}</div>
            <div className="sentence-mode-toolbar">
              {difficultyOptions.map((option) => (
                <DifficultyButton
                  key={option.id}
                  option={option}
                  selected={option.id === activeDifficulty}
                  onSelect={onSelectDifficulty}
                />
              ))}
            </div>
            {difficultyDescription ? (
              <div className="sentence-mode-description">{difficultyDescription}</div>
            ) : null}
          </Fragment>
        ) : null}
      </div>
      <div className="sentence-mode-card sentence-mode-card--sentence">
        <div className="sentence-mode-subtitle">{subtitle}</div>
        <div className="sentence-mode-sentence">{sentence}</div>
      </div>
      <div className="sentence-mode-card sentence-mode-card--prompt">
        <div className="sentence-mode-prompt">👉 {prompt}</div>
        <div className="sentence-mode-helper">{helperText}</div>
      </div>
    </div>
  );
}

function render(container, props) {
  if (!container) return;
  preactRender(<SentenceModeView {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeSentenceModeUI = {
  render,
  unmount
};
