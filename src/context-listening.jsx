import { h, render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  cancelSpeech,
  isReplayShortcut,
  loadDataset,
  normalizeShortcut,
  playFeedbackSound,
  shuffleArray,
  speakSentence
} from './drill-shared.js';

const DEFAULT_CONFIG = {
  dataUrl: 'data/context-listening.json',
  autoAdvanceDelay: 2200,
  replayShortcut: { code: 'KeyA', shift: true, ctrl: false, alt: false, label: '⇧+A' },
  datasetKey: null
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'get', 'in', 'into',
  'is', 'it', 'its', 'of', 'on', 'or', 'out', 'than', 'that', 'the', 'their', 'then',
  'there', 'this', 'to', 'up', 'was', 'were', 'with', 'your'
]);

function HighlightedSentence({ sentence, target }) {
  const index = sentence.indexOf(target);
  if (index === -1) {
    return sentence;
  }
  return [
    sentence.slice(0, index),
    <span className="bg-yellow-200 text-gray-900 px-1 rounded">{sentence.slice(index, index + target.length)}</span>,
    sentence.slice(index + target.length)
  ];
}

function ChoiceButton({ option, onSelect }) {
  const classes = ['w-full', 'text-left', 'px-4', 'py-3', 'border-2', 'rounded-lg', 'transition', 'text-gray-800'];
  if (option.correct && option.revealed) {
    classes.push('border-green-500', 'bg-green-50');
  } else if (option.incorrect) {
    classes.push('border-red-500', 'bg-red-50', 'opacity-70');
  } else if (option.revealed) {
    classes.push('opacity-70');
  } else {
    classes.push('border-gray-200', 'hover:border-blue-400', 'hover:bg-blue-50');
  }

  return (
    <button type="button" className={classes.join(' ')} disabled={option.disabled} onClick={() => onSelect(option.id)}>
      {option.text}
    </button>
  );
}

