import { h, render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  cancelSpeech,
  isReplayShortcut,
  loadDataset,
  normalizeShortcut,
  playFeedbackSound,
  shortcutLabel,
  speakSentence
} from './drill-shared.js';

const DEFAULT_CONFIG = {
  dataUrl: 'data/context-sentence.json',
  replayShortcut: { code: 'KeyA', shift: true, ctrl: false, alt: false, label: '⇧+A' },
  datasetKey: null
};

function App({ config, prompts, currentIndex, completed, answer, meaningVisible, feedback, onAnswerChange, onCheck, onToggleMeaning, onPrev, onNext, onRandom, onReplay, replayEnabled }) {
  const inputRef = useRef(null);
  const item = prompts[currentIndex] || null;

  useEffect(() => {
    if (!completed && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, completed]);

  const keyboardHint = useMemo(() => {
    const parts = ['Keyboard: ← previous', '→ next', 'Space reveal meaning', 'Ctrl+Enter submit'];
    if (config.replayShortcut?.label) {
      parts.push(`${config.replayShortcut.label} replay audio`);
    }
    parts.push('Tap Shift replay audio');
    return parts.join(' • ');
  }, [config.replayShortcut]);

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-8">
      <a href="home.html" className="fixed top-4 left-4 bg-white hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg shadow border border-gray-200 transition text-sm">← Home</a>

      <div className="max-w-4xl mx-auto mt-16 md:mt-0 bg-white rounded-xl shadow-lg p-6 md:p-8">
        <h1 className="text-3xl font-bold text-center mb-3 text-gray-800">Sentence Meaning Drill</h1>
        <p className="text-gray-600 text-center mb-6">
          Listen to the sentence, read along, then explain the whole sentence in English before revealing the suggested answer.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <span className="text-sm uppercase tracking-widest text-gray-400">
              {item ? `${currentIndex + 1} / ${prompts.length}` : 'Loading…'}
            </span>
            <button
              type="button"
              className={`bg-cyan-500 hover:bg-cyan-600 text-white px-5 py-2 rounded-lg transition${replayEnabled ? '' : ' opacity-60 cursor-not-allowed'}`}
              onClick={onReplay}
              disabled={!replayEnabled}
            >
              🔁 Replay audio
            </button>
          </div>

          {!replayEnabled ? (
            <div className="text-sm text-yellow-600 mb-4 text-center">
              Your browser does not support speech synthesis; rely on the on-screen sentence.
            </div>
          ) : null}

          <div className="text-2xl leading-relaxed text-center text-gray-900 mb-6">{item?.sentence || 'Loading prompts…'}</div>

          <div className="text-center text-lg text-gray-700 mb-6">
            👉 <span className="font-semibold text-gray-900">{item?.prompt || 'Explain the sentence meaning.'}</span>
          </div>

          <div className="space-y-3 mb-6">
            <label htmlFor="answerInput" className="block text-sm font-medium text-gray-600">
              Type your full-sentence interpretation (optional):
            </label>
            <textarea
              id="answerInput"
              ref={inputRef}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
              placeholder="Explain the sentence in English..."
              value={answer}
              disabled={!item || completed}
              onInput={(event) => onAnswerChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  onCheck();
                }
              }}
            />
            <button
              type="button"
              className="w-full bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition"
              onClick={onCheck}
              disabled={!item || completed}
            >
              Check answer
            </button>
          </div>

          <div className={`mt-4 text-center text-lg font-semibold ${feedback?.status === true ? 'text-green-600' : feedback?.status === false ? 'text-red-600' : 'text-gray-600'}`}>
            {feedback?.message || ''}
          </div>

          <div className="flex flex-col items-center gap-3 mt-6">
            <button
              type="button"
              className="w-full md:w-auto bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition"
              onClick={onToggleMeaning}
              aria-expanded={meaningVisible ? 'true' : 'false'}
            >
              {meaningVisible ? 'Hide suggested meaning' : 'Show suggested meaning'}
            </button>

            {meaningVisible ? (
              <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <div className="text-xs uppercase tracking-widest text-blue-500 mb-1">Suggested meaning</div>
                <p className="text-lg text-blue-900 leading-relaxed">{item?.meaning || ''}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <button type="button" className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition" onClick={onPrev}>Previous</button>
          <button type="button" className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition" onClick={onNext}>Next</button>
          <button type="button" className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition" onClick={onRandom}>Random</button>
        </div>

        <div className="text-center text-sm text-gray-500 mt-6">{keyboardHint}</div>
      </div>
    </div>
  );
}

function normalizeConfig(overrides) {
  const merged = { ...DEFAULT_CONFIG, ...overrides };
  merged.replayShortcut = normalizeShortcut(overrides.replayShortcut || DEFAULT_CONFIG.replayShortcut);
  merged.datasetKey = overrides.datasetKey || DEFAULT_CONFIG.datasetKey;
  return merged;
}

