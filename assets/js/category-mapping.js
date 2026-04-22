export const UNCATEGORIZED_LABEL = "Kategorizálatlan";

export const CATEGORY_MAP = [
  {
    id: "cipo",
    label: "Cipő",
    aliases: ["cipő", "cipo"],
    keywords: {
      hu: ["cipő", "cipo", "sportcipő", "sportcipo", "bakancs"],
      en: ["shoe", "shoes", "sneaker", "sneakers", "running shoes", "basketball shoes", "dunk"],
      cn: ["鞋", "鞋子", "运动鞋", "跑步鞋", "篮球鞋", "休闲鞋", "徒步", "越野", "户外", "低帮", "高帮", "DUNK"],
    },
  },
  {
    id: "taska",
    label: "Táska",
    aliases: ["táska", "taska"],
    keywords: {
      hu: ["táska", "taska", "hátizsák", "hatizsak", "oldaltáska", "oldaltaska", "bevásárlótáska"],
      en: ["bag", "bags", "backpack", "shoulder bag", "crossbody bag", "tote", "tote bag", "bucket bag", "shopping bag", "travel bag", "school bag", "cosmetic bag"],
      cn: ["包", "背包", "双肩包", "手提包", "单肩包", "斜挎包", "托特包", "水桶包", "购物袋", "旅行包", "书包", "化妆包"],
    },
  },
  {
    id: "ruha",
    label: "Ruha",
    aliases: ["ruha", "ruházat", "ruhazat"],
    keywords: {
      hu: ["ruha", "felső", "felso", "póló", "polo", "ing", "pulóver", "pulover", "szoknya"],
      en: ["clothing", "clothes", "dress", "top", "jacket", "short sleeve", "long sleeve", "outfit", "hoodie", "sweater", "shirt", "t-shirt"],
      cn: ["衣", "上衣", "外套", "短袖", "长袖", "套装", "卫衣", "毛衣", "连衣裙", "衬衫", "T恤"],
    },
  },
  {
    id: "sapka",
    label: "Sapka",
    aliases: ["sapka"],
    keywords: {
      hu: ["sapka", "kalap", "baseball sapka", "kötött sapka", "kotott sapka"],
      en: ["cap", "hat", "baseball cap", "beanie", "knit hat"],
      cn: ["帽", "帽子", "棒球帽", "鸭舌帽", "毛线帽", "针织帽"],
    },
  },
  {
    id: "sal",
    label: "Sál",
    aliases: ["sál", "sal"],
    keywords: {
      hu: ["sál", "sal", "nyaksál", "nyaksal", "kendő", "kendo", "csősál", "csosal", "körsál", "korsal"],
      en: ["scarf", "neck scarf", "neck warmer", "shawl", "wrap", "loop scarf", "infinity scarf"],
      cn: ["围巾", "围脖", "披肩"],
    },
  },
  {
    id: "nadrag",
    label: "Nadrág",
    aliases: ["nadrág", "nadrag"],
    keywords: {
      hu: ["nadrág", "nadrag", "hosszúnadrág", "hosszu nadrag", "rövidnadrág", "rovidnadrag", "farmer"],
      en: ["pants", "trousers", "shorts", "jeans"],
      cn: ["裤", "长裤", "短裤", "牛仔裤"],
    },
  },
  {
    id: "kabat",
    label: "Kabát",
    aliases: ["kabát", "kabat"],
    keywords: {
      hu: ["kabát", "kabat", "dzseki", "pufi kabát", "pufi kabat"],
      en: ["coat", "jacket", "down jacket"],
      cn: ["外套", "夹克", "羽绒服"],
    },
  },
  {
    id: "melleny",
    label: "Mellény",
    aliases: ["mellény", "melleny"],
    keywords: {
      hu: ["mellény", "melleny"],
      en: ["vest"],
      cn: ["马甲"],
    },
  },
  {
    id: "furdoruha",
    label: "Fürdőruha",
    aliases: ["fürdőruha", "furdoruha"],
    keywords: {
      hu: ["fürdőruha", "furdoruha"],
      en: ["swimwear", "swimsuit"],
      cn: ["泳衣"],
    },
  },
];

export const CATEGORY_BY_ID = new Map(
  CATEGORY_MAP.map(function (category) {
    return [category.id, category];
  }),
);

const CATEGORY_BY_NORMALIZED_LABEL = new Map();

for (const category of CATEGORY_MAP) {
  const names = [category.id, category.label].concat(category.aliases || []);
  for (const name of names) {
    CATEGORY_BY_NORMALIZED_LABEL.set(normalizeTextForMatch(name), category);
  }
}

