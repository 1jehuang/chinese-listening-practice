const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function createFakeTimers() {
  let now = 0;
  let idCounter = 1;
  const timers = new Map();

  function schedule(fn, delay) {
    const trigger = now + Math.max(0, delay || 0);
    const id = idCounter++;
    timers.set(id, { id, trigger, fn });
    return id;
  }

  function clearTimeout(id) {
    timers.delete(id);
  }

  function advanceBy(ms) {
    const target = now + ms;
    runDue(target);
    now = target;
  }

  function runDue(target = now) {
    let progressed = true;
    while (progressed) {
      progressed = false;
      let nextEntry = null;
      for (const entry of timers.values()) {
        if (entry.trigger <= target) {
          if (!nextEntry || entry.trigger < nextEntry.trigger) {
            nextEntry = entry;
          }
        }
      }

      if (nextEntry) {
        timers.delete(nextEntry.id);
        now = nextEntry.trigger;
        nextEntry.fn();
        progressed = true;
      }
    }
  }

  function runAll() {
    while (timers.size > 0) {
      const next = Array.from(timers.values()).sort((a, b) => a.trigger - b.trigger)[0];
      advanceBy(next.trigger - now);
    }
  }

  return {
    now: () => now,
    setTimeout: schedule,
    clearTimeout,
    advanceBy,
    runDue,
    runAll,
  };
}

