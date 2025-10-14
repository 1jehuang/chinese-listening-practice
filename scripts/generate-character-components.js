#!/usr/bin/env node

/**
 * Generate component breakdown data for the common character list.
 * Data source: https://github.com/skishore/makemeahanzi
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DICT_URL = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt';
const OUTPUT_PATH = path.join(__dirname, '..', 'js', 'character-components.js');
const COMMON_CHAR_PATH = path.join(__dirname, '..', 'js', 'common-2500-chars.js');

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            if (res.statusCode !== 200) {
                reject(new Error(`Request failed: ${res.statusCode}`));
                return;
            }

            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => resolve(raw));
        }).on('error', reject);
    });
}

function toDefinition(entry) {
    if (!entry) return '';
    const def = entry.definition;
    if (Array.isArray(def)) {
        return def.join('; ').replace(/<[^>]+>/g, '').trim();
    }
    if (typeof def === 'string') {
        return def.replace(/<[^>]+>/g, '').trim();
    }
    return '';
}

function sanitize(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

function sanitizeHint(text) {
    if (!text) return '';
    return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function sanitizeDefinition(entry) {
    const def = toDefinition(entry);
    if (!def) return '';
    return def.replace(/\(.*?\)/g, '').trim();
}

function buildEtymologyNote(charData, breakdown, entry) {
    if (!breakdown) return '';

    const meaning = charData && charData.meaning
        ? sanitize(charData.meaning)
        : sanitizeDefinition(entry);

    const hint = entry && entry.etymology && entry.etymology.hint
        ? sanitizeHint(entry.etymology.hint)
        : '';

    if (hint) {
        return meaning ? `${hint} → ${meaning}` : hint;
    }

    if (breakdown.radical && breakdown.radical.char && breakdown.phonetic && breakdown.phonetic.char) {
        const radMeaning = breakdown.radical.meaning ? sanitize(breakdown.radical.meaning) : '';
        const radChar = sanitize(breakdown.radical.char);
        const phoChar = sanitize(breakdown.phonetic.char);
        const phoPinyin = breakdown.phonetic.pinyin ? ` (${sanitize(breakdown.phonetic.pinyin)})` : '';
        const meaningPart = radMeaning
            ? `${radChar} (${radMeaning}) supplies the idea`
            : `${radChar} supplies the idea`;
        const soundPart = `${phoChar}${phoPinyin} supplies the sound`;
        const tail = meaning ? ` → ${meaning}` : '';
        return `${meaningPart}; ${soundPart}${tail}`;
    }

    if (breakdown.radical && breakdown.radical.char) {
        const radMeaning = breakdown.radical.meaning ? sanitize(breakdown.radical.meaning) : '';
        const radChar = sanitize(breakdown.radical.char);
        const tail = meaning ? ` → ${meaning}` : '';
        return `${radChar}${radMeaning ? ' (' + radMeaning + ')' : ''} points to the meaning${tail}`;
    }

    if (breakdown.phonetic && breakdown.phonetic.char) {
        const phoChar = sanitize(breakdown.phonetic.char);
        const phoPinyin = breakdown.phonetic.pinyin ? ` (${sanitize(breakdown.phonetic.pinyin)})` : '';
        const tail = meaning ? ` for "${meaning}"` : '';
        return `${phoChar}${phoPinyin} guides the pronunciation${tail}`;
    }

    return meaning || '';
}

function getPrimaryPinyin(entry) {
    if (!entry || !entry.pinyin || !entry.pinyin.length) return '';
    return sanitize(entry.pinyin[0]);
}

function extractLeaves(decomposition) {
    if (!decomposition) return [];
    return Array.from(decomposition.replace(/[⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻]/g, ''))
        .filter(ch => ch && ch !== '？' && ch !== '〇');
}

function parseRadicalEntry(entry) {
    if (!entry) return null;
    const trimmed = String(entry).trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(.+?)\s*\((.+)\)$/);
    if (match) {
        return {
            char: match[1].trim(),
            meaning: match[2].trim()
        };
    }
    return { char: trimmed, meaning: '' };
}

function convertRadicalList(radicals) {
    if (!Array.isArray(radicals) || radicals.length === 0) return null;
    const entries = radicals.map(parseRadicalEntry).filter(Boolean);
    if (!entries.length) return null;

    const breakdown = { radical: entries[0] };
    if (entries[1]) breakdown.phonetic = entries[1];
    if (entries.length > 2) breakdown.others = entries.slice(2);
    return breakdown;
}

async function main() {
    console.log('Fetching makemeahanzi dictionary...');
    const dictionaryText = await fetch(DICT_URL);
    const dictionaryEntries = dictionaryText.trim().split('\n').map(line => JSON.parse(line));
    const dictionaryMap = new Map(dictionaryEntries.map(entry => [entry.character, entry]));

    const commonCharsCode = fs.readFileSync(COMMON_CHAR_PATH, 'utf8');
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(`${commonCharsCode}\n;globalThis._CHAR_LIST = COMMON_2500_CHARS;`, sandbox);
    const characters = sandbox._CHAR_LIST;

    const componentsData = {};

    for (const charData of characters) {
        const char = charData.char;
        const entry = dictionaryMap.get(char);
        if (!entry) continue;

        let radicalChar = null;
        let phoneticChar = null;

        if (entry.etymology && entry.etymology.type === 'pictophonetic') {
            radicalChar = entry.etymology.semantic || entry.radical || null;
            phoneticChar = entry.etymology.phonetic || null;
        } else {
            radicalChar = entry.radical || null;
        }

        const leaves = extractLeaves(entry.decomposition);
        const uniqueLeaves = [];
        for (const leaf of leaves) {
            if (!uniqueLeaves.includes(leaf)) uniqueLeaves.push(leaf);
        }

        if (!phoneticChar && radicalChar && uniqueLeaves.length === 2) {
            if (uniqueLeaves[0] === radicalChar) {
                phoneticChar = uniqueLeaves[1];
            } else if (uniqueLeaves[1] === radicalChar) {
                phoneticChar = uniqueLeaves[0];
            }
        }

        if (radicalChar === '？') radicalChar = null;
        if (phoneticChar === '？') phoneticChar = null;

        const others = uniqueLeaves.filter(ch => ch !== radicalChar && ch !== phoneticChar);

        let breakdown = {};

        if (entry.radicals) {
            breakdown = convertRadicalList(entry.radicals) || breakdown;
        }

        if (radicalChar) {
            breakdown.radical = breakdown.radical || {
                char: radicalChar,
                meaning: sanitize(toDefinition(dictionaryMap.get(radicalChar))),
                pinyin: sanitize(getPrimaryPinyin(dictionaryMap.get(radicalChar)))
            };
        } else if (breakdown.radical && breakdown.radical.char) {
            const radEntry = dictionaryMap.get(breakdown.radical.char);
            if (radEntry) {
                breakdown.radical.pinyin = sanitize(getPrimaryPinyin(radEntry));
                if (!breakdown.radical.meaning) {
                    breakdown.radical.meaning = sanitize(toDefinition(radEntry));
                }
            }
        }

        if (phoneticChar) {
            breakdown.phonetic = {
                char: phoneticChar,
                meaning: sanitize(toDefinition(dictionaryMap.get(phoneticChar))),
                pinyin: sanitize(getPrimaryPinyin(dictionaryMap.get(phoneticChar)))
            };
        } else if (breakdown.phonetic && breakdown.phonetic.char) {
            const phoEntry = dictionaryMap.get(breakdown.phonetic.char);
            if (phoEntry) {
                breakdown.phonetic.pinyin = sanitize(getPrimaryPinyin(phoEntry));
                if (!breakdown.phonetic.meaning) {
                    breakdown.phonetic.meaning = sanitize(toDefinition(phoEntry));
                }
            }
        }

        if (others.length > 0) {
            breakdown.others = breakdown.others || [];
            for (const otherChar of others) {
                breakdown.others.push({
                    char: otherChar,
                    meaning: sanitize(toDefinition(dictionaryMap.get(otherChar))),
                    pinyin: sanitize(getPrimaryPinyin(dictionaryMap.get(otherChar)))
                });
            }
            breakdown.others = breakdown.others.filter(Boolean);
        } else if (Array.isArray(breakdown.others)) {
            breakdown.others = breakdown.others.map(other => {
                if (!other || !other.char) return other;
                const data = dictionaryMap.get(other.char);
                if (!data) return other;
                return {
                    char: other.char,
                    meaning: other.meaning ? sanitize(other.meaning) : sanitize(toDefinition(data)),
                    pinyin: other.pinyin ? sanitize(other.pinyin) : sanitize(getPrimaryPinyin(data))
                };
            }).filter(Boolean);
        }

        if (entry.etymology && entry.etymology.hint) {
            breakdown.hint = sanitize(entry.etymology.hint);
        }

        const etymologyText = buildEtymologyNote(charData, breakdown, entry);
        if (etymologyText) {
            breakdown.etymologyNote = etymologyText;
        }

        const hasData = (breakdown.radical && (breakdown.radical.char || breakdown.radical.meaning)) ||
            (breakdown.phonetic && (breakdown.phonetic.char || breakdown.phonetic.meaning)) ||
            (Array.isArray(breakdown.others) && breakdown.others.length > 0);

        if (hasData) {
            componentsData[char] = breakdown;
        }
    }

    const header = [
        '// Auto-generated component data (radical & phonetic breakdown)',
        '// Source: makemeahanzi dictionary (https://github.com/skishore/makemeahanzi)'
    ].join('\n');
    const dataLiteral = JSON.stringify(componentsData, null, 2);

    const fileContents = `${header}\nconst CHARACTER_COMPONENTS = ${dataLiteral};\nif (typeof window !== 'undefined') {\n    window.CHARACTER_COMPONENTS = CHARACTER_COMPONENTS;\n} else if (typeof globalThis !== 'undefined') {\n    globalThis.CHARACTER_COMPONENTS = CHARACTER_COMPONENTS;\n}\n`;
    fs.writeFileSync(OUTPUT_PATH, fileContents, 'utf8');

    console.log(`Wrote ${Object.keys(componentsData).length} component entries to ${OUTPUT_PATH}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
