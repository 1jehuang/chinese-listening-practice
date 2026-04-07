export function normalizeShortcut(value, fallback = { code: 'KeyA', shift: true, ctrl: false, alt: false, label: '⇧+A' }) {
  if (!value) return fallback;

  if (typeof value === 'string') {
    const parts = value.split('+').map((part) => part.trim()).filter(Boolean);
    const shortcut = { code: null, key: null, shift: false, ctrl: false, alt: false };
    parts.forEach((part) => {
      const upper = part.toUpperCase();
      if (upper === 'SHIFT') shortcut.shift = true;
      else if (upper === 'CTRL' || upper === 'CONTROL') shortcut.ctrl = true;
      else if (upper === 'ALT' || upper === 'OPTION') shortcut.alt = true;
      else if (upper.startsWith('KEY')) shortcut.code = part;
      else shortcut.key = part;
    });
    shortcut.code = shortcut.code || (shortcut.key ? `Key${shortcut.key.toUpperCase()}` : fallback.code);
    shortcut.label = shortcutLabel(shortcut);
    return { ...fallback, ...shortcut };
  }

  if (typeof value === 'object') {
    const shortcut = {
      code: value.code || (value.key ? `Key${String(value.key).toUpperCase()}` : fallback.code),
      key: value.key || null,
      shift: Boolean(value.shift),
      ctrl: Boolean(value.ctrl),
      alt: Boolean(value.alt)
    };
    shortcut.label = value.label || shortcutLabel(shortcut);
    return { ...fallback, ...shortcut };
  }

  return fallback;
}

export function shortcutLabel(shortcut) {
  const parts = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('⇧');
  const keyPart = shortcut.key
    ? shortcut.key.toUpperCase()
    : (shortcut.code && shortcut.code.startsWith('Key'))
      ? shortcut.code.slice(3).toUpperCase()
      : 'A';
  parts.push(keyPart);
  return parts.join('+');
}

export function isReplayShortcut(event, shortcut) {
  if (!shortcut) return false;
  if (shortcut.shift !== undefined && shortcut.shift !== event.shiftKey) return false;
  if (shortcut.ctrl !== undefined && shortcut.ctrl !== event.ctrlKey) return false;
  if (shortcut.alt !== undefined && shortcut.alt !== event.altKey) return false;
  if (shortcut.code) return event.code === shortcut.code;
  if (shortcut.key) return event.key.toLowerCase() === shortcut.key.toLowerCase();
  return false;
}

export function resolveUrl(path) {
  try {
    return new URL(path, window.location.href).href;
  } catch (error) {
    return path;
  }
}

export function cloneDataset(data) {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (error) {
    return data?.slice ? data.slice() : data;
  }
}

export function getEmbeddedDataset(datasetKey) {
  if (!datasetKey) return null;
  const store = window.__CONTEXT_DATASETS__;
  if (!store) return null;
  const data = store[datasetKey];
  if (!Array.isArray(data)) return null;
  return cloneDataset(data);
}

export function fetchViaXHR(url) {
  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onreadystatechange = () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) return;
        if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (parseError) {
            reject(parseError);
          }
        } else {
          reject(new Error(`XHR failed with status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('XHR network error'));
      xhr.send();
    } catch (error) {
      reject(error);
    }
  });
}

export async function loadDataset({ dataUrl, datasetKey }) {
  const isFileProtocol = window.location.protocol === 'file:';
  const resolvedUrl = resolveUrl(dataUrl);

  if (isFileProtocol) {
    const embedded = getEmbeddedDataset(datasetKey);
    if (embedded) return embedded;
  }

  try {
    const response = await fetch(resolvedUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load prompts: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    if (isFileProtocol) {
      try {
        return await fetchViaXHR(resolvedUrl);
      } catch (_) {
        const embedded = getEmbeddedDataset(datasetKey);
        if (embedded) return embedded;
      }
    }
    throw error;
  }
}

export function cancelSpeech() {
  if (typeof window.stopActiveAudio === 'function') {
    window.stopActiveAudio();
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakSentence(sentence) {
  if (!sentence) return;
  cancelSpeech();
  if (typeof window.playSentenceAudio === 'function') {
    window.playSentenceAudio(sentence);
    return;
  }
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = 'zh-CN';
  if (typeof window.getQuizTtsRate === 'function') {
    utterance.rate = window.getQuizTtsRate();
  }
  window.speechSynthesis.speak(utterance);
}

export function playFeedbackSound(audioState, type) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!audioState.context) {
    audioState.context = new AudioCtx();
  }
  const ctx = audioState.context;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const startTime = ctx.currentTime + 0.01;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === 'success') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, startTime);
    osc.frequency.linearRampToValueAtTime(880, startTime + 0.25);
  } else {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, startTime);
    osc.frequency.linearRampToValueAtTime(160, startTime + 0.2);
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);

  osc.start(startTime);
  osc.stop(startTime + 0.35);
}

export function shuffleArray(array) {
  const next = array.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char] || char));
}
