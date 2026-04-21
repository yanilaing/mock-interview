"use client";

import { useState } from 'react';
import Link from 'next/link';

// ========== 1. MBTI 核心类型定义 ==========
type Dimension = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';
type MbtiType = `${'E'|'I'}${'S'|'N'}${'T'|'F'}${'J'|'P'}`;

// 题目类型定义
interface Question {
  id: number;
  question: string;
  options: {
    label: string;
    dimension: Dimension;
  }[];
}

interface JobMatch {
  jobName: string;
  jobSlug: string;
  matchReason: string;
}

interface MbtiResult {
  type: MbtiType;
  typeName: string;
  description: string;
  recommendJobs: JobMatch[];
}

// ========== 2. 优化后的MBTI测试题库（40题，每个维度10题，更准确） ==========
const mbtiQuestions: Question[] = [
  // E/I 外向/内向 维度 (10题)
  {
    id: 1,
    question: "在团队讨论中，你通常的状态是？",
    options: [
      { label: "积极发言，享受思维碰撞的过程", dimension: "E" },
      { label: "先倾听，整理好思路后再发言", dimension: "I" },
    ]
  },
  {
    id: 2,
    question: "工作遇到难题卡壳时，你会？",
    options: [
      { label: "立刻找同事或前辈讨论，边聊边想", dimension: "E" },
      { label: "先自己查资料、独立思考，实在不行再问人", dimension: "I" },
    ]
  },
  {
    id: 3,
    question: "结束了一天的工作/学习，你更倾向于？",
    options: [
      { label: "和朋友约饭、聚会，或者去热闹的地方", dimension: "E" },
      { label: "安安静静待在家里，自己放松一下", dimension: "I" },
    ]
  },
  {
    id: 4,
    question: "在一个陌生的社交场合，你会？",
    options: [
      { label: "主动和人打招呼，认识新朋友", dimension: "E" },
      { label: "找个角落待着，或者只和熟悉的人交流", dimension: "I" },
    ]
  },
  {
    id: 5,
    question: "你觉得自己的思考方式更偏向？",
    options: [
      { label: "「头脑风暴」式，边说边想，越聊思路越清晰", dimension: "E" },
      { label: "「独自沉淀」式，自己想清楚了才会表达", dimension: "I" },
    ]
  },
  {
    id: 6,
    question: "对于工作环境，你更在意？",
    options: [
      { label: "开放、热闹，能和大家随时交流", dimension: "E" },
      { label: "安静、独立，能不受打扰地专注做事", dimension: "I" },
    ]
  },
  {
    id: 7,
    question: "周末安排活动，你更倾向于？",
    options: [
      { label: "一群人出去玩，热闹开心", dimension: "E" },
      { label: "自己或者和1-2个好友，轻松自在", dimension: "I" },
    ]
  },
  {
    id: 8,
    question: "在表达自己的想法时，你通常是？",
    options: [
      { label: "想到什么就说什么，在表达中完善思路", dimension: "E" },
      { label: "先在心里想清楚，再有条理地说出来", dimension: "I" },
    ]
  },
  {
    id: 9,
    question: "你觉得自己的精力来源更多是？",
    options: [
      { label: "和外界互动、和人相处", dimension: "E" },
      { label: "独处、自我反思和恢复", dimension: "I" },
    ]
  },
  {
    id: 10,
    question: "接手一个新项目，你首先会？",
    options: [
      { label: "拉上相关人开个会，快速对齐想法", dimension: "E" },
      { label: "先自己梳理需求和边界，再开始对接", dimension: "I" },
    ]
  },

  // S/N 实感/直觉 维度 (10题)
  {
    id: 11,
    question: "学习一个新技术时，你更习惯？",
    options: [
      { label: "先看官方文档，一步步跟着实操，掌握细节", dimension: "S" },
      { label: "先了解整体框架和核心思想，再按需看细节", dimension: "N" },
    ]
  },
  {
    id: 12,
    question: "做需求评审时，你更关注？",
    options: [
      { label: "具体的实现步骤、边界条件、现有资源", dimension: "S" },
      { label: "这个需求的长期价值、未来的扩展性", dimension: "N" },
    ]
  },
  {
    id: 13,
    question: "你更看重的是？",
    options: [
      { label: "当下的现实、具体的事实和数据", dimension: "S" },
      { label: "未来的可能性、事物的本质和规律", dimension: "N" },
    ]
  },
  {
    id: 14,
    question: "面对一个问题，你更倾向于？",
    options: [
      { label: "看过去的经验和类似的解决方案", dimension: "S" },
      { label: "想新的可能性和创新的解决思路", dimension: "N" },
    ]
  },
  {
    id: 15,
    question: "别人给你讲一件事，你更容易注意到？",
    options: [
      { label: "事情的具体细节、真实发生的情况", dimension: "S" },
      { label: "这件事背后的逻辑、隐含的可能性", dimension: "N" },
    ]
  },
  {
    id: 16,
    question: "做职业规划时，你更看重？",
    options: [
      { label: "可落地的路径、明确的成长节点", dimension: "S" },
      { label: "自己的兴趣、未来的行业趋势", dimension: "N" },
    ]
  },
  {
    id: 17,
    question: "你觉得自己更像是一个？",
    options: [
      { label: "务实的人，看重当下的实际情况", dimension: "S" },
      { label: "理想的人，看重未来的可能性", dimension: "N" },
    ]
  },
  {
    id: 18,
    question: "看一部电影/读一本书时，你更关注？",
    options: [
      { label: "具体的情节、细节、画面感", dimension: "S" },
      { label: "主题思想、隐喻、背后的意义", dimension: "N" },
    ]
  },
  {
    id: 19,
    question: "面对工作中的变化，你更倾向于？",
    options: [
      { label: "关注变化带来的具体影响，快速适配现有流程", dimension: "S" },
      { label: "关注变化带来的新机会，畅想新的可能性", dimension: "N" },
    ]
  },
  {
    id: 20,
    question: "你觉得自己的思维方式更偏向？",
    options: [
      { label: "「细节导向」，关注具体的信息", dimension: "S" },
      { label: "「全局导向」，关注整体的联系", dimension: "N" },
    ]
  },

  // T/F 思考/情感 维度 (10题)
  {
    id: 21,
    question: "做决策时，你更依赖？",
    options: [
      { label: "逻辑分析、数据支撑、利弊权衡", dimension: "T" },
      { label: "人的感受、团队氛围、价值认同", dimension: "F" },
    ]
  },
  {
    id: 22,
    question: "团队里同事的方案有明显漏洞，你会？",
    options: [
      { label: "直接指出问题，客观分析利弊", dimension: "T" },
      { label: "先肯定对方的付出，再委婉提出建议", dimension: "F" },
    ]
  },
  {
    id: 23,
    question: "你更看重的是？",
    options: [
      { label: "公平、公正、按规则办事", dimension: "T" },
      { label: "和谐、共情、照顾人的感受", dimension: "F" },
    ]
  },
  {
    id: 24,
    question: "朋友/同事向你倾诉烦恼时，你通常会？",
    options: [
      { label: "帮他分析问题，给出解决方案", dimension: "T" },
      { label: "共情他的感受，给予情感支持", dimension: "F" },
    ]
  },
  {
    id: 25,
    question: "你觉得自己更像是一个？",
    options: [
      { label: "理性的人，讲道理、讲逻辑", dimension: "T" },
      { label: "感性的人，重感情、重体验", dimension: "F" },
    ]
  },
  {
    id: 26,
    question: "项目延期，核心原因是同事摸鱼，你会？",
    options: [
      { label: "对齐责任，同步给负责人，按规则处理", dimension: "T" },
      { label: "先沟通了解情况，一起想办法赶进度", dimension: "F" },
    ]
  },
  {
    id: 27,
    question: "面试被问到一个不会的问题，你更在意？",
    options: [
      { label: "怎么快速梳理逻辑，给出合理的解答思路", dimension: "T" },
      { label: "面试官的感受，会不会影响面试评分", dimension: "F" },
    ]
  },
  {
    id: 28,
    question: "你更认同的是？",
    options: [
      { label: "「对事不对人」，就事论事最重要", dimension: "T" },
      { label: "「人和事分不开」，人的感受也很重要", dimension: "F" },
    ]
  },
  {
    id: 29,
    question: "给下属/新人做反馈，你更倾向于？",
    options: [
      { label: "直接指出问题，给出明确的改进标准", dimension: "T" },
      { label: "先鼓励做得好的地方，再温和提不足", dimension: "F" },
    ]
  },
  {
    id: 30,
    question: "你觉得自己的沟通方式更偏向？",
    options: [
      { label: "直接、清晰，注重效率和逻辑", dimension: "T" },
      { label: "委婉、温和，注重氛围和感受", dimension: "F" },
    ]
  },

  // J/P 判断/感知 维度 (10题)
  {
    id: 31,
    question: "做项目时，你更习惯？",
    options: [
      { label: "先制定详细的计划，按计划一步步推进", dimension: "J" },
      { label: "先定大方向，边做边调整，灵活应对变化", dimension: "P" },
    ]
  },
  {
    id: 32,
    question: "对于工作和生活，你更希望？",
    options: [
      { label: "安排得井井有条，有明确的规划", dimension: "J" },
      { label: "随性自由，不喜欢被计划束缚", dimension: "P" },
    ]
  },
  {
    id: 33,
    question: "面对截止日期，你通常是？",
    options: [
      { label: "提前完成，预留缓冲时间应对突发情况", dimension: "J" },
      { label: "在截止日期前，集中精力冲刺完成", dimension: "P" },
    ]
  },
  {
    id: 34,
    question: "你觉得自己更像是一个？",
    options: [
      { label: "喜欢做计划、有规划的人", dimension: "J" },
      { label: "喜欢灵活应变、随遇而安的人", dimension: "P" },
    ]
  },
  {
    id: 35,
    question: "接手一个模糊的需求，你先做的是？",
    options: [
      { label: "先对齐所有细节，定好范围和排期再开工", dimension: "J" },
      { label: "先做最小可行版本，边做边迭代优化", dimension: "P" },
    ]
  },
  {
    id: 36,
    question: "周末计划出门玩，你更倾向于？",
    options: [
      { label: "提前定好行程、时间、地点，按计划走", dimension: "J" },
      { label: "临时决定去哪，想到什么就做什么", dimension: "P" },
    ]
  },
  {
    id: 37,
    question: "你更看重的是？",
    options: [
      { label: "确定性、稳定性、有计划", dimension: "J" },
      { label: "可能性、灵活性、开放性", dimension: "P" },
    ]
  },
  {
    id: 38,
    question: "对于已经决定的事情，你会？",
    options: [
      { label: "按计划执行，不轻易改变", dimension: "J" },
      { label: "根据新情况，灵活调整", dimension: "P" },
    ]
  },
  {
    id: 39,
    question: "你的工作/学习环境通常是？",
    options: [
      { label: "整齐有序，东西都有固定的位置", dimension: "J" },
      { label: "比较随意，东西随手放但能找到", dimension: "P" },
    ]
  },
  {
    id: 40,
    question: "你觉得自己的决策方式更偏向？",
    options: [
      { label: "快速决定，不喜欢拖泥带水", dimension: "J" },
      { label: "保持开放，喜欢多看看再决定", dimension: "P" },
    ]
  },
];

