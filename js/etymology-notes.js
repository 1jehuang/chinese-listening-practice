// Short etymology notes for common Chinese characters
// Format: One concise sentence explaining the character's composition and meaning
// Style: "[Character] combines [components] - [brief meaningful explanation]"

const ETYMOLOGY_NOTES = {
    // Top 50 most common characters
    "的": "的 combines 白 (white/target) and 勺 (spoon) - hitting the white target, being precise about possession.",
    "一": "一 is a single horizontal line - the simplest representation of the number one.",
    "是": "是 combines 日 (sun) above 正 (correct) - as certain and bright as the sun, expressing 'to be'.",
    "不": "不 shows a bird flying up toward the sky but not reaching it - expressing negation.",
    "了": "了 shows a child wrapped in swaddling clothes - something completed and finished.",
    "人": "人 depicts the legs of a person standing - representing a human being.",
    "我": "我 combines 手 (hand) and 戈 (weapon) - asserting oneself with a weapon in hand.",
    "在": "在 combines 土 (earth) and 才 (talent/just) - talent rooted in the earth, being present at a place.",
    "有": "有 shows a hand 又 holding meat 月 - possessing something tangible.",
    "他": "他 combines 亻 (person) and 也 (also) - also a person, referring to 'him'.",
    "这": "这 combines 辶 (walking) and 言 (words) - walking toward what's being spoken of, meaning 'this'.",
    "中": "中 shows an arrow piercing the center of a target - the middle or center.",
    "大": "大 depicts a person with arms stretched wide - expressing bigness.",
    "来": "来 originally showed wheat plants - harvest coming in, hence 'to come'.",
    "上": "上 shows a line above a base - indicating upward direction.",
    "国": "国 combines 囗 (enclosure) and 玉 (jade) - precious territory enclosed, meaning country.",
    "个": "个 shows a bamboo stalk 竹 standing individually 丨 - a general measure word.",
    "到": "到 combines 至 (arrive) and 刂 (knife) - cutting straight to reach a destination.",
    "说": "说 combines 言 (words) and 兑 (exchange) - exchanging words, to speak.",
    "们": "们 combines 亻 (person) and 门 (door/gate) - many people at the gate, plural marker.",
    "为": "为 shows a hand leading an elephant - doing something for a purpose.",
    "子": "子 depicts a baby with arms outstretched - a child or son.",
    "和": "和 combines 禾 (grain) and 口 (mouth) - harmony like grain feeding mouths.",
    "你": "你 combines 亻 (person) and 尔 (you/that) - that person, meaning 'you'.",
    "地": "地 combines 土 (earth) and 也 (also) - the earth beneath, land or ground.",
    "出": "出 shows a sprout emerging from earth - going out or coming forth.",
    "道": "道 combines 辶 (walking) and 首 (head) - the path your head leads you on.",
    "也": "也 originally depicted a snake - extending meaning to 'also' or 'too'.",
    "时": "时 combines 日 (sun) and 寺 (temple) - marking time by the sun's position.",
    "年": "年 shows a person carrying grain - the cycle of harvest, meaning year.",
    "得": "得 combines 彳 (step) and 寸 (hand) - stepping forward to obtain something.",
    "就": "就 combines 京 (capital) and 尤 (especially) - approaching prominence, meaning 'then' or 'at once'.",
    "那": "那 combines 阝 (city) and 那 (phonetic) - that place over there.",
    "要": "要 shows a woman 女 with arms 覀 demanding - wanting or needing something.",
    "下": "下 shows a line below a base - indicating downward direction.",
    "以": "以 shows a person following another - using or employing means.",
    "生": "生 shows a plant sprouting from earth - being born or living.",
    "会": "会 combines 人 (person) and 云 (cloud) - people gathering like clouds, able to meet.",
    "家": "家 combines 宀 (roof) and 豕 (pig) - a pig under a roof, representing home.",
    "可": "可 combines 口 (mouth) and 丁 (nail) - firmly spoken approval, meaning 'can' or 'may'.",
    "后": "后 shows a foot delayed in walking - coming after or behind.",
    "过": "过 combines 辶 (walking) and 咼 (twisted) - walking through or passing by.",
    "天": "天 shows a person 大 with emphasis on the head 一 - the sky above one's head.",
    "能": "能 originally depicted a bear - powerful and able, meaning 'can'.",
    "好": "好 combines 女 (woman) and 子 (child) - a woman with child, expressing goodness.",
    "多": "多 shows two pieces of meat 夕 - having much or many.",
    "然": "然 combines 肉 (meat) and 火 (fire) - meat burning in fire, expressing 'so' or 'thus'.",
    "自": "自 depicts a nose - pointing to oneself, meaning 'self'.",
    "着": "着 combines 目 (eye) and 羊 (sheep) - keeping eyes on target, attached to something.",
    "去": "去 shows a person leaving a container - going away or departing.",

    // Add more as needed - structure is ready for all 2500 characters
    "意": "意 combines 音 (sound) above 心 (heart) - your intentions are the sounds that emerge from your heart.",
    "前": "前 combines 刂 (knife) clearing the path and 止 (foot) moving forward - cutting ahead to reach the front."
};

// Export for use in quiz engine
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ETYMOLOGY_NOTES };
}