function App({ config, prompts, currentIndex, answer, meaningVisible, feedback, completed, options, onAnswerChange, onCheck, onChoiceSelect, onToggleMeaning, onPrev, onNext, onRandom, onReplay, replayEnabled }) {
  const inputRef = useRef(null);
  const item = prompts[currentIndex] || null;

  useEffect(() => {
    if (!completed && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, completed]);

  const keyboardHint = useMemo(() => {
    const parts = ['Keyboard: ← previous', '→ next', 'Space reveal meaning', 'Enter check'];
    if (config.replayShortcut?.label) {
      parts.push(`${config.replayShortcut.label} replay audio`);
    }
    if (config.autoAdvanceDelay <= 0) {
      parts.push('Correct answers auto-advance');
    }
    parts.push('Tap Shift replay audio');
    return parts.join(' • ');
  }, [config.autoAdvanceDelay, config.replayShortcut]);

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-8">
      <a href="home.html" className="fixed top-4 left-4 bg-white hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg shadow border border-gray-200 transition text-sm">← Home</a>

      <div className="max-w-4xl mx-auto mt-16 md:mt-0 bg-white rounded-xl shadow-lg p-6 md:p-8">
        <h1 className="text-3xl font-bold text-center mb-3 text-gray-800">{config.autoAdvanceDelay <= 0 ? 'Context Listening · Easy Mode' : 'Context Listening Comprehension'}</h1>
        <p className="text-gray-600 text-center mb-6">
          {config.autoAdvanceDelay <= 0
            ? 'Simpler sentences with instant advance: listen as each prompt plays, read along, and confirm the highlighted chunk’s meaning by typing or selecting a choice.'
            : 'Each sentence auto-plays as you advance. Listen, read along, and capture the highlighted chunk\'s meaning by typing it or choosing the closest option.'}
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

          <div className="text-2xl leading-relaxed text-center text-gray-900 mb-6">
            {item ? <HighlightedSentence sentence={item.sentence} target={item.target} /> : 'Loading prompts…'}
          </div>

          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="text-center text-lg text-gray-700">
              👉 在这句里，「<span className="font-semibold text-gray-900">{item?.target || '—'}</span>」是什么意思？
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <label htmlFor="answerInput" className="block text-sm font-medium text-gray-600">
              Type what the highlighted chunk means (optional):
            </label>
            <input
              id="answerInput"
              ref={inputRef}
              type="text"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
              placeholder="Type your understanding of the highlighted chunk..."
              value={answer}
              disabled={!item || completed}
              onInput={(event) => onAnswerChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onCheck();
                }
              }}
            />
            <button type="button" className="w-full bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition" onClick={onCheck} disabled={!item || completed}>
              Check answer
            </button>
          </div>

          <div className="mb-2">
            <div className="text-sm font-medium text-gray-600 mb-2">Or pick the closest meaning:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {options.map((option) => <ChoiceButton key={option.id} option={option} onSelect={onChoiceSelect} />)}
            </div>
          </div>

          <div className={`mt-4 text-center text-lg font-semibold ${feedback?.status === true ? 'text-green-600' : feedback?.status === false ? 'text-red-600' : 'text-gray-600'}`}>
            {feedback?.message || ''}
          </div>

          <div className="flex flex-col items-center gap-3 mt-6">
            <button type="button" className="w-full md:w-auto bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition" onClick={onToggleMeaning} aria-expanded={meaningVisible ? 'true' : 'false'}>
              {meaningVisible ? 'Hide meaning' : 'Show meaning'}
            </button>

            {meaningVisible ? (
              <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <div className="text-xs uppercase tracking-widest text-blue-500 mb-1">Meaning in context</div>
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
  merged.autoAdvanceDelay = typeof merged.autoAdvanceDelay === 'number' ? merged.autoAdvanceDelay : DEFAULT_CONFIG.autoAdvanceDelay;
  merged.replayShortcut = normalizeShortcut(overrides.replayShortcut || DEFAULT_CONFIG.replayShortcut);
  merged.datasetKey = overrides.datasetKey || DEFAULT_CONFIG.datasetKey;
  return merged;
}

function normalizeAnswer(text) {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCandidateAnswers(item) {
  const answers = new Set();
  answers.add(item.meaning);
  const noParens = item.meaning.replace(/\s*\([^)]*\)/g, '').trim();
  if (noParens) answers.add(noParens);
  item.meaning.split(/[;,]/).forEach((part) => {
    const trimmed = part.trim();
    if (trimmed) answers.add(trimmed);
  });
  if (Array.isArray(item.acceptedAnswers)) {
    item.acceptedAnswers.forEach((answer) => {
      const trimmed = String(answer || '').trim();
      if (trimmed) answers.add(trimmed);
    });
  }
  return Array.from(answers);
}

function tokenizeMeaning(text) {
  const result = new Set();
  text.split(' ').forEach((word) => {
    if (word.length <= 2) return;
    if (STOP_WORDS.has(word)) return;
    result.add(word);
  });
  return result;
}

function wordOverlap(a, b) {
  const wordsA = tokenizeMeaning(a);
  const wordsB = tokenizeMeaning(b);
  if (!wordsA.size || !wordsB.size) return 0;
  let matches = 0;
  wordsA.forEach((word) => {
    if (wordsB.has(word)) matches += 1;
  });
  return matches / Math.max(wordsA.size, wordsB.size);
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = new Array(b.length + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + 1);
      }
    }
  }
  return matrix[a.length][b.length];
}

function stringSimilarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (!maxLen) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function isFuzzyMatch(input, item) {
  const normalizedInput = normalizeAnswer(input);
  if (!normalizedInput) return false;
  return getCandidateAnswers(item).some((candidate) => {
    const normalizedCandidate = normalizeAnswer(candidate);
    if (!normalizedCandidate) return false;
    if (normalizedCandidate === normalizedInput) return true;
    if (normalizedCandidate.includes(normalizedInput) && normalizedInput.length >= Math.min(5, normalizedCandidate.length)) return true;
    if (normalizedInput.includes(normalizedCandidate) && normalizedCandidate.length >= 5) return true;
    if (stringSimilarity(normalizedInput, normalizedCandidate) >= 0.72) return true;
    return wordOverlap(normalizedInput, normalizedCandidate) >= 0.6;
  });
}

