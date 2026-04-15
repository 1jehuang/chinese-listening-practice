import { h, Fragment, render as preactRender } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

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

function AnswerOption({ option, onSelect }) {
  const classes = ['sentence-mode-option'];
  if (option.highlighted) classes.push('is-highlighted');
  if (option.correct) classes.push('is-correct');
  if (option.incorrect) classes.push('is-incorrect');

  return (
    <button
      type="button"
      className={classes.join(' ')}
      disabled={option.disabled}
      aria-pressed={option.selected ? 'true' : 'false'}
      onClick={() => onSelect(option.value)}
    >
      {option.value}
    </button>
  );
}

function FeedbackBanner({ feedback, locked, onContinue }) {
  if (!feedback) return null;
  return (
    <div className={`sentence-mode-feedback is-${feedback.type}`}>
      <div className="sentence-mode-feedback-title">{feedback.title}</div>
      <div className="sentence-mode-feedback-message">{feedback.message}</div>
      {feedback.detail ? <div className="sentence-mode-feedback-detail">{feedback.detail}</div> : null}
      {locked && feedback.type === 'correct' ? (
        <button type="button" className="sentence-mode-continue" onClick={onContinue}>
          Continue
        </button>
      ) : null}
    </div>
  );
}

function SentenceModeView({
  title,
  subtitle,
  sentence,
  sentenceHtml,
  prompt,
  helperText,
  difficultyLabel,
  difficultyDescription,
  difficultyOptions,
  activeDifficulty,
  inputValue,
  options,
  feedback,
  locked,
  onSelectDifficulty,
  onInputChange,
  onSubmit,
  onSelectOption,
  onContinue,
  onReplay
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!locked && inputRef.current) {
      const input = inputRef.current;
      const scrollContainer = input.closest('.quiz-display');
      try {
        input.focus({ preventScroll: true });
      } catch (error) {
        input.focus();
      }
      const value = input.value || '';
      if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(value.length, value.length);
      }
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    }
  }, [sentence, locked, inputValue]);

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
        <div className="sentence-mode-sentence-header">
          <div className="sentence-mode-subtitle">{subtitle}</div>
          <button
            type="button"
            className="sentence-mode-replay"
            onClick={onReplay}
          >
            🔊 Replay <span className="sentence-mode-replay-shortcut">Space</span>
          </button>
        </div>
        <div
          className="sentence-mode-sentence"
          dangerouslySetInnerHTML={{ __html: sentenceHtml || sentence || '' }}
        />
      </div>

      <div className="sentence-mode-card sentence-mode-card--prompt">
        <div className="sentence-mode-prompt">👉 {prompt}</div>
        <div className="sentence-mode-helper">{helperText}</div>
      </div>

      <div className="sentence-mode-card sentence-mode-answer-panel">
        <div className="sentence-mode-answer-label">Answer choices</div>
        <div className="sentence-mode-filter-row">
          <input
            ref={inputRef}
            type="text"
            className="sentence-mode-filter-input"
            value={inputValue}
            disabled={locked}
            placeholder="Type to filter sentence meanings..."
            onInput={(event) => onInputChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSubmit();
              } else if (event.key === ' ' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                event.preventDefault();
                onReplay();
              }
            }}
          />
        </div>
        <div className="sentence-mode-option-list">
          {options.map((option) => (
            <AnswerOption key={option.value} option={option} onSelect={onSelectOption} />
          ))}
        </div>
        <FeedbackBanner feedback={feedback} locked={locked} onContinue={onContinue} />
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