function createEnvironment() {
  const timers = createFakeTimers();
  const elementsById = new Map();
  const allElements = [];
  const documentListeners = new Map();

  class Element {
    constructor(tagName, id = null) {
      this.tagName = tagName.toUpperCase();
      this.id = id;
      this.textContent = '';
      this.value = '';
      this.style = {};
      this.dataset = {};
      this.disabled = false;
      this.children = [];
      this.parentNode = null;
      this._listeners = new Map();
      this._innerHTML = '';
      this._removed = false;
      this.onclick = null;
      this.classList = {
        _owner: this,
        list: [],
        add: function add(...cls) {
          cls.forEach((name) => {
            if (!this.list.includes(name)) {
              this.list.push(name);
            }
          });
        },
        remove: function remove(...cls) {
          this.list = this.list.filter((name) => !cls.includes(name));
        },
        contains: function contains(name) {
          return this.list.includes(name);
        },
      };
      if (id) {
        elementsById.set(id, this);
      }
      allElements.push(this);
    }

    set className(value) {
      this.classList.list = value ? value.split(/\s+/).filter(Boolean) : [];
    }

    get className() {
      return this.classList.list.join(' ');
    }

    set innerHTML(value) {
      this._innerHTML = value;
      if (value === '') {
        this.children.forEach((child) => {
          child._removed = true;
          if (child.parentNode === this) {
            child.parentNode = null;
          }
        });
        this.children = [];
      }
    }

    get innerHTML() {
      return this._innerHTML;
    }

    appendChild(child) {
      child.parentNode = this;
      child._removed = false;
      this.children.push(child);
      return child;
    }

    addEventListener(type, handler) {
      if (!this._listeners.has(type)) {
        this._listeners.set(type, []);
      }
      this._listeners.get(type).push(handler);
    }

    dispatchEvent(type, event = {}) {
      const handlers = this._listeners.get(type) || [];
      handlers.forEach((fn) => fn.call(this, event));
    }

    click() {
      const event = { preventDefault() {} };
      if (typeof this.onclick === 'function') {
        this.onclick(event);
      }
      this.dispatchEvent('click', event);
    }

    focus() {
      this._focused = true;
    }
  }

  function createElement(tag, id) {
    return new Element(tag, id);
  }

  const document = {
    getElementById(id) {
      return elementsById.get(id) || null;
    },
    createElement,
    querySelectorAll(selector) {
      if (!selector.startsWith('.')) {
        return new NodeList([]);
      }
      const className = selector.slice(1);
      const matches = allElements.filter(
        (el) => !el._removed && el.classList.contains(className)
      );
      return new NodeList(matches);
    },
    addEventListener(type, handler) {
      if (!documentListeners.has(type)) {
        documentListeners.set(type, []);
      }
      documentListeners.get(type).push(handler);
    },
    dispatchEvent(type, event) {
      const handlers = documentListeners.get(type) || [];
      handlers.forEach((fn) => fn(event));
    },
    body: createElement('body', 'body'),
  };

  class NodeList {
    constructor(nodes) {
      this._nodes = nodes;
    }

    forEach(fn) {
      this._nodes.forEach(fn);
    }

    [Symbol.iterator]() {
      return this._nodes[Symbol.iterator]();
    }

    get length() {
      return this._nodes.length;
    }

    item(index) {
      return this._nodes[index] || null;
    }
  }

  // Pre-create elements used by the quiz
  const ids = [
    'playBtn',
    'nextBtn',
    'feedback',
    'answerInput',
    'checkBtn',
    'listenMode',
    'chooseMode',
    'tone24Mode',
    'speakMode',
    'doubleMode',
    'doubleAnswerInput',
    'doubleCheckBtn',
    'displayPinyin',
    'recognizedText',
    'debugInfo',
    'options',
    'tone24Options',
    'score',
    'total',
    'percentage',
    'visualizer',
  ];

  ids.forEach((id) => {
    let tag = 'div';
    if (id === 'visualizer') {
      tag = 'canvas';
    } else if (id.endsWith('Input')) {
      tag = 'input';
    } else if (id.endsWith('Btn')) {
      tag = 'button';
    }
    const el = createElement(tag, id);
    if (id === 'visualizer') {
      el.width = 300;
      el.height = 100;
      el.getContext = function getContext() {
        return {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          fillRect: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          stroke: () => {},
        };
      };
    }
  });

  // Additional element behaviour adjustments
  const answerInput = document.getElementById('answerInput');
  answerInput.value = '';
  answerInput.focus = function focus() {
    this._focused = true;
  };

  const doubleAnswerInput = document.getElementById('doubleAnswerInput');
  doubleAnswerInput.value = '';
  doubleAnswerInput.focus = function focus() {
    this._focused = true;
  };

  // Mode buttons
  const modeButtons = ['listen', 'choose', 'tone24', 'double', 'speak'].map((mode) => {
    const btn = createElement('button');
    btn.classList.add('mode-btn');
    btn.dataset.mode = mode;
    btn.textContent = mode;
    return btn;
  });

  const modeSelectorList = new NodeList(modeButtons);
  document.querySelectorAll = function querySelectorAll(selector) {
    if (selector === '.mode-btn') {
      return modeSelectorList;
    }
    if (selector === '.option-btn') {
      const matches = allElements.filter(
        (el) => !el._removed && el.classList.contains('option-btn')
      );
      return new NodeList(matches);
    }
    return new NodeList([]);
  };

  document.querySelector = function querySelector(selector) {
    const match = selector && selector.match(/\.mode-btn\[data-mode="([^"]+)"\]/);
    if (match) {
      return modeButtons.find((btn) => btn.dataset.mode === match[1]) || null;
    }
    return null;
  };

  // Speech recognition mock
  const recognitionInstances = [];

  class MockSpeechRecognition {
    constructor() {
      this.lang = 'zh-CN';
      this.continuous = false;
      this.interimResults = false;
      this.maxAlternatives = 1;

      this.onstart = null;
      this.onresult = null;
      this.onend = null;
      this.onerror = null;

      this._started = false;
      recognitionInstances.push(this);
    }

    start() {
      this._started = true;
      if (typeof this.onstart === 'function') {
        this.onstart();
      }
    }

    stop() {
      this._started = false;
      if (typeof this.onend === 'function') {
        this.onend();
      }
    }

    emitResult(transcript, { confidence = 0.95, isFinal = true } = {}) {
      if (typeof this.onresult !== 'function') return;
      const alternative = { transcript, confidence };
      const result = [alternative];
      result.isFinal = isFinal;
      const event = {
        results: [result],
      };
      this.onresult(event);
    }

    emitError(error) {
      if (typeof this.onerror === 'function') {
        this.onerror({ error });
      }
    }
  }

  function Audio() {
    this.onended = null;
  }

  Audio.prototype.play = function play() {
    if (typeof this.onended === 'function') {
      this.onended();
    }
    return Promise.resolve();
  };

  const baseConsole = console;
  const silentConsole = {
    log: () => {},
    info: () => {},
    debug: () => {},
    warn: (...args) => baseConsole.warn(...args),
    error: (...args) => baseConsole.error(...args),
  };

  const window = {
    document,
    console: silentConsole,
    alert: () => {},
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    Math,
    Audio,
    SpeechRecognition: MockSpeechRecognition,
    webkitSpeechRecognition: MockSpeechRecognition,
  };

  window.window = window;
  window.globalThis = window;
  window.navigator = {
    mediaDevices: {
      getUserMedia: async () => ({
        getTracks: () => [{ stop: () => {} }],
      }),
    },
  };

  class AudioContext {
    createAnalyser() {
      return {
        frequencyBinCount: 1024,
        fftSize: 2048,
        getByteTimeDomainData: (arr) => {
          for (let i = 0; i < arr.length; i += 1) {
            arr[i] = 128;
          }
        },
      };
    }

    createMediaStreamSource(stream) {
      return { connect: () => {}, mediaStream: stream };
    }

    close() {
      return Promise.resolve();
    }
  }

  window.AudioContext = AudioContext;
  window.webkitAudioContext = AudioContext;

  const context = vm.createContext(window);

  return {
    context,
    timers,
    elements: Object.fromEntries(elementsById.entries()),
    modeButtons,
    recognitionInstances,
  };
}