function buildChoiceOptions(prompts, index) {
  const correctMeaning = prompts[index].meaning;
  const pool = prompts
    .map((item) => item.meaning)
    .filter((meaning, currentIndex) => currentIndex !== index);
  const distractors = shuffleArray(pool).slice(0, Math.min(3, pool.length));
  return shuffleArray([
    { text: correctMeaning, correct: true },
    ...distractors.map((text) => ({ text, correct: false }))
  ]).map((option, optionIndex) => ({ ...option, id: `${optionIndex}:${option.text}` }));
}

function ContextListeningApp() {
  const [config] = useState(() => {
    const rawConfig = window.CONTEXT_DRILL_CONFIG || {};
    delete window.CONTEXT_DRILL_CONFIG;
    return normalizeConfig(rawConfig);
  });
  const [prompts, setPrompts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [meaningVisible, setMeaningVisible] = useState(false);
  const [feedback, setFeedback] = useState({ status: null, message: '' });
  const [completed, setCompleted] = useState(false);
  const [choiceOptions, setChoiceOptions] = useState([]);
  const [replayEnabled, setReplayEnabled] = useState('speechSynthesis' in window || typeof window.playSentenceAudio === 'function');
  const audioStateRef = useRef({ context: null });
  const pendingShiftReplayRef = useRef(false);
  const advanceTimeoutRef = useRef(null);

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
        if (!Array.isArray(data)) throw new Error('Invalid prompt format (expected array).');
        const nextPrompts = data.filter((item) => item && item.sentence && item.target && item.meaning);
        if (!nextPrompts.length) throw new Error('No prompts found in data file.');
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
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    };
  }, [config]);

  useEffect(() => {
    if (!currentItem) return undefined;
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    setAnswer('');
    setMeaningVisible(false);
    setFeedback({ status: null, message: '' });
    setCompleted(false);
    setChoiceOptions(buildChoiceOptions(prompts, currentIndex));
    speakSentence(currentItem.sentence);
    return () => cancelSpeech();
  }, [currentItem?.sentence, prompts, currentIndex]);

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

  const advance = () => {
    setCurrentIndex((index) => (prompts.length ? (index + 1) % prompts.length : index));
  };

  const handleCorrectAnswer = (message) => {
    setFeedback({ status: true, message });
    setMeaningVisible(true);
    setCompleted(true);
    setChoiceOptions((options) => options.map((option) => ({ ...option, disabled: true, revealed: true })));
    playFeedbackSound(audioStateRef.current, 'success');
    if (prompts.length > 1) {
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
      if (config.autoAdvanceDelay <= 0) {
        advance();
      } else {
        advanceTimeoutRef.current = setTimeout(advance, config.autoAdvanceDelay);
      }
    }
  };

  const handleTypeCheck = () => {
    if (completed || !currentItem) return;
    const input = answer.trim();
    if (!input) {
      setFeedback({ status: false, message: 'Enter what you think it means before checking.' });
      playFeedbackSound(audioStateRef.current, 'error');
      return;
    }
    if (isFuzzyMatch(input, currentItem)) {
      handleCorrectAnswer('Looks good! Your phrasing captures the meaning.');
    } else {
      setFeedback({ status: false, message: 'Close? Compare with the reveal, tweak your wording, or listen again.' });
      playFeedbackSound(audioStateRef.current, 'error');
    }
  };

  const handleChoiceSelect = (optionId) => {
    if (completed) return;
    const selected = choiceOptions.find((option) => option.id === optionId);
    if (!selected) return;
    if (selected.correct) {
      handleCorrectAnswer('Correct! Nice work.');
      return;
    }
    setChoiceOptions((options) => options.map((option) => option.id === optionId ? { ...option, disabled: true, incorrect: true } : option));
    setFeedback({ status: false, message: 'Not quite. Try again or type your own meaning.' });
    playFeedbackSound(audioStateRef.current, 'error');
  };

  return (
    <App
      config={config}
      prompts={prompts}
      currentIndex={currentIndex}
      answer={answer}
      meaningVisible={meaningVisible}
      feedback={feedback}
      completed={completed}
      options={choiceOptions}
      replayEnabled={replayEnabled}
      onAnswerChange={setAnswer}
      onCheck={handleTypeCheck}
      onChoiceSelect={handleChoiceSelect}
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

const root = document.getElementById('contextDrillApp');
if (root) {
  render(<ContextListeningApp />, root);
}
