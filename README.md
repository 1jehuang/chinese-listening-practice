# Chinese Listening Practice

Interactive web apps for practicing Mandarin Chinese vocabulary and pinyin.

This repository follows the UW Chinese 111 course curriculum.

**Home page:** https://1jehuang.github.io/chinese-listening-practice/home.html

## Local Development

Some pages load data/assets via JavaScript, so they work best when served over HTTP.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/home.html`.

## Tests

```bash
npm test
```

Optional (network-dependent audio availability check):

```bash
npm run test:audio
```
