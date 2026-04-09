import { h, Fragment, render as preactRender } from 'preact';

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function CharLargeDisplay({ char, fontSize }) {
  return (
    <div className="text-center font-normal text-gray-800" style={{ fontSize: fontSize || '140px', margin: '32px 0' }}>
      {char}
    </div>
  );
}

function PinyinDisplay({ pinyin }) {
  return (
    <div style={{ textAlign: 'center', fontSize: '48px', margin: '40px 0' }}>
      {pinyin}
    </div>
  );
}

function MeaningDisplay({ meaning }) {
  return (
    <div style={{ textAlign: 'center', fontSize: '36px', margin: '40px 0' }}>
      {meaning}
    </div>
  );
}

function UsageHint({ hint }) {
  if (!hint?.sentenceHtml) return null;

  return (
    <div className="word-usage-hint">
      <div className="word-usage-hint-kicker">{hint.title || 'Tiny usage'}{hint.wordType ? ` · ${hint.wordType}` : ''}</div>
      <div className="word-usage-hint-example" dangerouslySetInnerHTML={{ __html: hint.sentenceHtml }} />
      {hint.meaning ? <div className="word-usage-hint-meaning">{hint.meaning}</div> : null}
      {hint.sourceLabel ? <div className="word-usage-hint-meta">{hint.sourceLabel}</div> : null}
    </div>
  );
}

function ColumnCard({ label, className, children }) {
  return (
    <div className={`column-card ${className || ''}`}>
      <div className="column-label">{label}</div>
      {children}
    </div>
  );
}

function ThreeColumnLayout({ previous, current, upcoming }) {
  return (
    <div className="three-column-meaning-layout">
      <ColumnCard label="Previous" className="column-previous">
        {previous ? previous : <div className="column-placeholder">Your last answer will appear here</div>}
      </ColumnCard>
      <ColumnCard label="Now" className="column-current">
        {current}
      </ColumnCard>
      <ColumnCard label="Upcoming" className="column-upcoming">
        {upcoming ? upcoming : <div className="column-placeholder">Next card</div>}
      </ColumnCard>
    </div>
  );
}

function MeaningQuestionLayout({ char, showComponentBreakdown, usageHint }) {
  return (
    <div className={`meaning-question-layout${showComponentBreakdown ? '' : ' components-hidden'}`}>
      <div className="component-panel component-panel-left" id="componentPanelLeft"></div>
      <div className="meaning-char-column">
        <UsageHint hint={usageHint} />
        <div className="answer-summary-card" id="answerSummaryCard">
          <div className="summary-card-header">
            <span className="summary-card-char" id="answerSummaryChar"></span>
            <span className="summary-card-pinyin" id="answerSummaryPinyin"></span>
          </div>
          <div className="summary-card-meaning" id="answerSummaryMeaning"></div>
          <div className="summary-card-characters text-xs text-gray-500 mt-1" id="answerSummaryCharacters"></div>
        </div>
        <div className="question-char-display">{char}</div>
        <div className="etymology-note-card hidden" id="etymologyNoteCard">
          <div className="etymology-title">Etymology note</div>
          <div className="etymology-header" id="etymologyNoteHeader"></div>
          <div className="etymology-body" id="etymologyNoteBody"></div>
        </div>
      </div>
      <div className="component-panel component-panel-right" id="componentPanelRight"></div>
    </div>
  );
}

function PreviousCard({ char, pinyin, meaning, resultClass, resultIcon, feedbackText, charDetails, dirLabel }) {
  return (
    <Fragment>
      <div className="column-feedback">
        <span className="column-result-icon">{resultIcon}</span>
        <span className="column-feedback-text">{feedbackText}</span>
      </div>
      <div className="column-char">{char}</div>
      <div className="column-pinyin">{pinyin}</div>
      <div className="column-meaning">{meaning}</div>
      {charDetails ? <div dangerouslySetInnerHTML={{ __html: charDetails }} /> : null}
      {dirLabel ? <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{dirLabel}</div> : null}
    </Fragment>
  );
}

function CurrentCard({ char, fontSize, markingBadge, inlineFeedback, mode, inlinePromptAudioHtml, promptHtml, dirLabel, usageHint }) {
  const isAudioMode = mode === 'audio-to-meaning' || mode === 'audio-to-pinyin';
  return (
    <Fragment>
      {markingBadge ? <div dangerouslySetInnerHTML={{ __html: markingBadge }} /> : null}
      <UsageHint hint={usageHint} />
      <div className="column-focus-ring">
        {promptHtml ? (
          <div dangerouslySetInnerHTML={{ __html: promptHtml }} />
        ) : isAudioMode ? (
          inlinePromptAudioHtml ? <div dangerouslySetInnerHTML={{ __html: inlinePromptAudioHtml }} /> : null
        ) : (
          <div className="column-char-large" style={{ fontSize }}>{char}</div>
        )}
      </div>
      {inlineFeedback ? (
        <div className={`column-inline-feedback ${inlineFeedback.type === 'incorrect' ? 'is-incorrect' : 'is-correct'}`}>
          {inlineFeedback.message}
        </div>
      ) : null}
    </Fragment>
  );
}