// ========== 3. MBTI类型解读 & 岗位匹配表 ==========
const mbtiResultMap: Record<MbtiType, MbtiResult> = {
  "INTJ": {
    type: "INTJ",
    typeName: "建筑师",
    description: "逻辑缜密、战略思维强，擅长长期规划和深度思考，对技术有极致的追求，喜欢攻克复杂的技术难题，独立工作能力极强。",
    recommendJobs: [
      { jobName: "Java 后端开发", jobSlug: "java-backend", matchReason: "擅长架构设计、复杂系统拆解，完美匹配后端开发的核心要求" },
      { jobName: "Python 算法工程师", jobSlug: "python-algorithm", matchReason: "逻辑能力强，对数据和模型有天然的敏感度，适合算法研发" },
      { jobName: "系统架构师", jobSlug: "java-backend", matchReason: "战略思维和全局规划能力，是架构师的核心特质" },
    ]
  },
  "INTP": {
    type: "INTP",
    typeName: "逻辑学家",
    description: "天生的程序员，热爱抽象思考和逻辑推理，对技术原理有极强的好奇心，擅长解决疑难问题，喜欢探索新技术和新方案。",
    recommendJobs: [
      { jobName: "Java 后端开发", jobSlug: "java-backend", matchReason: "逻辑推理能力强，适合底层逻辑开发和复杂问题排查" },
      { jobName: "Web 前端开发", jobSlug: "web-frontend", matchReason: "对新技术敏感，擅长探索前端框架的底层原理和创新实现" },
      { jobName: "Python 算法工程师", jobSlug: "python-algorithm", matchReason: "擅长抽象建模，适合算法研究和技术创新" },
    ]
  },
  "ENTJ": {
    type: "ENTJ",
    typeName: "指挥官",
    description: "天生的领导者，目标感极强，擅长统筹规划和团队管理，逻辑清晰、决策果断，能推动复杂项目落地，兼具技术和管理能力。",
    recommendJobs: [
      { jobName: "技术经理/项目管理", jobSlug: "java-backend", matchReason: "统筹能力强，适合带团队做大型项目管理" },
      { jobName: "Java 后端开发", jobSlug: "java-backend", matchReason: "目标导向，能高效推进核心业务系统的开发落地" },
      { jobName: "产品经理", jobSlug: "product-manager", matchReason: "战略思维和商业敏感度，适合把控产品方向" },
    ]
  },
  "ENTP": {
    type: "ENTP",
    typeName: "辩论家",
    description: "思维敏捷、脑洞大，擅长创新和跨界思考，喜欢挑战常规，沟通能力强，能快速适配新场景，对新技术和新趋势敏感度高。",
    recommendJobs: [
      { jobName: "Web 前端开发", jobSlug: "web-frontend", matchReason: "创意和创新能力强，适合交互体验和前端创新场景" },
      { jobName: "产品经理", jobSlug: "product-manager", matchReason: "思维活跃，擅长挖掘用户需求和创新产品方案" },
      { jobName: "全栈开发工程师", jobSlug: "java-backend", matchReason: "学习能力强，能快速掌握前后端全栈技术" },
    ]
  },
  "INFJ": {
    type: "INFJ",
    typeName: "提倡者",
    description: "有深度的洞察力，共情能力强，擅长换位思考，做事严谨有原则，追求价值感和意义感，能精准把握用户的核心需求。",
    recommendJobs: [
      { jobName: "产品经理", jobSlug: "product-manager", matchReason: "洞察力强，能精准挖掘用户需求，打造有温度的产品" },
      { jobName: "UI/UX 设计师", jobSlug: "web-frontend", matchReason: "共情能力和审美能力，适合用户体验设计" },
      { jobName: "软件测试工程师", jobSlug: "java-backend", matchReason: "严谨细致，能精准发现系统的潜在问题" },
    ]
  },
  "INFP": {
    type: "INFP",
    typeName: "调停者",
    description: "理想主义者，共情能力极强，有丰富的内心世界，擅长创意和内容创作，做事认真负责，追求把事情做到极致。",
    recommendJobs: [
      { jobName: "UI/UX 设计师", jobSlug: "web-frontend", matchReason: "审美和创意能力强，适合打造有温度的用户体验" },
      { jobName: "内容运营/新媒体运营", jobSlug: "operation", matchReason: "文字和共情能力，适合内容创作和用户运营" },
      { jobName: "Web 前端开发", jobSlug: "web-frontend", matchReason: "细致严谨，能把设计稿完美还原，打磨交互细节" },
    ]
  },
  "ENFJ": {
    type: "ENFJ",
    typeName: "教育家",
    description: "感染力强，擅长沟通和引导，共情能力和领导力兼备，能很好地协调团队关系，擅长挖掘他人的潜力，推动团队共同成长。",
    recommendJobs: [
      { jobName: "产品经理", jobSlug: "product-manager", matchReason: "沟通和协调能力强，能推动跨团队产品落地" },
      { jobName: "项目经理", jobSlug: "java-backend", matchReason: "团队协调和目标管理能力，适合项目全流程管控" },
      { jobName: "运营经理", jobSlug: "operation", matchReason: "感染力强，擅长用户增长和团队管理" },
    ]
  },
  "ENFP": {
    type: "ENFP",
    typeName: "活动家",
    description: "热情开朗，创意十足，社交能力强，对新鲜事物充满好奇，擅长表达和共情，能快速和人建立连接，适应能力极强。",
    recommendJobs: [
      { jobName: "新媒体/用户运营", jobSlug: "operation", matchReason: "创意和社交能力，适合内容创作和用户增长" },
      { jobName: "产品经理", jobSlug: "product-manager", matchReason: "脑洞大，擅长挖掘用户需求，打造创新产品" },
      { jobName: "Web 前端开发", jobSlug: "web-frontend", matchReason: "对新鲜技术敏感，擅长创意交互实现" },
    ]
  },
  "ISTJ": {
    type: "ISTJ",
    typeName: "物流师",
    description: "严谨务实、责任心极强，做事一丝不苟，注重规则和流程，擅长细节把控和风险规避，能稳定高质量地完成工作。",
    recommendJobs: [
      { jobName: "Java 后端开发", jobSlug: "java-backend", matchReason: "严谨细致，能写出高稳定性、低bug的业务代码" },
      { jobName: "软件测试工程师", jobSlug: "java-backend", matchReason: "细节控，能全面覆盖测试场景，保障系统质量" },
      { jobName: "运维工程师", jobSlug: "java-backend", matchReason: "注重流程和稳定性，适合系统运维和风险管控" },
    ]
  },
  "ISFJ": {
    type: "ISFJ",
    typeName: "守卫者",
    description: "温柔细致，责任心强，共情能力好，做事踏实靠谱，擅长换位思考，能精准捕捉需求，把细节做到极致。",
    recommendJobs: [
      { jobName: "软件测试工程师", jobSlug: "java-backend", matchReason: "细致耐心，能全面覆盖测试用例，保障产品质量" },
      { jobName: "产品经理", jobSlug: "product-manager", matchReason: "共情能力强，能精准把握用户的细节需求" },
      { jobName: "Web 前端开发", jobSlug: "web-frontend", matchReason: "细致严谨，能完美还原设计，打磨交互细节" },
    ]
  },
  "ESTJ": {
    type: "ESTJ",
    typeName: "总经理",
    description: "务实果断，规则意识强，擅长管理和执行，目标导向，能高效推进项目落地，擅长流程优化和团队管理。",
    recommendJobs: [
      { jobName: "项目经理", jobSlug: "java-backend", matchReason: "执行和管理能力强，能高效推进项目落地" },
      { jobName: "Java 后端开发", jobSlug: "java-backend", matchReason: "务实高效，能稳定交付高质量的业务系统" },
      { jobName: "技术管理", jobSlug: "java-backend", matchReason: "规则和管理意识，适合带团队做标准化建设" },
    ]
  },
  "ESFJ": {
    type: "ESFJ",
    typeName: "执政官",
    description: "热情友善，沟通能力强，擅长协调和服务，共情能力拉满，能很好地维护团队氛围，精准满足各方需求。",
    recommendJobs: [
      { jobName: "产品经理", jobSlug: "product-manager", matchReason: "沟通协调能力强，能很好地平衡业务、研发、用户的需求" },
      { jobName: "运营经理", jobSlug: "operation", matchReason: "共情和服务能力，适合用户运营和活动策划" },
      { jobName: "项目协调", jobSlug: "java-backend", matchReason: "擅长跨团队沟通，保障项目顺畅推进" },
    ]
  },
  "ISTP": {
    type: "ISTP",
    typeName: "手艺人",
    description: "动手能力极强，擅长实操和问题排查，逻辑清晰，喜欢拆解和解决具体的技术问题，灵活应变能力拉满。",
    recommendJobs: [
      { jobName: "Java 后端开发", jobSlug: "java-backend", matchReason: "动手能力强，擅长排查线上问题，解决技术难题" },
      { jobName: "Web 前端开发", jobSlug: "web-frontend", matchReason: "实操能力强，能快速实现功能，解决兼容性问题" },
      { jobName: "运维/DevOps工程师", jobSlug: "java-backend", matchReason: "擅长实操和问题排查，适合线上系统维护" },
    ]
  },
  "ISFP": {
    type: "ISFP",
    typeName: "探险家",
    description: "温和细腻，审美能力强，擅长动手实操，喜欢灵活自由的工作方式，注重当下，能把创意和想法落地成具体的成果。",
    recommendJobs: [
      { jobName: "UI/UX 设计师", jobSlug: "web-frontend", matchReason: "审美和动手能力强，适合视觉和交互设计" },
      { jobName: "Web 前端开发", jobSlug: "web-frontend", matchReason: "细腻有审美，能把设计完美还原，打造流畅的交互体验" },
      { jobName: "内容运营", jobSlug: "operation", matchReason: "创意和审美能力，适合内容创作和视觉呈现" },
    ]
  },
  "ESTP": {
    type: "ESTP",
    typeName: "企业家",
    description: "精力充沛，务实果断，应变能力极强，擅长解决突发问题，社交能力好，喜欢挑战，能快速适配各种复杂场景。",
    recommendJobs: [
      { jobName: "全栈开发工程师", jobSlug: "java-backend", matchReason: "应变能力强，能快速搞定前后端各种问题" },
      { jobName: "销售/商务拓展", jobSlug: "operation", matchReason: "社交和应变能力，适合商务谈判和业务拓展" },
      { jobName: "技术支持", jobSlug: "java-backend", matchReason: "擅长解决突发问题，快速响应客户需求" },
    ]
  },
  "ESFP": {
    type: "ESFP",
    typeName: "表演者",
    description: "热情开朗，感染力强，擅长表达和社交，动手能力强，喜欢和人打交道，能快速适应新环境，氛围营造小能手。",
    recommendJobs: [
      { jobName: "新媒体/活动运营", jobSlug: "operation", matchReason: "感染力和创意能力，适合活动策划和内容创作" },
      { jobName: "用户运营", jobSlug: "operation", matchReason: "社交能力强，擅长和用户打交道，提升用户粘性" },
      { jobName: "售前工程师", jobSlug: "java-backend", matchReason: "表达和沟通能力强，能很好地给客户讲解产品和方案" },
    ]
  },
};

