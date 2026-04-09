import { h, render as preactRender } from 'preact';

function Pill({ children, muted = false }) {
  return <span className={`tutorial-mode-pill${muted ? ' is-muted' : ''}`}>{children}</span>;
}

function SectionCard({ step, title, accent, children, compact = false }) {
  const classes = ['tutorial-mode-card'];
  if (accent) classes.push(`is-${accent}`);
  if (compact) classes.push('is-compact');

  return (
    <section className={classes.join(' ')}>
      <div className="tutorial-mode-card-head">
        {step ? <div className="tutorial-mode-step">{step}</div> : null}
        <div className="tutorial-mode-card-title">{title}</div>
      </div>
      {children}
    </section>
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

function HeroSection({ char, pinyin, meaning, wordType, extraMeanings }) {
  return (
    <section className="tutorial-mode-hero">
      <div className="tutorial-mode-char">{char}</div>
      {pinyin ? <div className="tutorial-mode-pinyin">{pinyin}</div> : null}
      {meaning ? <div className="tutorial-mode-meaning">{meaning}</div> : null}
      <div className="tutorial-mode-pill-row">
        {wordType?.shortLabel ? <Pill>{wordType.shortLabel}</Pill> : null}
        {wordType?.sourceLabel ? <Pill muted>{wordType.sourceLabel}</Pill> : null}
      </div>
      {extraMeanings?.length ? (
        <div className="tutorial-mode-alt-meanings">
          Also: {extraMeanings.join(' · ')}
        </div>
      ) : null}
    </section>
  );
}

function TinySentenceCard({ example }) {
  if (!example) return null;

  return (
    <SectionCard step="1" title="Tiny sentence" accent="primary">
      <div
        className="tutorial-mode-example-sentence"
        dangerouslySetInnerHTML={{ __html: example.highlightedSentenceHtml || example.sentence || '' }}
      />
      {example.meaning ? <div className="tutorial-mode-example-meaning">{example.meaning}</div> : null}
    </SectionCard>
  );
}

function UsageCard({ structure, wordType }) {
  if (!structure && !wordType) return null;

  return (
    <SectionCard step="2" title="Use it like this" compact>
      {wordType?.shortLabel ? (
        <div className="tutorial-mode-inline-meta">
          Think of it as a <strong>{wordType.shortLabel.toLowerCase()}</strong>
          {wordType.sourceLabel ? ` · ${wordType.sourceLabel}` : ''}
        </div>
      ) : null}
      {structure?.filled ? <div className="tutorial-mode-pattern-line tutorial-mode-pattern-line-filled">{structure.filled}</div> : null}
      {structure?.template ? <div className="tutorial-mode-pattern-line">Frame: {structure.template}</div> : null}
      {structure?.note ? <div className="tutorial-mode-card-note">{structure.note}</div> : null}
    </SectionCard>
  );
}

function RememberCard({ perCharLines }) {
  if (!perCharLines?.length) return null;
  const previewLines = perCharLines.slice(0, 2);
  const hiddenCount = perCharLines.length - previewLines.length;

  return (
    <SectionCard step="3" title="Remember it" compact>
      <div className="tutorial-mode-line-list">
        {previewLines.map((line, index) => (
          <div key={`${line}-${index}`} className="tutorial-mode-line-item">{line}</div>
        ))}
      </div>
      {hiddenCount > 0 ? <div className="tutorial-mode-card-note">+{hiddenCount} more clue{hiddenCount === 1 ? '' : 's'}</div> : null}
    </SectionCard>
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
  structure,
  sentenceExamples,
  perCharLines,
  feedback,
  locked,
  onNeedsWork,
  onGotIt
}) {
  const primaryExample = sentenceExamples?.[0] || null;
  const extraMeanings = (meaningAnchors || []).filter((item) => item && item !== meaning).slice(0, 2);

  return (
    <div className="tutorial-mode-shell">
      <div className="tutorial-mode-header">
        <div className="tutorial-mode-kicker">{title || 'Tutorial Mode'}</div>
        <div className="tutorial-mode-subtitle">{subtitle || 'See one tiny sentence, understand the role, then rate it fast.'}</div>
      </div>

      <HeroSection
        char={char}
        pinyin={pinyin}
        meaning={meaning}
        wordType={wordType}
        extraMeanings={extraMeanings}
      />

      <TinySentenceCard example={primaryExample} />

      <div className="tutorial-mode-grid tutorial-mode-grid-secondary">
        <UsageCard structure={structure} wordType={wordType} />
        <RememberCard perCharLines={perCharLines} />
      </div>

      <FeedbackBanner feedback={feedback} />

      <div className="tutorial-mode-actions">
        <ActionButton label="Again" disabled={locked} onClick={onNeedsWork} />
        <ActionButton label="Got it" primary disabled={locked} onClick={onGotIt} />
      </div>
    </div>
  );
}

function render(container, props) {
  if (!container) return;
  preactRender(null, container);
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
