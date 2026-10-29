const TAG_RULES: Array<{ tag: string; patterns: RegExp[]; weight?: number }> = [
  { tag: "殉情", patterns: [/殉情/, /為.{0,8}(她|他).{0,8}(死|赴死|自盡)/, /守墓.{0,12}(死|殉)/, /陪.{0,6}(她|他).{0,6}(死|赴死)/], weight: 3 },
  { tag: "無限流", patterns: [/無限流/, /副本/, /闖關/, /輪迴世界/, /生存遊戲/, /規則怪談/], weight: 3 },
  { tag: "雙向奔赴", patterns: [/雙向奔赴/, /互相.{0,6}(喜歡|愛|暗戀)/, /彼此.{0,6}(救贖|奔赴|深愛)/], weight: 3 },
  { tag: "雙向暗戀", patterns: [/雙向暗戀/, /互相暗戀/, /原來.{0,8}(他|她).{0,6}也.{0,4}(喜歡|愛)/], weight: 3 },
  { tag: "追妻火葬場", patterns: [/追妻火葬場/, /追妻/, /後悔.{0,8}(追回|挽回)/, /離婚後.{0,12}(追|後悔)/], weight: 2 },
  { tag: "重生復仇", patterns: [/重生.{0,20}(復仇|報仇|改寫|手撕)/, /(慘死|前世).{0,16}重生/], weight: 3 },
  { tag: "重生", patterns: [/重生/, /前世/, /一朝重來/, /再活一世/] },
  { tag: "穿書", patterns: [/穿書/, /穿進.{0,8}(小說|書中)/, /紙片人/] },
  { tag: "穿越", patterns: [/穿越/, /穿到.{0,8}(古代|現代|異世)/] },
  { tag: "系統", patterns: [/系統/, /任務面板/, /攻略任務/] },
  { tag: "讀心術", patterns: [/讀心/, /心聲/] },
  { tag: "救贖", patterns: [/救贖/, /治癒.{0,8}(他|她)/, /拉.{0,4}(他|她).{0,8}(深淵|黑暗)/] },
  { tag: "偏執男主", patterns: [/偏執.{0,6}(大佬|男|總裁)/, /瘋批.{0,6}(男|大佬|總裁)/, /佔有慾.{0,6}(爆棚|拉滿|極強)/] },
  { tag: "先婚後愛", patterns: [/先婚後愛/, /閃婚/, /契約.{0,6}(婚姻|結婚)/] },
  { tag: "破鏡重圓", patterns: [/破鏡重圓/, /久別重逢/, /多年後.{0,8}重逢/] },
  { tag: "青梅竹馬", patterns: [/青梅竹馬/, /一起長大/] },
  { tag: "替身", patterns: [/替身/, /白月光.{0,10}替/] },
  { tag: "娛樂圈", patterns: [/娛樂圈/, /影帝/, /影后/, /頂流/, /明星/] },
  { tag: "校園", patterns: [/校園/, /高中/, /同校/, /學長/, /學妹/] },
  { tag: "甜寵", patterns: [/甜寵/, /寵妻/, /寵她/, /甜蜜/] },
  { tag: "虐戀", patterns: [/虐戀/, /虐心/, /愛而不得/] },
  { tag: "復仇", patterns: [/復仇/, /報仇/, /手撕.{0,8}(渣|仇)/] },
  { tag: "逆襲", patterns: [/逆襲/, /打臉/, /翻身/] },
  { tag: "馬甲", patterns: [/馬甲/, /隱藏身份/, /身份曝光/] },
];

const CATEGORY_RULES: Record<string, RegExp[]> = {
  "甜寵": [/甜寵/, /寵妻/, /甜蜜/], "霸總": [/霸總/, /總裁/, /豪門/], "復仇": [/復仇/, /報仇/, /手撕/],
  "古裝": [/古裝/, /古代/, /王爺/, /皇帝/, /攝政王/], "穿越": [/穿越/, /穿書/, /穿到/], "重生": [/重生/, /前世/],
  "懸疑": [/懸疑/, /謎案/, /兇手/, /查案/], "都市": [/都市/, /總裁/, /職場/], "民國": [/民國/],
  "奇幻": [/奇幻/, /玄幻/, /修仙/, /異能/], "科幻": [/科幻/, /星際/, /末世/], "喜劇": [/喜劇/, /搞笑/, /沙雕/],
};

function compact(text: string): string { return text.replace(/\s+/g, " ").trim(); }

export function extractStoryTags(input: { title?: string; synopsis?: string; sourceTags?: string[] }, limit = 6): string[] {
  const text = compact([input.title ?? "", input.synopsis ?? "", ...(input.sourceTags ?? [])].join(" "));
  if (!text) return [];
  return TAG_RULES.map((rule, index) => ({ tag: rule.tag, score: rule.patterns.reduce((n, p) => n + (p.test(text) ? (rule.weight ?? 1) : 0), 0), index }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).map((x) => x.tag);
}

export function matchExistingCategories(input: { title?: string; synopsis?: string; sourceTags?: string[] }, available: string[]): string[] {
  const text = compact([input.title ?? "", input.synopsis ?? "", ...(input.sourceTags ?? [])].join(" "));
  const normalized = new Map(available.map((x) => [x.trim().toLowerCase(), x]));
  const out = new Set<string>();
  for (const raw of input.sourceTags ?? []) { const hit = normalized.get(raw.trim().toLowerCase()); if (hit) out.add(hit); }
  for (const category of available) {
    const rules = CATEGORY_RULES[category];
    if (rules?.some((p) => p.test(text))) out.add(category);
  }
  return [...out];
}

/** 免費本機版：不捏造新劇情，只重排來源簡介，讓開頭更像追劇推薦。 */
export function makeHookedSynopsis(synopsis: string): string {
  const source = compact(synopsis);
  if (!source) return "";
  const sentences = source.split(/(?<=[。！？!?])/).map((x) => x.trim()).filter(Boolean);
  if (sentences.length < 2) return source;
  const hookWords = /(慘死|重生|殉情|秘密|真相|背叛|復仇|偏執|瘋批|暗戀|救贖|失憶|穿越|穿書|副本|危機|意外|命運|追妻|守墓)/;
  const ranked = sentences.map((sentence, index) => ({ sentence, index, score: hookWords.test(sentence) ? 2 : 0 }));
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  const lead = ranked[0];
  const rest = sentences.filter((_, i) => i !== lead.index);
  return [lead.sentence, ...rest].join("").slice(0, 2000);
}
