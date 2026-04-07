# Chinese Listening Practice

Interactive web apps for practicing Mandarin Chinese vocabulary and pinyin.

This repository follows the UW Chinese 111 course curriculum.

**Home page:** https://1jehuang.github.io/chinese-listening-practice/home.html

## Local Development

Some pages load data/assets via JavaScript, so they work best when served over HTTP.

If you edit the Preact UI islands under `src/`, rebuild the browser bundles first:

```bash
npm install
npm run build:ui
```

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/home.html`.

## Linux Trackpad Writing Prototype

There is also a small local prototype for testing whether a Linux laptop trackpad can work as a Chinese writing practice surface.

```bash
python3 scripts/trackpad_write_practice.py
```

Useful options:

```bash
python3 scripts/trackpad_write_practice.py --list-devices
python3 scripts/trackpad_write_practice.py --character 永
python3 scripts/trackpad_write_practice.py --mouse
```

Notes:

- Requires Python packages `evdev` and `pygame`
- Needs permission to read `/dev/input/event*` for the touchpad
- Uses one-finger raw multitouch input and ignores multi-touch gestures

## Tests

```bash
npm test
```

Optional (network-dependent audio availability check):

```bash
npm run test:audio
```