function extractScriptSource() {
  const htmlPath = path.join(__dirname, '..', 'pinyin-practice.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!match) {
    throw new Error('Unable to locate main script in pinyin-practice.html');
  }
  return match[1];
}

async function flushMicrotasks(times = 5) {
  for (let i = 0; i < times; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

async function runTest(name, testFn, scriptSource, results) {
  const env = createEnvironment();
  vm.runInContext(scriptSource, env.context);

  try {
    await testFn(env);
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, error: err });
  }
}

async function main() {
  const results = [];
  const scriptSource = extractScriptSource();

  await runTest(
    'Speak mode starts continuous listening',
    async ({ timers, elements, modeButtons, recognitionInstances }) => {
      const speakBtn = modeButtons.find((btn) => btn.dataset.mode === 'speak');
      speakBtn.click();

      // Speak mode starts after a 500ms delay (setTimeout in the page script).
      timers.advanceBy(500);
      await flushMicrotasks();

      assert.strictEqual(recognitionInstances.length, 1, 'Recognition should start');
      assert.strictEqual(
        elements.recognizedText.textContent.trim(),
        'Listening...',
        'Speak mode should update the listening hint'
      );
    },
    scriptSource,
    results
  );

  await runTest(
    'Final transcript updates feedback',
    async ({ timers, elements, modeButtons, recognitionInstances }) => {
      const speakBtn = modeButtons.find((btn) => btn.dataset.mode === 'speak');
      speakBtn.click();

      timers.advanceBy(500);
      await flushMicrotasks();

      const activeRecognition = recognitionInstances[recognitionInstances.length - 1];
      const transcript = elements.displayPinyin.textContent.trim() || 'ma';

      activeRecognition.emitResult(transcript, { confidence: 0.82, isFinal: true });
      await flushMicrotasks();

      assert.ok(
        /Target:/.test(elements.feedback.innerHTML),
        'Feedback should display the target prompt'
      );
      assert.ok(/You said:/.test(elements.feedback.innerHTML), 'Feedback should include the transcript');
    },
    scriptSource,
    results
  );

  let failures = 0;
  results.forEach((result) => {
    if (result.ok) {
      console.log(`✓ ${result.name}`);
    } else {
      failures += 1;
      console.error(`✗ ${result.name}`);
      if (result.error && result.error.stack) {
        console.error(result.error.stack);
      } else {
        console.error(result.error);
      }
    }
  });

  if (failures === 0) {
    console.log('All speak-mode tests passed.');
  } else {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
};
