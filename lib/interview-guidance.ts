import {
  buildDimensionScores,
  DIMENSION_NAMES,
  extractTotalScore,
  normalizeTotalScore,
  type DimensionName,
} from './interview-feedback';

interface FeedbackSection {
  heading: string;
  title: string;
  content: string;
}

interface DimensionGuidanceTemplate {
  problem: string;
  action: string;
  review: string;
  goal: string;
}

export interface PracticePlanItem {
  day: string;
  focus: string;
  task: string;
  review: string;
  goal: string;
}

export interface InterviewGuidance {
  reportSummary: string;
  suggestions: string[];
  practicePlan: PracticePlanItem[];
}

const SECTION_HEADING_REGEX = /^([一二三四五六七八九十]+)、\s*([^\n]+)$/gm;
const MIN_SUGGESTION_COUNT = 5;
const PLAN_DAY_COUNT = 7;

const GUIDANCE_LIBRARY: Record<DimensionName, DimensionGuidanceTemplate> = {
  技术基础: {
    problem:
      '你的基础知识还停留在“知道名词”的阶段，一旦被追问原理、边界条件、优缺点或常见坑，回答就容易发散或者卡住，这会直接拉低技术可信度。',
    action:
      '把岗位高频基础知识拆成 10 到 15 个专题，每个专题固定按“定义、原理、使用场景、优缺点、常见误区、真实例子”写口述卡片。每天至少完成 3 个专题，并做 3 分钟不看稿复述。',
    review:
      '复盘时重点检查自己是不是只会背结论，不会展开原理；如果回答里没有边界条件、没有例子、没有对比，就说明这一题还没练到位。',
    goal:
      '下一轮面试里，基础题你能先给结论，再讲原理和例子，连续回答 3 题都不明显卡顿，也不出现概念混淆。',
  },
  项目经验: {
    problem:
      '你的项目表达还不够有说服力，容易停留在“做了哪些功能”，但缺少业务背景、个人贡献、关键取舍和结果指标，导致项目听起来像流水账。',
    action:
      '选择 1 到 2 个最能代表能力的项目，按“背景、目标、职责、方案、难点、结果、复盘”七段重写。每次练习都要强制补充你为什么这么做、有没有备选方案、结果指标是什么。',
    review:
      '复盘时重点看三件事：有没有把个人贡献讲清楚，有没有把技术决策的原因讲出来，有没有用结果数据证明项目价值。',
    goal:
      '下一次项目介绍时，你能在 3 到 5 分钟内完整说明业务目标、个人贡献、关键难点、技术取舍和量化结果，不再只是功能罗列。',
  },
  场景解决能力: {
    problem:
      '场景题暴露的是分析和落地能力，你当前的问题不是完全没有思路，而是回答没有稳定框架，容易一上来就给结论，导致方案不完整或答非所问。',
    action:
      '针对性能、并发、稳定性、扩展性、异常处理、监控告警等常见场景，每天练 3 题，固定按“问题澄清、约束条件、方案对比、最终选择、风险兜底”五步作答。',
    review:
      '复盘时检查自己有没有说清约束条件、有没有做方案对比、有没有提监控与回滚。如果答案里只有主方案，没有风险和兜底，说明场景题还没答完整。',
    goal:
      '下一轮回答场景题时，你能先说判断依据和约束，再展开方案与风险，不会漏掉监控、回滚、容灾、边界条件这些关键点。',
  },
  逻辑思维: {
    problem:
      '你现在的回答结构感还不够稳定，常见问题是重点后置、讲到一半换方向、信息顺序混乱。面试官听到这种表达，会直接认为你的思路不清楚。',
    action:
      '给自己固定一个表达模板，例如“结论、原因、展开、总结”。拿高频题做 2 分钟限时训练，要求每一题开头 15 秒内先给核心结论，再按顺序展开。',
    review:
      '复盘时重点听自己有没有绕圈子，有没有重复表达同一个意思，有没有先说细节后说结论。只要重点没有提前说出来，就要重新答一遍。',
    goal:
      '下一轮面试里，你的回答会更有层次，能明显减少跳跃、重复、重点后置这类影响得分的逻辑问题。',
  },
  表达流畅度: {
    problem:
      '表达流畅度不只是说话快慢，更关键的是信息密度和节奏控制。你需要练到一句话只承载一个重点，让面试官不用反复猜你的核心意思。',
    action:
      '每天做 3 轮 90 秒口述练习，内容可以是项目介绍、基础题解释或场景题回答。录音回放时删掉口头禅、模糊词、重复句和无效铺垫，并重新压缩答案。',
    review:
      '复盘时重点看三点：语速是否过快或过慢、是否总在句尾补无效解释、是否存在大量“这个、然后、其实、就是”这类口头禅。',
    goal:
      '下一轮回答时，你的语速更稳、停顿更自然、重点更靠前，面试官能更快抓住你的核心观点。',
  },
};