function UpcomingCard({ char, mode }) {
  const isBlendMode = mode === 'blend';
  return (
    <div className="column-ondeck">
      {isBlendMode ? (
        <div style={{ fontSize: '28px', color: '#d1d5db' }}>?</div>
      ) : mode === 'audio-to-meaning' || mode === 'audio-to-pinyin' ? (
        <div style={{ fontSize: '32px', color: '#d1d5db' }}>&#x1f50a;</div>
      ) : (
        <div className="column-char">{char}</div>
      )}
      <div className="ondeck-note">On deck</div>
    </div>
  );
}

function ThreeColumnMeaningLayout({
  previous,
  current,
  upcoming,
  inlineFeedback
}) {
  const prevResultClass = previous?.resultClass || '';
  const currentFeedbackClass = inlineFeedback
    ? (inlineFeedback.type === 'incorrect' ? 'has-error' : 'has-success')
    : '';
  const dirLabel = current?.dirLabel;
  const labelContent = dirLabel ? (
    <Fragment>Now · <span style={{ fontWeight: 600, color: '#6366f1' }}>{dirLabel}</span></Fragment>
  ) : 'Now';

  return (
    <div className="three-column-meaning-layout">
      <div className={`column-previous column-card ${prevResultClass}`}>
        <div className="column-label">Previous</div>
        {previous ? (
          <PreviousCard
            char={previous.char}
            pinyin={previous.pinyin}
            meaning={previous.meaning}
            resultIcon={previous.resultIcon}
            feedbackText={previous.feedbackText}
            charDetails={previous.charDetails}
            dirLabel={previous.dirLabel}
          />
        ) : (
          <div className="column-placeholder">Your last answer will appear here</div>
        )}
      </div>
      <div className={`column-current column-card ${currentFeedbackClass}`} style={{ position: 'relative' }}>
        <div className="column-label">{labelContent}</div>
        <CurrentCard
          char={current.char}
          fontSize={current.fontSize}
          markingBadge={current.markingBadge}
          inlineFeedback={inlineFeedback}
          mode={current.mode}
          inlinePromptAudioHtml={current.inlinePromptAudioHtml}
          promptHtml={current.promptHtml}
          dirLabel={current.dirLabel}
          usageHint={current.usageHint}
        />
      </div>
      <div className="column-upcoming column-card">
        <div className="column-label">Upcoming</div>
        {upcoming ? (
          <UpcomingCard char={upcoming.char} mode={upcoming.mode || current.mode} />
        ) : (
          <div className="column-placeholder">Next card is loading</div>
        )}
      </div>
    </div>
  );
}

function QuestionDisplayView({
  mode,
  char,
  pinyin,
  meaning,
  fontSize,
  layout,
  columns,
  markingBadge,
  inlineFeedback,
  inlinePromptAudioHtml,
  showComponentBreakdown,
  usageHint
}) {
  let content;

  if (layout === 'meaning-question') {
    content = <MeaningQuestionLayout char={char} showComponentBreakdown={showComponentBreakdown} usageHint={usageHint} />;
  } else if (layout === 'three-column') {
    content = (
      <ThreeColumnMeaningLayout
        previous={columns?.previous}
        current={columns?.current}
        upcoming={columns?.upcoming}
        inlineFeedback={inlineFeedback}
      />
    );
  } else if (mode === 'char-to-pinyin-mc') {
    content = <CharLargeDisplay char={char} fontSize={fontSize} />;
  } else if (mode === 'pinyin-to-char') {
    content = <PinyinDisplay pinyin={pinyin} />;
  } else if (mode === 'meaning-to-char' || mode === 'meaning-to-char-pinyin') {
    content = <MeaningDisplay meaning={meaning} />;
  } else if (mode === 'char-to-meaning' || mode === 'char-to-meaning-type') {
    content = (
      <Fragment>
        <UsageHint hint={usageHint} />
        {markingBadge ? <div dangerouslySetInnerHTML={{ __html: markingBadge }} /> : null}
        <CharLargeDisplay char={char} fontSize={fontSize} />
      </Fragment>
    );
  } else if (mode === 'audio-to-meaning') {
    content = (
      <Fragment>
        <UsageHint hint={usageHint} />
        {inlinePromptAudioHtml ? <div dangerouslySetInnerHTML={{ __html: inlinePromptAudioHtml }} /> : null}
      </Fragment>
    );
  } else {
    content = (
      <Fragment>
        <UsageHint hint={usageHint} />
        <CharLargeDisplay char={char} fontSize={fontSize} />
      </Fragment>
    );
  }

  return (
    <div id="questionDisplay" className="quiz-display">
      {content}
      {layout !== 'meaning-question' && layout !== 'three-column' && inlineFeedback ? (
        <div className={`column-inline-feedback ${inlineFeedback.type === 'incorrect' ? 'is-incorrect' : 'is-correct'}`}>
          {inlineFeedback.message}
        </div>
      ) : null}
    </div>
  );
}

function render(container, props) {
  if (!container) return;
  preactRender(<QuestionDisplayView {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeQuizQuestionUI = {
  render,
  unmount
};
