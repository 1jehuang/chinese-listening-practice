const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function createContext() {
  const playedUrls = [];
  const spoken = [];

  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
      this._listeners = new Map();
    }
    addEventListener(type, handler) {
      if (!this._listeners.has(type)) this._listeners.set(type, []);
      this._listeners.get(type).push(handler);
    }
    removeEventListener(type, handler) {
      const list = this._listeners.get(type) || [];
      this._listeners.set(type, list.filter(fn => fn !== handler));
    }
    pause() {}
    play() {
      playedUrls.push(this.src);
      const handlers = this._listeners.get('playing') || [];
      handlers.forEach((fn) => fn());
      return Promise.resolve();
    }
  }

  const context = vm.createContext({
    console,
    window: null,
    globalThis: null,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    speechSynthesis: {
      speak(utterance) { spoken.push(utterance.text); },
      cancel() {},
      getVoices() { return [{ lang: 'en-US', name: 'Test English', voiceURI: 'test-en' }]; },
      addEventListener() {},
      removeEventListener() {}
    },
    SpeechSynthesisUtterance: class {
      constructor(text) { this.text = text; }
    },
    Audio: FakeAudio,
    navigator: { userAgent: '' },
    document: { body: { dataset: {} }, head: { appendChild() {} }, querySelector() { return null; }, createElement() { return {}; } },
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    encodeURIComponent,
    decodeURIComponent,
    Math,
    Date,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    Promise,
    RegExp,
    parseFloat,
    parseInt,
    isNaN,
    isFinite,
    Infinity,
    NaN,
    undefined,
  });

  context.window = context;
  context.globalThis = context;
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.speechSynthesis = context.speechSynthesis;
  context.window.SpeechSynthesisUtterance = context.SpeechSynthesisUtterance;
  context.window.Audio = context.Audio;
  context.window.localStorage = context.localStorage;
  context.window.navigator = context.navigator;

  const source = fs.readFileSync(path.join(__dirname, 'js/utils.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'js/utils.js' });
  return { context, playedUrls, spoken };
}

(async function main() {
  const { context, playedUrls, spoken } = createContext();
  const started = context.playEnglishTTS('middle');
  assert.strictEqual(started, true, 'english TTS should start playback');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.strictEqual(playedUrls.length, 1, 'english TTS should prefer remote audio playback');
  assert.match(playedUrls[0], /translate_tts/, 'english TTS should use Google translate audio');
  assert.match(playedUrls[0], /tl=en-US/, 'english TTS should request English audio');
  assert.deepStrictEqual(spoken, [], 'remote playback should avoid speech synthesis when audio succeeds');
  console.log('✓ english meaning audio prefers remote English playback');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