function normalizeFeedback(feedback: string) {
  return feedback.replace(/\r\n/g, '\n').trim();
}

function hasEvaluationSignals(feedback: string) {
  const normalizedFeedback = normalizeFeedback(feedback);
  return (
    extractTotalScore(normalizedFeedback) !== null ||
    /(技术基础|项目经验|场景解决能力|逻辑思维|表达流畅度)[：:]/.test(normalizedFeedback)
  );
}

function splitFeedbackSections(feedback: string) {
  const normalizedFeedback = normalizeFeedback(feedback);
  const matches = Array.from(normalizedFeedback.matchAll(SECTION_HEADING_REGEX));

  if (matches.length === 0) {
    return {
      prefix: normalizedFeedback,
      sections: [] as FeedbackSection[],
    };
  }

  const prefix = normalizedFeedback.slice(0, matches[0]?.index ?? 0).trim();
  const sections = matches.map((match, index) => {
    const start = match.index ?? 0;
    const bodyStart = start + match[0].length;
    const end =
      index + 1 < matches.length
        ? matches[index + 1].index ?? normalizedFeedback.length
        : normalizedFeedback.length;

    return {
      heading: match[1]?.trim() ?? '',
      title: match[2]?.trim() ?? '',
      content: normalizedFeedback.slice(bodyStart, end).trim(),
    };
  });

  return { prefix, sections };
}

function joinSections(sections: FeedbackSection[]) {
  return sections
    .map((section) => `${section.heading}、 ${section.title}\n${section.content}`.trim())
    .join('\n\n')
    .trim();
}

function isSuggestionSection(section: FeedbackSection) {
  return /(改进建议|提升建议|提升方向|改进方向)/.test(section.title);
}

function isPracticePlanSection(section: FeedbackSection) {
  return /(练习计划|学习计划|行动计划|训练计划)/.test(section.title);
}

function cleanListItem(text: string) {
  return text
    .replace(/^[\s\-•]+/, '')
    .replace(/^(?:建议|第\s*\d+\s*天)\s*[：:]/, '')
    .replace(/^(?:\d+|[一二三四五六七八九十]+)[、.．]\s*/, '')
    .trim();
}

function extractDimensionFromText(text: string) {
  return DIMENSION_NAMES.find((name) => text.includes(name));
}

function removeDimensionPrefix(text: string) {
  return text
    .replace(/^(技术基础|项目经验|场景解决能力|逻辑思维|表达流畅度)\s*[：:]\s*/, '')
    .trim();
}

function buildDetailedSuggestion(name: DimensionName, baseText?: string) {
  const template = GUIDANCE_LIBRARY[name];
  const mainText = baseText?.trim() || template.problem;
  const problemText = mainText.includes('当前主要问题：')
    ? mainText
    : `当前主要问题：${mainText}`;

  return `${name}：${problemText} 具体练法：${template.action} 复盘重点：${template.review} 验收标准：${template.goal}`;
}

function parseSuggestionLines(sectionContent: string) {
  const suggestionMatches = Array.from(
    sectionContent.matchAll(/建议\s*\d+\s*(?:【([^】]+)】)?\s*[：:]\s*([^\n]+)/g)
  )
    .map((match) => {
      const dimension = match[1]?.trim();
      const content = match[2]?.trim();

      if (!content) {
        return '';
      }

      return dimension ? `${dimension}：${content}` : content;
    })
    .filter(Boolean);

  if (suggestionMatches.length > 0) {
    return suggestionMatches;
  }

  return sectionContent
    .split('\n')
    .map((line) => cleanListItem(line))
    .filter((line) => line.length > 0);
}

function normalizeSuggestions(parsedSuggestions: string[]) {
  const byDimension = new Map<DimensionName, string>();

  for (const item of parsedSuggestions) {
    const dimension = extractDimensionFromText(item);
    if (!dimension || byDimension.has(dimension)) {
      continue;
    }

    byDimension.set(dimension, removeDimensionPrefix(item));
  }

  const normalized = DIMENSION_NAMES.map((dimension) =>
    buildDetailedSuggestion(dimension, byDimension.get(dimension))
  );

  return normalized.slice(0, MIN_SUGGESTION_COUNT);
}

