import { h, Fragment, render as preactRender } from 'preact';

function MeaningChip({ text }) {
  if (!text) return null;
  return <span className="tutorial-mode-chip">{text}</span>;
}

function WordTypeRow({ wordType }) {
  if (!wordType?.shortLabel) return null;

  return (
    <div className="tutorial-mode-word-type-row">
      <span className="tutorial-mode-word-type-label">Word type</span>
      <span className="tutorial-mode-word-type-value">{wordType.shortLabel}</span>
      {wordType.sourceLabel ? <span className="tutorial-mode-word-type-source">{wordType.sourceLabel}</span> : null}
    </div>
  );
}

function FeedbackBanner({ feedback }) {
  if (!feedback) return null;
  const classes = ['tutorial-mode-feedback'];
  classes.push(feedback.type === 'correct' ? 'is-correct' : 'is-incorrect');

  return (
    <div className={classes.join(' ')}>
      <div className="tutorial-mode-feedback-title">{feedback.title}</div>
      <div className="tutorial-mode-feedback-message">{feedback.message}</div>
    </div>
  );
}

function StructureCard({ structure, usageHint }) {
  if (!structure && !usageHint) return null;

  return (
    <section className="tutorial-mode-card">
      <div className="tutorial-mode-card-kicker">Sentence slot</div>
      {usageHint?.shortLabel ? (
        <div className="tutorial-mode-card-subtitle">
          {usageHint.shortLabel}
          {usageHint.sourceLabel ? ` · ${usageHint.sourceLabel}` : ''}
        </div>
      ) : null}
      {structure?.template ? (
        <Fragment>
          <div className="tutorial-mode-pattern-label">Pattern</div>
          <div className="tutorial-mode-pattern-line">{structure.template}</div>
        </Fragment>
      ) : null}
      {structure?.filled ? (
        <Fragment>
          <div className="tutorial-mode-pattern-label">With this word</div>
          <div className="tutorial-mode-pattern-line tutorial-mode-pattern-line-filled">{structure.filled}</div>
        </Fragment>
      ) : null}
      {structure?.note ? <div className="tutorial-mode-card-note">{structure.note}</div> : null}
    </section>
  );
}

function SentenceExampleCard({ sentenceExamples }) {
  if (!sentenceExamples?.length) return null;

  return (
    <section className="tutorial-mode-card">
      <div className="tutorial-mode-card-kicker">Tiny example</div>
      <div className="tutorial-mode-example-list">
        {sentenceExamples.map((example, index) => (
          <div key={`${example.sentence}-${index}`} className="tutorial-mode-example-item">
            <div
              className="tutorial-mode-example-sentence"
              dangerouslySetInnerHTML={{ __html: example.highlightedSentenceHtml || example.sentence || '' }}
            />
            {example.meaning ? <div className="tutorial-mode-example-meaning">{example.meaning}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function CharacterClueCard({ perCharLines }) {
  if (!perCharLines?.length) return null;

  return (
    <section className="tutorial-mode-card">
      <div className="tutorial-mode-card-kicker">Character clues</div>
      <div className="tutorial-mode-line-list">
        {perCharLines.map((line, index) => (
          <div key={`${line}-${index}`} className="tutorial-mode-line-item">{line}</div>
        ))}
      </div>
    </section>
  );
}

function ActionButton({ label, primary, disabled, onClick }) {
  const classes = ['tutorial-mode-action'];
  classes.push(primary ? 'is-primary' : 'is-secondary');
  if (disabled) classes.push('is-disabled');

  return (
    <button type="button" className={classes.join(' ')} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

function TutorialModeView({
  title,
  subtitle,
  char,
  pinyin,
  meaning,
  meaningAnchors,
  wordType,
  usageHint,
  structure,
  sentenceExamples,
  perCharLines,
  feedback,
  locked,
  onNeedsWork,
  onGotIt
}) {
  return (
    <div className="tutorial-mode-shell">
      <div className="tutorial-mode-header">
        <div className="tutorial-mode-kicker">{title || 'Tutorial Mode'}</div>
        <div className="tutorial-mode-subtitle">{subtitle || 'Learn the word first, then rate how well it feels.'}</div>
      </div>

      <section className="tutorial-mode-hero">
        <div className="tutorial-mode-char">{char}</div>
        {pinyin ? <div className="tutorial-mode-pinyin">{pinyin}</div> : null}
        {meaning ? <div className="tutorial-mode-meaning">{meaning}</div> : null}
        <WordTypeRow wordType={wordType} />
        {meaningAnchors?.length ? (
          <div className="tutorial-mode-chip-row">
            {meaningAnchors.map((item, index) => <MeaningChip key={`${item}-${index}`} text={item} />)}
          </div>
        ) : null}
      </section>

      <div className="tutorial-mode-grid">
        <StructureCard structure={structure} usageHint={structure ? (wordType || usageHint) : null} />
        <SentenceExampleCard sentenceExamples={sentenceExamples} />
        <CharacterClueCard perCharLines={perCharLines} />
      </div>

      <FeedbackBanner feedback={feedback} />

      <div className="tutorial-mode-actions">
        <ActionButton label="Needs work" disabled={locked} onClick={onNeedsWork} />
        <ActionButton label="Got it" primary disabled={locked} onClick={onGotIt} />
      </div>
    </div>
  );
}

function render(container, props) {
  if (!container) return;
  container.innerHTML = '';
  preactRender(<TutorialModeView {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeTutorialModeUI = {
  render,
  unmount
};
