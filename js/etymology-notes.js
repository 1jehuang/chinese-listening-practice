// Short etymology notes for common Chinese characters
// Format: One concise sentence explaining the character's composition and meaning
// Style: "[Character] combines [components] - [brief meaningful explanation]"

const ETYMOLOGY_NOTES = {
    // Top 50 most common characters
    // Format: Accurate etymologies based on historical character structure
    "的": "的 uses 白 (white) radical with 勺 (sháo) as phonetic component - originally meant 'bright/clear', now possessive particle.",
    "一": "一 is a single horizontal line - representing the number one.",
    "是": "是 uses 日 (sun) radical with 正 (zhèng) beneath - originally 'correct/straight', evolved to mean 'to be'.",
    "不": "不 depicts a bird trying to fly upward but being blocked - expressing negation.",
    "了": "了 shows a child with bent legs wrapped up - something finished or completed.",
    "人": "人 depicts a person standing in profile with legs visible - a human being.",
    "我": "我 shows a hand holding a weapon (戈 halberd) - asserting oneself, meaning 'I/me'.",
    "在": "在 uses 土 (earth) radical with 才 (cái) as phonetic - being present at a location.",
    "有": "有 shows a hand 又 grasping meat 月 - possessing or having something.",
    "他": "他 uses 亻 (person) radical with 也 (yě) as phonetic - referring to another person 'he/him'.",
    "这": "这 uses 辶 (walking) with 言 (words) - indicating what's near 'this'.",
    "中": "中 shows an arrow piercing the center of a target - the middle or center.",
    "大": "大 depicts a person with arms and legs spread wide - expressing largeness.",
    "来": "来 originally depicted wheat plants - the harvest coming, hence 'to come'.",
    "上": "上 shows a line above a baseline - indicating upward direction or position.",
    "国": "国 uses 囗 (enclosure) with 玉 (jade) inside - precious territory enclosed, a country.",
    "个": "个 shows a bamboo 竹 section standing alone - a general measure word for individual items.",
    "到": "到 uses 至 (arrive) with 刂 (knife) - reaching a destination.",
    "说": "说 uses 言 (words) radical with 兑 (duì) as phonetic - to speak or say.",
    "们": "们 uses 亻 (person) radical with 门 (mén) as phonetic - plural marker for people.",
    "为": "为 originally showed a hand leading an elephant - doing or acting for a purpose.",
    "子": "子 depicts a baby with large head and small body - a child or son.",
    "和": "和 uses 禾 (grain) radical with 口 (mouth) - harmony, peaceful togetherness.",
    "你": "你 uses 亻 (person) radical with 尔 (ěr) as phonetic - the person being addressed 'you'.",
    "地": "地 uses 土 (earth) radical with 也 (yě) as phonetic - the ground or land.",
    "出": "出 shows something emerging from an enclosure - going out or exiting.",
    "道": "道 uses 辶 (walking) with 首 (head) - the path or way to follow.",
    "也": "也 originally depicted a serpent - borrowed for grammatical use meaning 'also'.",
    "时": "时 uses 日 (sun) radical with 寺 (sì) as phonetic - marking time.",
    "年": "年 originally showed a person carrying grain - the annual harvest cycle, a year.",
    "得": "得 uses 彳 (step) radical with 寸 (hand) on right - obtaining or getting something.",
    "就": "就 uses 京 (capital) with 尤 (yóu) - approaching or moving toward, meaning 'then/already'.",
    "那": "那 uses 阝 (city) radical with 冄 (nǎ) as phonetic - indicating 'that' place over there.",
    "要": "要 depicts a woman 女 with hands demanding 覀 - wanting or needing something.",
    "下": "下 shows a line below a baseline - indicating downward direction or position.",
    "以": "以 originally showed a person with a tool - using means or methods.",
    "生": "生 shows a sprout emerging from ground - being born or living.",
    "会": "会 originally showed a lid over a container - coming together, able to gather or meet.",
    "家": "家 uses 宀 (roof) with 豕 (pig) - a pig under roof represents a home.",
    "可": "可 uses 口 (mouth) with 丁 (nail) - mouth fixed in approval, meaning 'can/may'.",
    "后": "后 originally depicted a foot walking slowly - coming after or behind.",
    "过": "过 uses 辶 (walking) with 咼 (guō) as phonetic - passing through or by.",
    "天": "天 shows a person 大 with line above the head - the sky or heaven above.",
    "能": "能 originally depicted a bear (powerful animal) - having ability or capability.",
    "好": "好 uses 女 (woman) and 子 (child) together - a mother with child represents goodness.",
    "多": "多 shows two 夕 (evening) stacked - many evenings passing, meaning 'much/many'.",
    "然": "然 shows 月 (meat radical) above fire 灬 - originally 'to burn', evolved to mean 'so/thus'.",
    "自": "自 depicts a nose - pointing to oneself to mean 'self' or 'from'.",
    "着": "着 uses 目 (eye) radical with 羊 (yáng) as phonetic - attaching to or wearing.",
    "去": "去 shows a person in a container departing - leaving or going away.",

    // Add more as needed - structure is ready for all 2500 characters
    "意": "意 uses 音 (sound) above 心 (heart) - thoughts and intentions arising from the heart.",
    "前": "前 shows 止 (foot) advancing with 刂 (knife) cutting ahead - moving to the front or before."
};

// Export for use in quiz engine
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ETYMOLOGY_NOTES };
}