function SentenceDrillApp() {
  const [config] = useState(() => {
    const rawConfig = window.SENTENCE_DRILL_CONFIG || {};
    delete window.SENTENCE_DRILL_CONFIG;
    return normalizeConfig(rawConfig);
  });
  const [prompts, setPrompts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [answer, setAnswer] = useState('');
  const [meaningVisible, setMeaningVisible] = useState(false);
  const [feedback, setFeedback] = useState({ status: null, message: '' });
  const [replayEnabled, setReplayEnabled] = useState('speechSynthesis' in window || typeof window.playSentenceAudio === 'function');
  const audioStateRef = useRef({ context: null });
  const pendingShiftReplayRef = useRef(false);

  const currentItem = prompts[currentIndex] || null;

  useEffect(() => {
    if (typeof window.initCommandPalette === 'function') {
      window.initCommandPalette();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadDataset(config)
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data)) {
          throw new Error('Invalid prompt format (expected array).');
        }
        const nextPrompts = data.filter((item) => item && item.sentence && item.meaning);
        if (!nextPrompts.length) {
          throw new Error('No prompts found in data file.');
        }
        setPrompts(nextPrompts);
        setCurrentIndex(0);
      })
      .catch((error) => {
        console.error(error);
        const extra = window.location.protocol === 'file:'
          ? ' Tip: when opening these files directly from disk, the browser blocks loading JSON. Run a simple local server (e.g., python -m http.server) and open the page via http://localhost to unlock the dataset.'
          : '';
        setFeedback({ status: false, message: 'Failed to load prompt data.' + extra });
        setReplayEnabled(false);
      });

    return () => {
      cancelled = true;
      cancelSpeech();
    };
  }, [config]);

  useEffect(() => {
    if (!currentItem) return undefined;
    setCompleted(false);
    setAnswer('');
    setMeaningVisible(false);
    setFeedback({ status: null, message: '' });
    speakSentence(currentItem.sentence);
    return () => cancelSpeech();
  }, [currentItem?.sentence]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const targetTag = event.target && event.target.tagName;
      const isInputTarget = targetTag === 'INPUT' || targetTag === 'TEXTAREA';

      if (event.key === 'Shift') {
        pendingShiftReplayRef.current = true;
        return;
      }

      if (isReplayShortcut(event, config.replayShortcut)) {
        event.preventDefault();
        pendingShiftReplayRef.current = false;
        if (currentItem) speakSentence(currentItem.sentence);
        return;
      }

      if (pendingShiftReplayRef.current) {
        pendingShiftReplayRef.current = false;
      }

      if (isInputTarget) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setCurrentIndex((index) => (prompts.length ? (index + 1) % prompts.length : index));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setCurrentIndex((index) => (prompts.length ? (index - 1 + prompts.length) % prompts.length : index));
      } else if (event.key === ' ') {
        event.preventDefault();
        setMeaningVisible((value) => !value);
      }
    };

    const onKeyUp = (event) => {
      if (event.key === 'Shift') {
        if (pendingShiftReplayRef.current && currentItem) {
          speakSentence(currentItem.sentence);
        }
        pendingShiftReplayRef.current = false;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [config.replayShortcut, currentItem, prompts.length]);

  const checkAnswer = () => {
    if (completed || !currentItem) return;
    const input = answer.trim();
    if (!input) {
      setFeedback({ status: false, message: 'Type your interpretation before checking.' });
      playFeedbackSound(audioStateRef.current, 'error');
      return;
    }
    setFeedback({ status: true, message: 'Nice! Compare with the suggested meaning and move on.' });
    setMeaningVisible(true);
    setCompleted(true);
    playFeedbackSound(audioStateRef.current, 'success');
  };

  return (
    <App
      config={config}
      prompts={prompts}
      currentIndex={currentIndex}
      completed={completed}
      answer={answer}
      meaningVisible={meaningVisible}
      feedback={feedback}
      replayEnabled={replayEnabled}
      onAnswerChange={setAnswer}
      onCheck={checkAnswer}
      onToggleMeaning={() => setMeaningVisible((value) => !value)}
      onPrev={() => setCurrentIndex((index) => (prompts.length ? (index - 1 + prompts.length) % prompts.length : index))}
      onNext={() => setCurrentIndex((index) => (prompts.length ? (index + 1) % prompts.length : index))}
      onRandom={() => {
        if (prompts.length <= 1) return;
        let next = currentIndex;
        while (next === currentIndex) {
          next = Math.floor(Math.random() * prompts.length);
        }
        setCurrentIndex(next);
      }}
      onReplay={() => currentItem && speakSentence(currentItem.sentence)}
    />
  );
}

const root = document.getElementById('sentenceDrillApp');
if (root) {
  render(<SentenceDrillApp />, root);
}

window.shortcutLabel = window.shortcutLabel || shortcutLabel;