function parsePlanLine(day: string, content: string): PracticePlanItem {
  const [focusPart, taskPart, reviewPart, goalPart] = content
    .split(/[|｜]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    day,
    focus: focusPart || '综合训练',
    task: taskPart || content.trim(),
    review: reviewPart || '',
    goal: goalPart || '',
  };
}

function parsePracticePlan(sectionContent: string) {
  const dayMatches = Array.from(sectionContent.matchAll(/第\s*(\d+)\s*天\s*[：:]\s*([^\n]+)/g));

  if (dayMatches.length > 0) {
    return dayMatches.map((match) => parsePlanLine(`第${match[1]}天`, match[2] ?? ''));
  }

  return sectionContent
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, PLAN_DAY_COUNT)
    .map((line, index) => parsePlanLine(`第${index + 1}天`, cleanListItem(line)));
}

function buildFallbackPracticePlan(feedback: string, totalScore?: number | null) {
  const safeTotalScore = normalizeTotalScore(totalScore ?? extractTotalScore(feedback) ?? 0);
  const rankedDimensions = [...buildDimensionScores(feedback, safeTotalScore)].sort(
    (a, b) => a.score - b.score
  );
  const weakest = rankedDimensions[0]?.name ?? '技术基础';
  const second = rankedDimensions[1]?.name ?? weakest;
  const third = rankedDimensions[2]?.name ?? second;

  return [
    {
      day: '第1天',
      focus: `${weakest}诊断`,
      task: `围绕“${weakest}”做一次系统摸底。先整理近两次面试里暴露的错题、卡壳点和没讲清的概念，再补 6 到 8 个高频问题的标准回答，最后做 1 轮 15 分钟口述练习，把薄弱点全部暴露出来。`,
      review: '把每一道题分成“完全会、模糊会、不会”三类，记录为什么不会，是概念没记住、原理没理解，还是表达顺序混乱。',
      goal: '输出一份当天薄弱点清单，并确定接下来 3 天最优先修补的知识点或答题问题。',
    },
    {
      day: '第2天',
      focus: `${weakest}强化`,
      task: `继续深挖“${weakest}”。针对前一天最薄弱的 3 个点，每个点都补完整的“定义、原理、边界、案例、常见坑”回答，再做 2 轮限时复述，强制在 3 分钟内讲清。`,
      review: '复盘时重点检查是否还能被追问两层；如果只能背结论，说明没有真正吃透，需要继续补原理和例子。',
      goal: `让“${weakest}”相关题目回答更稳定，至少能连续完整回答 3 题，不再出现大段停顿或明显跑题。`,
    },
    {
      day: '第3天',
      focus: `${second}提升`,
      task: `集中处理“${second}”问题。如果这是项目经验，就重写项目讲稿并补量化结果；如果是场景题，就练 3 到 5 道典型题并加上风险兜底；如果是逻辑或表达，就做限时口述压缩训练。`,
      review: '回放录音时，检查自己有没有把“背景、判断、动作、结果”讲完整，尤其要找出那些听上去像懂了、其实没有落地细节的地方。',
      goal: `让“${second}”从明显短板变成可正常作答的维度，至少形成一套可复用的回答模板。`,
    },
    {
      day: '第4天',
      focus: `${third}补强`,
      task: `针对“${third}”做专项训练，并把前三天的训练内容串起来。当天至少完成 1 轮项目介绍、1 轮基础题解释、1 轮场景题回答，刻意练习从结论到展开的表达节奏。`,
      review: '复盘时不是只看对错，而是看信息顺序是否合理、重点是否靠前、回答里有没有重复和无效铺垫。',
      goal: `把“${third}”对应的问题压缩到可控范围，让你的整体回答更均衡，不再只靠某一个维度硬撑。`,
    },
    {
      day: '第5天',
      focus: '项目与场景联动',
      task: '把项目经验和场景解决能力放在一起练。先从项目里挑 2 个真实难点，分别回答“为什么这样设计、如果重做会怎么优化、遇到高并发/异常/扩展问题怎么处理”，再做 1 轮模拟追问。',
      review: '重点检查自己有没有把项目说成“功能介绍”，有没有把场景题说成“背模板”，以及有没有真正把项目经历和技术判断连接起来。',
      goal: '让项目介绍和场景题回答形成联动，面试官追问时你能把项目细节自然延伸到技术分析，而不是临时现编。',
    },
    {
      day: '第6天',
      focus: '全流程模拟',
      task: '做 1 次 30 到 40 分钟完整模拟面试，覆盖自我介绍、项目介绍、基础题、场景题和反问环节。过程中严格按正式面试节奏进行，不中途暂停、不看稿，尽量还原真实压力。',
      review: '模拟结束后按五个维度重新打分，逐项记录失分原因：是不会、没讲清、逻辑乱，还是表达不稳。只记录最真实的失分点，不做自我安慰。',
      goal: '产出一份接近真实面试的复盘结果，明确最后仍需修正的 3 个关键问题，给第 7 天冲刺使用。',
    },
    {
      day: '第7天',
      focus: '冲刺修正',
      task: '围绕第 6 天复盘出的 3 个关键问题做最后修正。每个问题都重新准备答案、重新口述、重新录音，最后再做一轮 15 到 20 分钟短模拟，确认修正后的表现是否稳定。',
      review: '对比第 1 天和第 7 天的录音，检查有没有真正减少卡顿、跑题、概念模糊和项目空泛这些问题，并写出下一轮继续训练的清单。',
      goal: '形成一套更稳的面试状态和后续训练方向，让你下一次正式练习时能明显感受到回答质量提升。',
    },
  ];
}

