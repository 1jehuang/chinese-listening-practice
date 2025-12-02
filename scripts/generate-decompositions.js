#!/usr/bin/env node
/**
 * Generate CHARACTER_DECOMPOSITIONS data from Make Me a Hanzi dictionary
 *
 * Usage: node scripts/generate-decompositions.js [output-file]
 *
 * This script:
 * 1. Downloads the Make Me a Hanzi dictionary
 * 2. Parses decomposition and matches data for each character
 * 3. Outputs a JSON file that can be used by the quiz engine
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DICTIONARY_URL = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt';

// IDS (Ideographic Description Sequence) character to type mapping
const IDS_TYPE_MAP = {
    '⿰': 'lr',      // left-right
    '⿱': 'tb',      // top-bottom
    '⿲': 'lr3',     // left-middle-right
    '⿳': 'tb3',     // top-middle-bottom
    '⿴': 'surround', // full surround
    '⿵': 'surround', // surround from above
    '⿶': 'surround', // surround from below
    '⿷': 'surround', // surround from left
    '⿸': 'surround', // surround from upper left
    '⿹': 'surround', // surround from upper right
    '⿺': 'surround', // surround from lower left
    '⿻': 'other'     // overlaid
};

// Common radicals with pinyin and meaning for fallback
const COMMON_RADICALS = {
    '亻': { pinyin: 'rén', meaning: 'person' },
    '氵': { pinyin: 'shuǐ', meaning: 'water' },
    '扌': { pinyin: 'shǒu', meaning: 'hand' },
    '口': { pinyin: 'kǒu', meaning: 'mouth' },
    '木': { pinyin: 'mù', meaning: 'wood' },
    '火': { pinyin: 'huǒ', meaning: 'fire' },
    '土': { pinyin: 'tǔ', meaning: 'earth' },
    '金': { pinyin: 'jīn', meaning: 'metal' },
    '日': { pinyin: 'rì', meaning: 'sun' },
    '月': { pinyin: 'yuè', meaning: 'moon' },
    '心': { pinyin: 'xīn', meaning: 'heart' },
    '女': { pinyin: 'nǚ', meaning: 'woman' },
    '子': { pinyin: 'zǐ', meaning: 'child' },
    '宀': { pinyin: 'mián', meaning: 'roof' },
    '门': { pinyin: 'mén', meaning: 'door' },
    '讠': { pinyin: 'yán', meaning: 'speech' },
    '饣': { pinyin: 'shí', meaning: 'food' },
    '车': { pinyin: 'chē', meaning: 'vehicle' },
    '艹': { pinyin: 'cǎo', meaning: 'grass' },
    '竹': { pinyin: 'zhú', meaning: 'bamboo' },
    '力': { pinyin: 'lì', meaning: 'power' },
    '工': { pinyin: 'gōng', meaning: 'work' },
    '贝': { pinyin: 'bèi', meaning: 'shell' },
    '页': { pinyin: 'yè', meaning: 'page' },
    '走': { pinyin: 'zǒu', meaning: 'walk' },
    '足': { pinyin: 'zú', meaning: 'foot' },
    '目': { pinyin: 'mù', meaning: 'eye' },
    '耳': { pinyin: 'ěr', meaning: 'ear' },
    '田': { pinyin: 'tián', meaning: 'field' },
    '石': { pinyin: 'shí', meaning: 'stone' },
    '山': { pinyin: 'shān', meaning: 'mountain' },
    '禾': { pinyin: 'hé', meaning: 'grain' },
    '米': { pinyin: 'mǐ', meaning: 'rice' },
    '糸': { pinyin: 'sī', meaning: 'silk' },
    '言': { pinyin: 'yán', meaning: 'speech' },
    '食': { pinyin: 'shí', meaning: 'food' },
    '衣': { pinyin: 'yī', meaning: 'clothing' },
    '刂': { pinyin: 'dāo', meaning: 'knife' },
    '阝': { pinyin: 'fù', meaning: 'mound' },
    '冖': { pinyin: 'mì', meaning: 'cover' },
    '厂': { pinyin: 'chǎng', meaning: 'factory' },
    '广': { pinyin: 'guǎng', meaning: 'wide' },
    '户': { pinyin: 'hù', meaning: 'door' },
    '尸': { pinyin: 'shī', meaning: 'corpse' },
    '王': { pinyin: 'wáng', meaning: 'king' },
    '大': { pinyin: 'dà', meaning: 'big' },
    '小': { pinyin: 'xiǎo', meaning: 'small' },
    '人': { pinyin: 'rén', meaning: 'person' },
    '八': { pinyin: 'bā', meaning: 'eight' },
    '十': { pinyin: 'shí', meaning: 'ten' },
    '一': { pinyin: 'yī', meaning: 'one' },
    '冂': { pinyin: 'jiōng', meaning: 'borders' },
    '己': { pinyin: 'jǐ', meaning: 'self' },
    '乞': { pinyin: 'qǐ', meaning: 'beg' },
    '反': { pinyin: 'fǎn', meaning: 'opposite' },
    '方': { pinyin: 'fāng', meaning: 'square' },
    '正': { pinyin: 'zhèng', meaning: 'correct' },
    '主': { pinyin: 'zhǔ', meaning: 'master' },
    '寸': { pinyin: 'cùn', meaning: 'inch' },
    '其': { pinyin: 'qí', meaning: 'its' },
    '是': { pinyin: 'shì', meaning: 'is' },
    '禺': { pinyin: 'yú', meaning: 'area' },
    '舌': { pinyin: 'shé', meaning: 'tongue' },
    '更': { pinyin: 'gēng', meaning: 'change' },
    '般': { pinyin: 'bān', meaning: 'sort' },
    '尚': { pinyin: 'shàng', meaning: 'still' },
    '中': { pinyin: 'zhōng', meaning: 'middle' },
    '又': { pinyin: 'yòu', meaning: 'again' },
    '白': { pinyin: 'bái', meaning: 'white' },
    '分': { pinyin: 'fēn', meaning: 'divide' },
    '青': { pinyin: 'qīng', meaning: 'blue/green' },
    '生': { pinyin: 'shēng', meaning: 'life' },
    '里': { pinyin: 'lǐ', meaning: 'inside' },
    '且': { pinyin: 'qiě', meaning: 'moreover' },
    '古': { pinyin: 'gǔ', meaning: 'ancient' },
    '只': { pinyin: 'zhǐ', meaning: 'only' },
    '各': { pinyin: 'gè', meaning: 'each' },
    '夫': { pinyin: 'fū', meaning: 'husband' },
    '见': { pinyin: 'jiàn', meaning: 'see' },
    '卜': { pinyin: 'bǔ', meaning: 'divine' },
    '巴': { pinyin: 'bā', meaning: 'hope' },
    '午': { pinyin: 'wǔ', meaning: 'noon' },
    '由': { pinyin: 'yóu', meaning: 'reason' },
    '立': { pinyin: 'lì', meaning: 'stand' },
    '寺': { pinyin: 'sì', meaning: 'temple' },
    '果': { pinyin: 'guǒ', meaning: 'fruit' },
    '羊': { pinyin: 'yáng', meaning: 'sheep' },
    '皮': { pinyin: 'pí', meaning: 'skin' },
    '谷': { pinyin: 'gǔ', meaning: 'valley' },
    '欠': { pinyin: 'qiàn', meaning: 'owe' },
    '免': { pinyin: 'miǎn', meaning: 'avoid' },
    '包': { pinyin: 'bāo', meaning: 'wrap' },
    '交': { pinyin: 'jiāo', meaning: 'exchange' },
    '夭': { pinyin: 'yāo', meaning: 'tender' },
    '申': { pinyin: 'shēn', meaning: 'extend' },
    '占': { pinyin: 'zhān', meaning: 'occupy' },
    '韦': { pinyin: 'wéi', meaning: 'leather' },
    '专': { pinyin: 'zhuān', meaning: 'special' },
    '令': { pinyin: 'lìng', meaning: 'command' },
    '肖': { pinyin: 'xiào', meaning: 'resemble' },
    '司': { pinyin: 'sī', meaning: 'manage' },
    '至': { pinyin: 'zhì', meaning: 'arrive' },
    '才': { pinyin: 'cái', meaning: 'talent' },
    '平': { pinyin: 'píng', meaning: 'flat' },
    '勿': { pinyin: 'wù', meaning: 'do not' },
    '斤': { pinyin: 'jīn', meaning: 'axe' },
    '雨': { pinyin: 'yǔ', meaning: 'rain' },
    '辛': { pinyin: 'xīn', meaning: 'bitter' },
    '音': { pinyin: 'yīn', meaning: 'sound' },
    '章': { pinyin: 'zhāng', meaning: 'chapter' },
    '戈': { pinyin: 'gē', meaning: 'weapon' },
    '成': { pinyin: 'chéng', meaning: 'become' },
    '弓': { pinyin: 'gōng', meaning: 'bow' },
    '及': { pinyin: 'jí', meaning: 'reach' },
    '丁': { pinyin: 'dīng', meaning: 'nail' },
    '可': { pinyin: 'kě', meaning: 'can' },
    '加': { pinyin: 'jiā', meaning: 'add' },
    '合': { pinyin: 'hé', meaning: 'combine' },
    '豆': { pinyin: 'dòu', meaning: 'bean' },
    '采': { pinyin: 'cǎi', meaning: 'pick' },
    '番': { pinyin: 'fān', meaning: 'foreign' },
    '京': { pinyin: 'jīng', meaning: 'capital' },
    '亢': { pinyin: 'kàng', meaning: 'high' },
    '尺': { pinyin: 'chǐ', meaning: 'ruler' },
    '勺': { pinyin: 'sháo', meaning: 'spoon' },
    '匕': { pinyin: 'bǐ', meaning: 'spoon' },
    '比': { pinyin: 'bǐ', meaning: 'compare' },
    '弗': { pinyin: 'fú', meaning: 'not' },
    '非': { pinyin: 'fēi', meaning: 'not' },
    '失': { pinyin: 'shī', meaning: 'lose' },
    '央': { pinyin: 'yāng', meaning: 'center' },
    '夹': { pinyin: 'jiā', meaning: 'clip' },
    '皿': { pinyin: 'mǐn', meaning: 'dish' },
    '斗': { pinyin: 'dǒu', meaning: 'fight' },
    '网': { pinyin: 'wǎng', meaning: 'net' },
    '虫': { pinyin: 'chóng', meaning: 'insect' },
    '风': { pinyin: 'fēng', meaning: 'wind' },
    '马': { pinyin: 'mǎ', meaning: 'horse' },
    '鸟': { pinyin: 'niǎo', meaning: 'bird' },
    '鱼': { pinyin: 'yú', meaning: 'fish' },
    '羽': { pinyin: 'yǔ', meaning: 'feather' },
    '角': { pinyin: 'jiǎo', meaning: 'horn' },
    '血': { pinyin: 'xuè', meaning: 'blood' },
    '肉': { pinyin: 'ròu', meaning: 'meat' },
    '舟': { pinyin: 'zhōu', meaning: 'boat' },
    '行': { pinyin: 'háng', meaning: 'go' },
    '色': { pinyin: 'sè', meaning: 'color' },
    '衤': { pinyin: 'yī', meaning: 'clothes' },
    '纟': { pinyin: 'sī', meaning: 'silk' },
    '忄': { pinyin: 'xīn', meaning: 'heart' },
    '疒': { pinyin: 'nì', meaning: 'illness' },
    '辶': { pinyin: 'chuò', meaning: 'walk' },
    '廴': { pinyin: 'yǐn', meaning: 'stride' },
    '卩': { pinyin: 'jié', meaning: 'seal' },
    '彳': { pinyin: 'chì', meaning: 'step' },
    '宁': { pinyin: 'níng', meaning: 'peaceful' },
    '乃': { pinyin: 'nǎi', meaning: 'thus' },
    '尧': { pinyin: 'yáo', meaning: 'Yao' },
    '殳': { pinyin: 'shū', meaning: 'weapon' },
    '隹': { pinyin: 'zhuī', meaning: 'short-tailed bird' },
    '奇': { pinyin: 'qí', meaning: 'strange' },
    '莫': { pinyin: 'mò', meaning: 'none' },
    '皆': { pinyin: 'jiē', meaning: 'all' },
    '乔': { pinyin: 'qiáo', meaning: 'tall' },
    '甬': { pinyin: 'yǒng', meaning: 'path' }
};

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
}

function parseDecomposition(decomposition) {
    if (!decomposition || decomposition === '？' || decomposition.length < 2) {
        return null;
    }

    const idsChar = decomposition[0];
    const type = IDS_TYPE_MAP[idsChar];

    if (!type) {
        return null;
    }

    // Extract component characters (skip the IDS character)
    // Handle nested decompositions by only taking immediate children
    const components = [];
    let i = 1;

    while (i < decomposition.length && components.length < 2) {
        const char = decomposition[i];
        // Skip IDS characters in nested decompositions
        if (IDS_TYPE_MAP[char]) {
            // Skip nested structure - find matching component
            let depth = 1;
            i++;
            while (i < decomposition.length && depth > 0) {
                if (IDS_TYPE_MAP[decomposition[i]]) depth++;
                else depth--;
                i++;
            }
            continue;
        }
        if (char !== '？') {
            components.push(char);
        }
        i++;
    }

    // Need exactly 2 components for our quiz mode
    if (components.length !== 2) {
        return null;
    }

    return { type, components };
}

function flattenMatches(matches) {
    // Make Me a Hanzi uses nested arrays [[0], [0], [1], [1]]
    // We need flat array [0, 0, 1, 1]
    if (!matches || !Array.isArray(matches)) return null;

    const flat = [];
    for (const m of matches) {
        if (m === null) return null; // Can't use characters with null matches
        if (Array.isArray(m)) {
            // Take first element of nested array
            if (m.length > 0 && typeof m[0] === 'number') {
                flat.push(m[0]);
            } else {
                return null;
            }
        } else if (typeof m === 'number') {
            flat.push(m);
        } else {
            return null;
        }
    }
    return flat;
}

async function main() {
    const outputFile = process.argv[2] || 'data/decompositions.json';

    console.log('Fetching Make Me a Hanzi dictionary...');
    const data = await fetch(DICTIONARY_URL);

    console.log('Parsing dictionary...');
    const lines = data.trim().split('\n');

    // Build lookup map for pinyin/definition
    const charLookup = {};
    const entries = [];

    for (const line of lines) {
        try {
            const entry = JSON.parse(line);
            charLookup[entry.character] = {
                pinyin: entry.pinyin?.[0] || '',
                definition: entry.definition || ''
            };
            entries.push(entry);
        } catch (e) {
            // Skip malformed lines
        }
    }

    console.log(`Loaded ${entries.length} characters`);

    // Build decomposition data
    const decompositions = {};
    let count = 0;

    for (const entry of entries) {
        const { character, decomposition, matches } = entry;

        // Parse decomposition
        const parsed = parseDecomposition(decomposition);
        if (!parsed) continue;

        // Flatten matches
        const flatMatches = flattenMatches(matches);
        if (!flatMatches) continue;

        // Get component info
        const componentData = parsed.components.map(comp => {
            // First check common radicals
            if (COMMON_RADICALS[comp]) {
                return {
                    char: comp,
                    pinyin: COMMON_RADICALS[comp].pinyin,
                    meaning: COMMON_RADICALS[comp].meaning
                };
            }
            // Then check dictionary lookup
            const lookup = charLookup[comp];
            if (lookup && lookup.pinyin) {
                return {
                    char: comp,
                    pinyin: lookup.pinyin,
                    meaning: lookup.definition ? lookup.definition.split(';')[0].split(',')[0].trim() : ''
                };
            }
            // Fallback
            return {
                char: comp,
                pinyin: '',
                meaning: ''
            };
        });

        // Only include if we have pinyin for both components
        if (!componentData[0].pinyin || !componentData[1].pinyin) {
            continue;
        }

        decompositions[character] = {
            components: componentData,
            type: parsed.type,
            matches: flatMatches
        };
        count++;
    }

    console.log(`Generated ${count} decomposition entries`);

    // Ensure output directory exists
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write output
    fs.writeFileSync(outputFile, JSON.stringify(decompositions, null, 2));
    console.log(`Wrote ${outputFile}`);

    // Also output some stats
    const types = {};
    for (const [char, data] of Object.entries(decompositions)) {
        types[data.type] = (types[data.type] || 0) + 1;
    }
    console.log('Decomposition types:', types);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