const UNMAPPED_STRICT_KEYWORDS = ["耳机", "钱包", "腰带"];

export function normalizeTextForMatch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function detectCategory(title) {
  const rawTitle = String(title || "");
  const normalizedTitle = normalizeTextForMatch(rawTitle);
  if (!normalizedTitle) {
    return "";
  }

  if (
    UNMAPPED_STRICT_KEYWORDS.some(function (keyword) {
      return rawTitle.includes(keyword);
    })
  ) {
    return "";
  }

  let bestCategory = null;
  let bestScore = 0;
  let bestSpecificity = 0;

  for (const category of CATEGORY_MAP) {
    const result = scoreCategory(category, rawTitle, normalizedTitle);
    if (
      result.score > bestScore ||
      (result.score === bestScore && result.specificity > bestSpecificity)
    ) {
      bestCategory = category;
      bestScore = result.score;
      bestSpecificity = result.specificity;
    } else if (
      result.score === bestScore &&
      result.specificity === bestSpecificity &&
      result.score > 0
    ) {
      bestCategory = null;
    }
  }

  return bestCategory && bestScore > 0 ? bestCategory.id : "";
}

export function findCategoryByKeyword(value) {
  const normalizedValue = normalizeTextForMatch(value);
  if (!normalizedValue) {
    return null;
  }

  const directMatch = CATEGORY_BY_NORMALIZED_LABEL.get(normalizedValue);
  if (directMatch) {
    return directMatch;
  }

  for (const category of CATEGORY_MAP) {
    const keywordGroups = category.keywords || {};
    for (const keywords of Object.values(keywordGroups)) {
      for (const keyword of keywords || []) {
        if (normalizeTextForMatch(keyword) === normalizedValue) {
          return category;
        }
      }
    }
  }

  return null;
}

export function expandSearchTerms(value) {
  const normalizedValue = normalizeTextForMatch(value);
  if (!normalizedValue) {
    return [];
  }

  const terms = new Set([normalizedValue]);
  const category = findCategoryByKeyword(normalizedValue);

  if (category) {
    Object.values(category.keywords || {}).forEach(function (keywords) {
      (keywords || []).forEach(function (keyword) {
        const normalizedKeyword = normalizeTextForMatch(keyword);
        if (normalizedKeyword) {
          terms.add(normalizedKeyword);
        }
      });
    });
  }

  return Array.from(terms);
}

export function normalizeCategoryId(value) {
  const normalizedValue = normalizeTextForMatch(value);
  const category = CATEGORY_BY_NORMALIZED_LABEL.get(normalizedValue);
  return category ? category.id : "";
}

export function getCategoryLabel(categoryId) {
  const category = CATEGORY_BY_ID.get(categoryId);
  return category ? category.label : UNCATEGORIZED_LABEL;
}

function scoreCategory(category, rawTitle, normalizedTitle) {
  const keywordGroups = category.keywords || {};
  let score = 0;
  let specificity = 0;

  for (const keyword of keywordGroups.cn || []) {
    if (containsCnKeyword(rawTitle, keyword)) {
      score += 2;
      specificity = Math.max(specificity, String(keyword || "").length);
    }
  }

  for (const keyword of keywordGroups.en || []) {
    if (containsLatinKeyword(normalizedTitle, keyword)) {
      score += 1;
      specificity = Math.max(specificity, normalizeTextForMatch(keyword).length);
    }
  }

  for (const keyword of keywordGroups.hu || []) {
    if (containsLatinKeyword(normalizedTitle, keyword)) {
      score += 1;
      specificity = Math.max(specificity, normalizeTextForMatch(keyword).length);
    }
  }

  return {
    score: score,
    specificity: specificity,
  };
}

function containsCnKeyword(rawTitle, keyword) {
  const value = String(keyword || "");
  return !!value && rawTitle.includes(value);
}

function containsLatinKeyword(normalizedTitle, keyword) {
  const normalizedKeyword = normalizeTextForMatch(keyword);
  if (!normalizedKeyword) {
    return false;
  }

  if (/^[a-z0-9 -]+$/i.test(normalizedKeyword)) {
    const pattern = new RegExp(
      "(^|[^a-z0-9])" + escapeRegExp(normalizedKeyword) + "([^a-z0-9]|$)",
      "i",
    );
    return pattern.test(normalizedTitle);
  }

  return normalizedTitle.includes(normalizedKeyword);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