function buildDefaultReview(focus: string) {
  const dimension = extractDimensionFromText(focus);

  if (dimension) {
    return GUIDANCE_LIBRARY[dimension].review;
  }

  return '复盘时重点看回答是否有结构、是否有无效重复、是否真正落到了可执行的行动和结果上。';
}

function buildDefaultGoal(focus: string) {
  const dimension = extractDimensionFromText(focus);

  if (dimension) {
    return GUIDANCE_LIBRARY[dimension].goal;
  }

  return '完成当天训练后，至少明确一个已经修正的问题和一个还需要继续加强的问题。';
}

function enrichPracticePlanItem(item: PracticePlanItem, fallbackItem: PracticePlanItem) {
  const task =
    item.task.length >= 45
      ? item.task
      : `${item.task} 补充训练要求：${fallbackItem.task}`;

  return {
    day: item.day,
    focus: item.focus || fallbackItem.focus,
    task,
    review: item.review || buildDefaultReview(item.focus || fallbackItem.focus),
    goal: item.goal || buildDefaultGoal(item.focus || fallbackItem.focus),
  };
}

function normalizePracticePlan(
  parsedPlan: PracticePlanItem[],
  fallbackPlan: PracticePlanItem[]
) {
  return Array.from({ length: PLAN_DAY_COUNT }, (_, index) => {
    const fallbackItem = fallbackPlan[index];
    const parsedItem = parsedPlan[index];

    if (!fallbackItem) {
      return parsedItem;
    }

    if (!parsedItem) {
      return fallbackItem;
    }

    return enrichPracticePlanItem(parsedItem, fallbackItem);
  }).filter(Boolean) as PracticePlanItem[];
}

export function buildInterviewGuidance(feedback: string, totalScore?: number | null): InterviewGuidance {
  if (!feedback) {
    return {
      reportSummary: '',
      suggestions: [],
      practicePlan: [],
    };
  }

  const { prefix, sections } = splitFeedbackSections(feedback);
  const canBuildFallbackGuidance = hasEvaluationSignals(feedback);
  const fallbackSuggestions = canBuildFallbackGuidance
    ? normalizeSuggestions([])
    : [];
  const fallbackPracticePlan = canBuildFallbackGuidance
    ? buildFallbackPracticePlan(feedback, totalScore)
    : [];

  if (sections.length === 0) {
    return {
      reportSummary: normalizeFeedback(feedback),
      suggestions: fallbackSuggestions,
      practicePlan: fallbackPracticePlan,
    };
  }

  const reportSections = sections.filter(
    (section) => !isSuggestionSection(section) && !isPracticePlanSection(section)
  );
  const suggestionSection = sections.find(isSuggestionSection);
  const practicePlanSection = sections.find(isPracticePlanSection);

  const parsedSuggestions = suggestionSection?.content
    ? parseSuggestionLines(suggestionSection.content)
    : [];
  const parsedPracticePlan = practicePlanSection?.content
    ? parsePracticePlan(practicePlanSection.content)
    : [];

  return {
    reportSummary: joinSections(reportSections) || prefix || normalizeFeedback(feedback),
    suggestions:
      parsedSuggestions.length > 0
        ? normalizeSuggestions(parsedSuggestions)
        : fallbackSuggestions,
    practicePlan:
      parsedPracticePlan.length > 0
        ? normalizePracticePlan(parsedPracticePlan, fallbackPracticePlan)
        : fallbackPracticePlan,
  };
}