// ========== 4. 页面主组件 ==========
export default function MbtiTestPage() {
  const [currentStep, setCurrentStep] = useState<'start' | 'question' | 'result'>('start');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<Dimension, number>>({
    E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0
  });
  const [finalResult, setFinalResult] = useState<MbtiResult | null>(null);

  const handleStartTest = () => {
    setCurrentStep('question');
    setCurrentQuestionIndex(0);
    setAnswers({ E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 });
    setFinalResult(null);
  };

  const handleSelectOption = (dimension: Dimension) => {
    const newAnswers = { ...answers, [dimension]: answers[dimension] + 1 };
    setAnswers(newAnswers);

    if (currentQuestionIndex >= mbtiQuestions.length - 1) {
      calculateResult(newAnswers);
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const calculateResult = (finalAnswers: Record<Dimension, number>) => {
    const EorI = finalAnswers.E > finalAnswers.I ? 'E' : 'I';
    const SorN = finalAnswers.S > finalAnswers.N ? 'S' : 'N';
    const TorF = finalAnswers.T > finalAnswers.F ? 'T' : 'F';
    const JorP = finalAnswers.J > finalAnswers.P ? 'J' : 'P';

    const mbtiType = `${EorI}${SorN}${TorF}${JorP}` as MbtiType;
    const result = mbtiResultMap[mbtiType];
    
    setFinalResult(result);
    setCurrentStep('result');
  };

  const handleRetest = () => {
    handleStartTest();
  };

  const currentQuestion = mbtiQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / mbtiQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-cyan-50 p-4 md:p-6 flex flex-col">
      {/* 返回按钮 */}
      <div className="max-w-3xl mx-auto w-full mb-4 md:mb-6">
        <Link 
          href="/" 
          className="inline-flex items-center text-gray-600 hover:text-indigo-600 transition"
        >
          ← 返回首页
        </Link>
      </div>

      {/* 1. 开始页 */}
      {currentStep === 'start' && (
        <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-6xl mb-6">🧩</div>
          <h1 className="text-4xl font-bold text-indigo-800 mb-4">MBTI 职业性格测试</h1>
          <p className="text-lg text-gray-600 mb-8 max-w-lg">
            40道精简题目，2分钟完成，帮你找到最适合你的职业方向，精准匹配面试岗位。
          </p>
          <div className="bg-white rounded-2xl p-6 mb-8 w-full shadow-sm">
            <h3 className="font-bold text-gray-800 mb-3">测试说明</h3>
            <ul className="text-left text-gray-600 space-y-2">
              <li>• 题目无对错之分，请根据你的真实想法选择</li>
              <li>• 测试结果仅作为职业方向参考，帮你找到适配的岗位</li>
              <li>• 完成后可一键跳转到对应岗位的模拟面试页面</li>
            </ul>
          </div>
          <button
            onClick={handleStartTest}
            className="px-8 py-4 bg-indigo-500 text-white rounded-full text-lg font-medium hover:bg-indigo-600 transition shadow-md w-full max-w-sm"
          >
            开始测试
          </button>
        </div>
      )}

      {/* 2. 答题页 */}
      {currentStep === 'question' && (
        <div className="max-w-3xl mx-auto w-full flex flex-col">
          {/* 进度条 + 题号 放在同一行，节省空间 */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-500 font-medium">
              第 {currentQuestionIndex + 1} / {mbtiQuestions.length} 题
            </div>
            <div className="w-2/3 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* 核心答题卡片 */}
          <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6 mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-5">
              {currentQuestion.question}
            </h2>
            <div className="space-y-3">
              {currentQuestion.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(option.dimension)}
                  className="w-full text-left p-3.5 md:p-4 border border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition text-base"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 上一题按钮 */}
          <div>
            <button
              onClick={handlePrevQuestion}
              disabled={currentQuestionIndex === 0}
              className="px-6 py-2 text-gray-600 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← 上一题
            </button>
          </div>
        </div>
      )}

      {/* 3. 结果页（已去掉跳转按钮） */}
      {currentStep === 'result' && finalResult && (
        <div className="max-w-4xl mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 mb-6 text-center">
            <div className="inline-block bg-indigo-100 text-indigo-700 px-4 py-1 rounded-full text-sm font-medium mb-4">
              你的测试结果
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-indigo-800 mb-2">
              {finalResult.type} · {finalResult.typeName}
            </h1>
            <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto leading-relaxed">
              {finalResult.description}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              🎯 为你推荐的岗位
            </h2>
            <div className="space-y-4">
              {finalResult.recommendJobs.map((job, idx) => (
                <div key={idx} className="border border-gray-100 rounded-xl p-5 md:p-6 hover:border-indigo-200 hover:bg-indigo-50/30 transition">
                  {/* 去掉了Link和跳转按钮，只保留岗位信息 */}
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-1">{job.jobName}</h3>
                    <p className="text-gray-600 text-sm md:text-base">{job.matchReason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={handleRetest}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              重新测试
            </button>
            <Link
              href="/"
              className="px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition"
            >
              返回首页
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
