import { h, Fragment, render as preactRender } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

function Toast({ message, visible, type }) {
  if (!visible) return null;
  const classes = ['quiz-toast'];
  if (type === 'correct') classes.push('quiz-toast-correct');
  if (type === 'incorrect') classes.push('quiz-toast-incorrect');
  if (type === 'info') classes.push('quiz-toast-info');

  return (
    <div className={classes.join(' ')}>{message}</div>
  );
}

function FeedbackPanel({ type, message, detail, onContinue, showContinue }) {
  if (!type) return null;
  const classes = ['quiz-feedback-panel'];
  if (type === 'correct') classes.push('feedback-correct');
  if (type === 'incorrect') classes.push('feedback-incorrect');

  return (
    <div className={classes.join(' ')}>
      <div className="feedback-message">{message}</div>
      {detail ? <div className="feedback-detail">{detail}</div> : null}
      {showContinue ? (
        <button type="button" className="feedback-continue-btn" onClick={onContinue}>
          Continue
        </button>
      ) : null}
    </div>
  );
}

function HintPanel({ char, pinyin, meaning, perCharHtml }) {
  return (
    <div id="hint" className="hint-panel">
      <div className="text-sm text-gray-500 mt-2">
        <strong>Chinese:</strong> {char} ({pinyin})<br />
        <strong>Reference:</strong> {meaning}
      </div>
      {perCharHtml ? <div dangerouslySetInnerHTML={{ __html: perCharHtml }} /> : null}
    </div>
  );
}

function TimerDisplay({ timeStr, colorClass }) {
  return (
    <div className="timer-display">
      <span className={colorClass || ''}>⏱ {timeStr}</span>
    </div>
  );
}

function GradeBanner({ letterGrade, gradeColor, bgColor, borderColor, pct, summaryHtml }) {
  return (
    <div
      id="quizGradeBanner"
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '999px',
        padding: '4px 10px',
        margin: '6px auto 0',
        maxWidth: 'fit-content',
        fontSize: '0.75rem',
        lineHeight: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      <span style={{ color: gradeColor, fontWeight: 700, fontSize: '1rem' }}>{letterGrade}</span>
      <span style={{ color: gradeColor, fontWeight: 600 }}>{pct}%</span>
      {summaryHtml ? <span dangerouslySetInnerHTML={{ __html: summaryHtml }} /> : null}
    </div>
  );
}

function QuizFeedbackView({
  toast,
  feedback,
  hint,
  timer,
  gradeBanner,
  onContinue
}) {
  return (
    <Fragment>
      {toast ? <Toast {...toast} /> : null}
      {feedback ? <FeedbackPanel {...feedback} onContinue={onContinue} /> : null}
      {hint ? <HintPanel {...hint} /> : null}
      {timer ? <TimerDisplay {...timer} /> : null}
      {gradeBanner ? <GradeBanner {...gradeBanner} /> : null}
    </Fragment>
  );
}

function render(container, props) {
  if (!container) return;
  preactRender(<QuizFeedbackView {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeQuizFeedbackUI = {
  render,
  unmount
};
