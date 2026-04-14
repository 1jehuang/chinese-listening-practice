window.__LESSON_DATASETS__ = window.__LESSON_DATASETS__ || {};

const gaokaoPart1 = [
  { char: '高考', pinyin: 'gāokǎo', meaning: 'the national college entrance examination', category: 'Nouns' },
  { char: '举行', pinyin: 'jǔxíng', meaning: 'to hold; to conduct', category: 'Common Verbs' },
  { char: '入学', pinyin: 'rùxué', meaning: 'to enter school; to matriculate', category: 'Common Verbs' },
  { char: '重要', pinyin: 'zhòngyào', meaning: 'important', category: 'Adjectives' },
  { char: '决定', pinyin: 'juédìng', meaning: 'to determine; to decide', category: 'Common Verbs' },
  { char: '进入', pinyin: 'jìnrù', meaning: 'to enter; to get into', category: 'Common Verbs' },
  { char: '整个儿', pinyin: 'zhěnggèr', meaning: 'whole; entire', category: 'Adjectives' },
  { char: '发展', pinyin: 'fāzhǎn', meaning: 'to develop', category: 'Common Verbs' },
  { char: '固然', pinyin: 'gùrán', meaning: 'it is true that; admittedly', category: 'Connectives' },
  { char: '负面', pinyin: 'fùmiàn', meaning: 'negative', category: 'Adjectives' },
  { char: '死记硬背', pinyin: 'sǐjì yìngbèi', meaning: 'to memorize by rote', category: 'Common Phrases' },
  { char: '缺乏', pinyin: 'quēfá', meaning: 'to lack; to be short of', category: 'Common Verbs' },
  { char: '分析', pinyin: 'fēnxī', meaning: 'to analyze; analysis', category: 'Common Verbs' },
  { char: '理解', pinyin: 'lǐjiě', meaning: 'to understand; to comprehend', category: 'Common Verbs' }
];

window.__LESSON_DATASETS__['gaokao'] = {
  vocab: {
    part1: gaokaoPart1
  },
  charMap: gaokaoPart1,
  sentenceMode: {
    difficulties: [
      { id: 'micro', label: 'Micro', description: 'Ultra-short phrases and clauses.' },
      { id: 'tiny', label: 'Tiny', description: 'Short sentences with one strong clue.' },
      { id: 'basic', label: 'Basic', description: 'Complete sentences with simple context.' },
      { id: 'source-lite', label: 'Source Lite', description: 'Lightly trimmed lines from the reading.' },
      { id: 'source', label: 'Source', description: 'Real lines from the 高考 reading.' },
      { id: 'source-full', label: 'Source Full', description: 'Longest original source sentences.' }
    ],
    items: [
      { difficulty: 'micro', target: '高考', sentence: '大家都怕高考。', meaning: 'Everyone is afraid of the gaokao.' },
      { difficulty: 'micro', target: '入学', sentence: '他们九月入学。', meaning: 'They start school in September.' },
      { difficulty: 'micro', target: '重要', sentence: '这个考试很重要。', meaning: 'This exam is important.' },
      { difficulty: 'micro', target: '决定', sentence: '成绩决定机会。', meaning: 'Scores determine opportunities.' },
      { difficulty: 'micro', target: '进入', sentence: '他想进入北大。', meaning: 'He wants to enter Peking University.' },
      { difficulty: 'micro', target: '发展', sentence: '学生要发展兴趣。', meaning: 'Students should develop their interests.' },
      { difficulty: 'micro', target: '分析', sentence: '老师要分析问题。', meaning: 'The teacher wants to analyze the problem.' },
      { difficulty: 'micro', target: '理解', sentence: '我能理解他的想法。', meaning: 'I can understand his idea.' },

      { difficulty: 'tiny', target: '举行', sentence: '六月举行高考。', meaning: 'The gaokao is held in June.' },
      { difficulty: 'tiny', target: '整个儿', sentence: '整个儿高中都在准备。', meaning: 'The whole high-school period is spent preparing.' },
      { difficulty: 'tiny', target: '固然', sentence: '高考固然重要，但是压力很大。', meaning: 'The gaokao is certainly important, but the pressure is great.' },
      { difficulty: 'tiny', target: '负面', sentence: '这种做法有负面的影响。', meaning: 'This approach has negative effects.' },
      { difficulty: 'tiny', target: '死记硬背', sentence: '学生不应该只会死记硬背。', meaning: 'Students should not only know rote memorization.' },
      { difficulty: 'tiny', target: '缺乏', sentence: '有些学生缺乏训练。', meaning: 'Some students lack training.' },

      { difficulty: 'basic', target: '高考', sentence: '中国人把这个考试叫做高考。', meaning: 'Chinese people call this exam the gaokao.' },
      { difficulty: 'basic', target: '重要', sentence: '这是全国高中生最重要的一个考试。', meaning: 'This is the most important exam for high-school students across China.' },
      { difficulty: 'basic', target: '决定', sentence: '这个考试不但决定他们进入哪所大学，同时也决定了他们以后四年的专业是什么。', meaning: 'This exam not only determines which university they enter, but also what their major will be for the next four years.' },
      { difficulty: 'basic', target: '发展', sentence: '学生很少有机会发展自己的兴趣。', meaning: 'Students rarely have the chance to develop their own interests.' },

      { difficulty: 'source-lite', target: '举行', sentence: '每年六月，中国各地同时举行大学的入学考试。', meaning: 'Every June, college entrance examinations are held simultaneously across China.' },
      { difficulty: 'source-lite', target: '高考', sentence: '中国人把这个考试叫做高考。', meaning: 'Chinese people call this exam the gaokao.' },
      { difficulty: 'source-lite', target: '进入', sentence: '这个考试不但决定他们进入哪所大学。', meaning: 'This exam determines which university they enter.' },
      { difficulty: 'source-lite', target: '发展', sentence: '学生很少有机会发展自己的兴趣。', meaning: 'Students rarely have the chance to develop their own interests.' },

      { difficulty: 'source', target: '整个儿', sentence: '我和几位北京的老师聊天儿，发现中国整个儿高中教育几乎都是在为高考做准备。', meaning: 'After chatting with several teachers in Beijing, I discovered that almost the entirety of Chinese high-school education is spent preparing for the gaokao.' },
      { difficulty: 'source', target: '死记硬背', sentence: '许多高中学生只知道死记硬背，而缺乏分析和理解的训练。', meaning: 'Many high-school students only know rote memorization and lack training in analysis and understanding.' },
      { difficulty: 'source', target: '固然', sentence: '高考这个制度固然有些负面的影响。', meaning: 'The gaokao system certainly has some negative effects.' },
      { difficulty: 'source', target: '理解', sentence: '许多高中学生只知道死记硬背，而缺乏分析和理解的训练。', meaning: 'Many high-school students only know rote memorization and lack training in analysis and understanding.' },

      { difficulty: 'source-full', target: '决定', sentence: '这个考试不但决定他们进入哪所大学，同时也决定了他们以后四年的专业是什么。', meaning: 'This exam not only determines which university they enter, but also what their major will be for the next four years.' },
      { difficulty: 'source-full', target: '负面', sentence: '高考这个制度固然有些负面的影响，使许多高中学生只知道死记硬背，而缺乏分析和理解的训练，但是这个考试制度却体现了公平竞争的精神。', meaning: 'Although the gaokao system certainly has some negative effects, causing many high-school students to rely only on rote memorization and lack training in analysis and understanding, this exam system also embodies the spirit of fair competition.' }
    ]
  }
};
