const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function createContext({
  userAgent = 'Mozilla/5.0 Firefox/149.0',
  voices = [{ lang: 'zh-CN', name: 'eSpeak NG zh', voiceURI: 'espeak-zh' }],
  failBaidu = false,
  failGoogle = false,
} = {}) {
  const playedUrls = [];
  const spoken = [];

  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
      this.duration = 1;
      this.paused = true;
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
    pause() {
      this.paused = true;
    }
    load() {}
    play() {
      playedUrls.push(this.src);
      if (/fanyi\.baidu\.com/.test(this.src) && failBaidu) {
        this.paused = true;
        return Promise.reject(new Error('baidu blocked'));
      }
      if (/translate\.googleapis\.com/.test(this.src) && failGoogle) {
        this.paused = true;
        return Promise.reject(new Error('google blocked'));
      }
      this.paused = false;
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
      getVoices() { return voices; },
      addEventListener() {},
      removeEventListener() {}
    },
    SpeechSynthesisUtterance: class {
      constructor(text) { this.text = text; }
    },
    Audio: FakeAudio,
    navigator: { userAgent },
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

async function tick(ms = 25) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

(async function main() {
  {
    const { context, playedUrls, spoken } = createContext({ failBaidu: true });
    context.playTTS('你好');
    await tick();
    assert.strictEqual(playedUrls.length, 2, 'playTTS should try a secondary remote source when Baidu playback is rejected');
    assert.match(playedUrls[0], /fanyi\.baidu\.com/, 'playTTS should try Baidu first');
    assert.match(playedUrls[1], /translate\.googleapis\.com/, 'playTTS should fall back to Google audio on Firefox');
    assert.deepStrictEqual(spoken, [], 'robotic Firefox voices should stay off when remote fallback succeeds');
  }

  {
    const { context, playedUrls, spoken } = createContext({ failBaidu: true });
    context.playSentenceAudio('你好');
    await tick();
    assert.strictEqual(playedUrls.length, 2, 'playSentenceAudio should try Google when Baidu play() is rejected');
    assert.match(playedUrls[0], /fanyi\.baidu\.com/, 'playSentenceAudio should try Baidu first');
    assert.match(playedUrls[1], /translate\.googleapis\.com/, 'playSentenceAudio should fall back to Google audio');
    assert.deepStrictEqual(spoken, [], 'Firefox sentence playback should avoid robotic speech when remote fallback succeeds');
  }

  {
    const { context, playedUrls, spoken } = createContext({
      voices: [{ lang: 'zh-CN', name: 'Natural Mandarin', voiceURI: 'natural-zh' }],
      failBaidu: true,
      failGoogle: true,
    });
    context.playTTS('你好');
    await tick();
    assert.strictEqual(playedUrls.length, 2, 'playTTS should exhaust both remote Chinese sources before speech fallback');
    assert.deepStrictEqual(spoken, ['你好'], 'Firefox should still allow speech fallback when a non-robotic Chinese voice is available');
  }

  console.log('✓ firefox Chinese audio falls back to remote playback and avoids robotic speech when possible');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
