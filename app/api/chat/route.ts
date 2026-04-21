import { NextRequest, NextResponse } from 'next/server';
import { ChatDeepSeek } from '@langchain/deepseek';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { createRetrievalChain } from '@langchain/classic/chains/retrieval';
import { createStuffDocumentsChain } from '@langchain/classic/chains/combine_documents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import fs from 'fs/promises';
import {
  DIMENSION_NAMES,
  extractTotalScore,
  normalizeInterviewFeedback,
  parseDimensionScoreMap,
  sumDimensionScores,
} from '../../../lib/interview-feedback';


// 自定义 DashScope Embedding 类（优化版：支持批量拆分）
class CustomDashScopeEmbeddings {
  private apiKey: string;
  private model: string;

  constructor({ model = 'text-embedding-v2', apiKey }: { model?: string; apiKey: string }) {
    this.model = model;
    this.apiKey = apiKey;
  }

  async embedQuery(text: string): Promise<number[]> {
    return this._embed([text]).then(embeddings => embeddings[0]);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this._embed(texts);
  }

  private async _embed(texts: string[]): Promise<number[][]> {
    const url = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';
    const batchSize = 25; // 通义Embedding单次限制
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batchTexts = texts.slice(i, i + batchSize);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: { texts: batchTexts },
          parameters: { text_type: 'document' }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DashScope Embedding 失败: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (data.code && data.code !== '200') {
        throw new Error(`DashScope Embedding 返回错误: ${data.message || data.code}`);
      }

      allEmbeddings.push(...data.output.embeddings.map((item: any) => item.embedding));
    }

    return allEmbeddings;
  }
}

type InterviewDoc = {
  pageContent: string;
  metadata: Record<string, string>;
};

const vectorStoreCache: { [key: string]: MemoryVectorStore | null } = {};
let dashScopeEmbeddingsDisabled = false;

function buildInterviewDocs(positionData: any, position: string): InterviewDoc[] {
  const safePositionData = positionData || {};
  const docs: InterviewDoc[] = [
    ...(safePositionData.questions || []).map((q: any) => ({
      pageContent: `${q.category || '通用'}: ${q.question || ''} - 要点: ${(q.keyPoints || []).join(', ') || '无'}`,
      metadata: { category: q.category || '通用', difficulty: q.difficulty || '中等' }
    })),
    ...(safePositionData.knowledgeBase?.exampleAnswers
      ? Object.entries(safePositionData.knowledgeBase.exampleAnswers).map(([q, a]) => ({
          pageContent: `问题: ${q} - 优秀回答: ${a}`,
          metadata: { type: 'example' }
        }))
      : []
    ),
    ...(safePositionData.knowledgeBase?.coreTechStack
      ? [{
          pageContent: `核心技术栈: ${safePositionData.knowledgeBase.coreTechStack.join(', ') || '无'}`,
          metadata: { type: 'tech_stack' }
        }]
      : []
    ),
    ...(safePositionData.knowledgeBase?.commonExamPoints
      ? [{
          pageContent: `常见考点: ${safePositionData.knowledgeBase.commonExamPoints.join(', ') || '无'}`,
          metadata: { type: 'exam_points' }
        }]
      : []
    )
  ];

  if (docs.length === 0) {
    docs.push({
      pageContent: `这是${position}岗位的通用面试场景，请面试官基于岗位特性出题。`,
      metadata: { type: 'fallback' }
    });
  }

  return docs;
}

function buildFallbackContext(docs: InterviewDoc[]) {
  return docs
    .slice(0, 6)
    .map((doc, index) => `资料${index + 1}：${doc.pageContent}`)
    .join('\n');
}

async function ensureVectorStore(positionSlug: string, docs: InterviewDoc[]) {
  if (Object.prototype.hasOwnProperty.call(vectorStoreCache, positionSlug)) {
    return vectorStoreCache[positionSlug];
  }

  if (dashScopeEmbeddingsDisabled || !process.env.DASHSCOPE_API_KEY) {
    vectorStoreCache[positionSlug] = null;
    return null;
  }

  try {
    const embeddings = new CustomDashScopeEmbeddings({
      model: 'text-embedding-v2',
      apiKey: process.env.DASHSCOPE_API_KEY,
    });

    const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
    vectorStoreCache[positionSlug] = vectorStore;
    return vectorStore;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vectorStoreCache[positionSlug] = null;

    if (/401|InvalidApiKey|Unauthorized/i.test(errorMessage)) {
      dashScopeEmbeddingsDisabled = true;
    }

    console.warn(`DashScope Embedding unavailable for ${positionSlug}, fallback to local context only: ${errorMessage}`);
    return null;
  }
}

// ========== 【核心修改1】极致严格版：生成面试反馈的核心函数 ==========
async function generateInterviewFeedback(messages: any[], position: string) {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('缺少 DeepSeek API Key');
  }

  const model = new ChatDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 2000,
  });

  const feedbackPrompt = `
【角色设定】
你是国内一线互联网大厂拥有10年以上招聘经验的${position}终面技术面试官，招聘标准极其严苛，以淘汰不合格候选人为首要职责，绝不打人情分、虚高分，你的评分直接决定候选人是否被淘汰。

【绝对严格的评分铁则（必须100%遵守，违者重罚）】
1.  总分定义（满分100，企业真实招聘标准）：
    - 0-59分：不予通过，直接淘汰（基础完全不达标，无法胜任岗位，连面试门槛都没达到）
    - 60-69分：及格边缘（有极其薄弱的基础，但漏洞百出，大概率淘汰）
    - 70-79分：中等（基础尚可，有明显短板，校招可进入复试，社招大概率淘汰）
    - 80-89分：良好（技术扎实，亮点突出，可进入下一轮）
    - 90-100分：极其优秀（远超岗位要求，万里挑一，直接录用）
    - 【铁律1】校招应届生，无完整项目经验、基础概念答错，最高不超过70分
    - 【铁律2】出现答非所问、完全不理解面试官问题，单次直接扣30分，出现2次直接总分不超过50分
    - 【铁律3】面试对话少于5轮、未完成完整面试流程、无有效技术回答，直接总分不超过40分
    - 【铁律4】核心基础概念答错、说不出知识点核心，单次扣25分，出现2次直接不及格
    - 【铁律5】除非候选人全程回答完美、技术深度远超要求，否则严禁给出85分以上的分数；70分以下是不合格候选人的常态。
    - 【铁律6】“扣30分/扣25分”只用于你在心里判断总分上限，绝对不允许直接写进任何单个维度的得分说明里。
    - 【铁律7】五个维度都只能给出0-20之间的最终分数，不允许出现30分、负分、先给20分再扣30分、-10分这类运算过程或表述。

2.  扣分优先级（从高到低）：
    - 致命问题（直接淘汰）：答非所问、完全不会、基础概念全错、面试未完成
    - 严重问题：项目深度为0、技术选型完全不懂、场景题无任何思路
    - 一般问题：表达不流畅、逻辑不清晰、知识点有小漏洞

【报告内容强制要求（必须全部包含，缺一不可）】
一、 整体评价
首先直接给出总分（格式：总分：XX分），总分必须严格等于下面五个维度分数之和。五个维度每项满分20分，总分满分100分。然后用100字以内的犀利点评，直接点出核心问题，不要任何客套话，直接说能不能通过面试。比如：“总分：35分。完全不具备前端开发基础，答非所问，无法胜任岗位，直接淘汰。”

二、 分维度详细分析
从以下五个维度进行分析，每个维度都必须使用0-20分制评分，并且必须先给出具体分数（如：技术基础：20分），再说明打分理由，理由必须精准对应候选人的回答，不能空话套话：
1. 技术基础（概念是否清晰、核心知识点是否掌握，答错直接打极低分）
2. 项目经验（项目真实性、技术深度、难点解决能力，无深度直接打0分）
3. 场景解决能力（是否理解问题、有没有解决思路，答非所问直接0分）
4. 逻辑思维（思路是否清晰、有条理，混乱直接打低分）
5. 表达流畅度（沟通是否高效、重点是否突出，答非所问直接0分）
补充要求：
1. 先在心里完成五个维度的最终打分，再开始写报告，确保五个维度相加严格等于总分。
2. 维度分析里只能写“维度名：X分。理由……”，不能写任何扣分公式、基础分、加减法过程、负分解释。
3. 如果触发铁律导致候选人整体很差，就直接把五个维度分别打低分体现出来，不要额外写“本项满分20但扣30分”。

三、 本次面试的致命问题
必须明确指出所有的致命、严重问题，每一条都要对应面试对话里的具体内容，不能有任何模糊表述。比如：“1. 完全不理解前端状态管理的基础问题，答非所问，暴露无任何前端开发基础；2. 无任何有效项目经验介绍，无法证明自己的开发能力。”

四、 提升建议
必须覆盖五个维度，分别给出 5 条不同维度的提升建议，不能只盯着一个短板反复说。格式严格为“建议1【技术基础】：……”“建议2【项目经验】：……”“建议3【场景解决能力】：……”“建议4【逻辑思维】：……”“建议5【表达流畅度】：……”。每条建议都要写得更具体、更长，至少包含这三个层次：当前主要问题、接下来怎么练、怎样算练到位。不能写空泛鼓励，必须能直接执行。

五、 练习计划
基于这次面试结果，给出一个 7 天强化练习计划。必须逐天输出，格式严格为“第1天：练习重点｜具体任务｜复盘要求｜完成标准”。每天的内容都要更详细，至少覆盖当天练什么、怎么练、练完后怎么复盘、做到什么程度算过关。7 天安排不能互相重复，必须体现逐步推进和强化。

【面试对话记录】
${messages.map((m) => `${m.role === 'user' ? '面试者' : '面试官'}：${m.content}`).join('\n\n')}

【输出格式强制要求】
1. 禁止使用任何 Markdown 格式，包括 **加粗**、#标题、*斜体*、列表符号等；
2. 只用纯文本、自然段落表达，分点用中文数字（一、二、三、），不要用任何特殊格式符号；
3. 直接输出反馈报告，不要输出任何多余的前缀、后缀、解释说明。

现在，严格按照以上要求，生成面试反馈报告。
`;

  // 1. 调用 AI 生成原始反馈
  const response = await model.invoke([new HumanMessage(feedbackPrompt)]);
  let feedbackContent = response.content as string;

  // ========== 【核心修改2】极致严格版：分数强制校准+兜底逻辑 ==========
  const parsedDimensionScoreMap = parseDimensionScoreMap(feedbackContent);
  const hasCompleteDimensionScores = DIMENSION_NAMES.every(
    (dimensionName) => parsedDimensionScoreMap[dimensionName] !== undefined
  );
  const parsedDimensionScoreTotal = hasCompleteDimensionScores
    ? sumDimensionScores(parsedDimensionScoreMap)
    : null;
  const parsedTotalScore = extractTotalScore(feedbackContent);
  let finalScore = parsedDimensionScoreTotal ?? parsedTotalScore ?? 60;

  // 2. 【强制兜底1】面试对话轮次极少（有效对话少于5轮），直接不及格
  const validMessageCount = messages.filter(m => m.role === 'user' && m.content.trim()).length;
  if (validMessageCount < 3 && parsedDimensionScoreTotal === null) {
    console.log(`⚠️ 有效对话仅${validMessageCount}轮，面试未完成，强制打不及格`);
    finalScore = Math.min(finalScore, 40); // 最高不超过40分
  }

  // 3. 【强制兜底2】只要出现答非所问/完全答错，直接压到60分以下
  const hasInvalidAnswer = messages.some(m => {
    const content = m.content.toLowerCase().trim();
    // 匹配答非所问、完全不相关的回答，可根据你的情况补充
    return content.includes('党的js') || content.length < 5 || content.includes('不知道');
  });
  if (hasInvalidAnswer && parsedDimensionScoreTotal === null) {
    console.log(`⚠️ 检测到无效回答/答非所问，强制打不及格`);
    finalScore = Math.min(finalScore, 50); // 最高不超过50分
  }

  // 4. 【强制兜底3】杜绝虚高分数，超过85分直接压下来
  if (finalScore > 85 && parsedDimensionScoreTotal === null) {
    console.log(`⚠️ AI初始打分${finalScore}过高，强制校准`);
    finalScore = Math.floor(Math.random() * 10) + 70; // 压到70-79分
  }

  // 5. 把校准后的总分和维度分，同步替换回反馈内容里
  const normalizedFeedback = normalizeInterviewFeedback(feedbackContent, finalScore);
  feedbackContent = normalizedFeedback.feedback;
  finalScore = normalizedFeedback.totalScore;
  console.log(`✅ 最终校准分数：${finalScore}分`);

  // 2. 返回处理后的内容和最终分数
  return { feedback: feedbackContent, finalScore: finalScore };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, messages, position = 'Java 后端开发', resume, interviewStage = 'main' } = body;

    // 👇 【优化1】对话历史自动截断（防止Token超限）
    let processedMessages = messages;
    if (messages && messages.length > 33) {
      processedMessages = messages.slice(-32);
      console.log(`对话历史过长，已从${messages.length}条截断为32条`);
    }

    // ========== 【核心修改3】分支1：结束面试，生成反馈 ==========
    if (action === 'END_INTERVIEW') {
      if (!processedMessages || processedMessages.length === 0) {
        return NextResponse.json({ error: '缺少对话记录，无法生成反馈' }, { status: 400 });
      }
      console.log('收到结束面试请求，正在生成反馈...');
      const { feedback, finalScore } = await generateInterviewFeedback(processedMessages, position);
      // 把反馈和校准后的最终分数一起返回给前端
      return NextResponse.json({ feedback, score: finalScore });
    }

    // 分支2：正常对话逻辑
    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: '缺少 DeepSeek API Key' }, { status: 500 });
    }

    const model = new ChatDeepSeek({
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: 'deepseek-chat',
      temperature: interviewStage === 'closing' ? 0.4 : 0.3,
      maxTokens: interviewStage === 'closing' ? 220 : 500
    });

    if (interviewStage === 'closing') {
      const lastUserMessage =
        [...processedMessages]
          .reverse()
          .find((message: { role: string; content: string }) => message.role === 'user' && message.content.trim())
          ?.content.trim() || '';

      const closingResponse = await model.invoke([
        new HumanMessage(`
你是一位国内一线互联网公司资深 ${position} 面试官。

当前已经进入面试最后收尾阶段，候选人刚刚做完最后总结。请你像真实面试官一样做一个简短收尾回应。

要求：
1. 先简短回应候选人刚才的总结，可以点一下优点、风险或你听到的重点。
2. 明确表示今天面试先到这里。
3. 收尾时统一用模拟面试的口径，例如“稍后系统会生成本次模拟面试的反馈总结”，不要提“同事同步结果”“后续通知结果”“等HR联系”这类真实招聘流程话术。
4. 绝对不要再提出任何新的技术问题、追问、开放式问题，也不要让候选人继续回答。
5. 用中文口语化表达，不要使用 Markdown，不要分点，控制在 2 到 4 句。

候选人最后的总结：
${lastUserMessage || '候选人未提供有效总结'}
        `),
      ]);

      return NextResponse.json({ reply: closingResponse.content as string });
    }

    // 读取题库（加容错）
    let interviewData: any;
    try {
      const data = await fs.readFile('app/data/interviewData.json', 'utf-8');
      interviewData = JSON.parse(data);
    } catch (err: any) {
      console.error('题库读取失败:', err.message);
      return NextResponse.json({ error: '题库文件读取失败，请检查 app/data/interviewData.json' }, { status: 500 });
    }

    // 匹配岗位（加兜底）
    const positionSlug = Object.keys(interviewData).find(
      (key) => interviewData[key].displayName === position
    ) || 'java-backend';

    const positionData = interviewData[positionSlug];
    const docs = buildInterviewDocs(positionData, position);
    const fallbackContext = buildFallbackContext(docs);
    await ensureVectorStore(positionSlug, docs);
    if (!positionData) {
      console.warn(`未找到岗位: ${position}，使用默认岗位: java-backend`);
    }

    // 按需构建向量（加容错）
    if (!Object.prototype.hasOwnProperty.call(vectorStoreCache, positionSlug)) {
      console.log(`首次访问 ${positionSlug}，开始构建向量存储...`);

      // 【优化2】构建 docs 数组，全面容错
      const docs = [
        ...(positionData.questions || []).map((q: any) => ({
          pageContent: `${q.category || '通用'}: ${q.question || ''} - 要点: ${(q.keyPoints || []).join(', ') || '无'}`,
          metadata: { category: q.category || '通用', difficulty: q.difficulty || '中等' }
        })),
        ...(positionData.knowledgeBase?.exampleAnswers 
          ? Object.entries(positionData.knowledgeBase.exampleAnswers).map(([q, a]) => ({
              pageContent: `问题: ${q} - 优秀回答: ${a}`,
              metadata: { type: 'example' }
            }))
          : []
        ),
        ...(positionData.knowledgeBase?.coreTechStack 
          ? [{
              pageContent: `核心技术栈: ${positionData.knowledgeBase.coreTechStack.join(', ') || '无'}`,
              metadata: { type: 'tech_stack' }
            }]
          : []
        ),
        ...(positionData.knowledgeBase?.commonExamPoints 
          ? [{
              pageContent: `常见考点: ${positionData.knowledgeBase.commonExamPoints.join(', ') || '无'}`,
              metadata: { type: 'exam_points' }
            }]
          : []
        )
      ];

      // 兜底：如果 docs 为空
      if (docs.length === 0) {
        docs.push({
          pageContent: `这是${position}岗位的通用面试场景，请面试官基于岗位特性出题。`,
          metadata: { type: 'fallback' }
        });
      }

      const embeddings = new CustomDashScopeEmbeddings({
        model: 'text-embedding-v2',
        apiKey: process.env.DASHSCOPE_API_KEY!,
      });

      vectorStoreCache[positionSlug] = await MemoryVectorStore.fromDocuments(docs, embeddings);
      console.log(`岗位 ${positionSlug} 向量构建完成，共 ${docs.length} 条文档`);
    }

    const vectorStore = vectorStoreCache[positionSlug];

   const qaPrompt = ChatPromptTemplate.fromTemplate(`
你是一位国内一线互联网公司拥有 8 年以上经验的资深 {position} 面试官。

【你的性格与说话风格】
1.  专业、严谨，但不失亲和力，偶尔会点头表示认可。
2.  你会像真人一样，先对候选人的上一个回答进行简短的点评或追问，然后再自然地过渡到下一个问题。
3.  口语化表达，不要用任何 Markdown 格式，不要用列表，就像面对面聊天一样。

【你的面试流程（请严格遵守）】
1.  **承接上一轮**：首先，根据“上下文”和“用户输入”，对候选人刚刚说的话做出反应：
    - 如果答得好：给予肯定（如“嗯，这个点理解得很到位。”），然后可以追问一个更深的细节。
    - 如果答得一般/有错误：委婉指出（如“这里可能需要再澄清一下...”），或者给一点提示，再问一次。
    - 如果没听懂：请候选人再解释一遍。
2.  **结合简历/题库出题**：如果有简历，优先深挖简历里的项目细节；如果没有，结合岗位核心知识点由浅入深地问。
3.  **控制节奏**：每次只问 1-2 个问题，不要一次性问太多，等候选人回答后再继续。

${resume ? `【候选人简历】\n这是候选人的简历，请重点关注里面的项目经历和技术栈，针对性提问：\n${resume}\n` : ''}

【参考知识库（仅供参考，不要照本宣科）】
{context}

【当前对话历史】
（请根据最后一句用户输入进行回应）

用户输入：{input}

请现在开始你的回应：`);
    const questionAnswerChain = await createStuffDocumentsChain({
      llm: model,
      prompt: qaPrompt
    });

    const retrievalChain = vectorStore
      ? await createRetrievalChain({
          combineDocsChain: questionAnswerChain,
          retriever: vectorStore.asRetriever({ k: 2 })
        })
      : null;

        // 🔥 修改后的 System Message
    const systemPrompt = new SystemMessage(
      `你是一位专业的 ${position} 面试官。请你：
      1. 用中文口语化交流，不要用任何 Markdown 格式。
      2. 每次先评价或追问上一个回答，再提出新问题。
      3. 结合简历深度挖掘项目细节。`
    );

    const fullMessages = [
      systemPrompt,
      ...processedMessages.map((m: { role: string; content: string }) =>
        m.role === 'user' ? new HumanMessage(m.content) : new SystemMessage(m.content)
      )
    ];

    const lastUserMessage = fullMessages[fullMessages.length - 1]?.content as string || '';

    let reply = '';

    // 🔥 修改后的第一次对话（更像真人的开场白）
    if (processedMessages.length <= 1) {
      reply = `你好！我是今天的 ${position}面试官。

${resume ? '我已经看过你的简历了，经历挺丰富的。' : '请先简单做个自我介绍吧，重点说说你熟悉的技术栈和最近做的一两个项目。'}

我们先从基础开始，慢慢聊。准备好了吗？`;
    } else {
      if (retrievalChain) {
        const ragResponse = await retrievalChain.invoke({
          input: lastUserMessage,
          position: position, // 🔥 补上这个
          resume: resume || '无简历', 
        });
        reply = ragResponse.answer;
      } else {
        const fallbackPrompt = await qaPrompt.invoke({
          context: fallbackContext,
          input: lastUserMessage,
          position,
        });
        const fallbackResponse = await model.invoke(fallbackPrompt.toChatMessages());
        reply =
          typeof fallbackResponse.content === 'string'
            ? fallbackResponse.content
            : String(fallbackResponse.content);
      }
      
      // 简单的保护：如果 AI 一下子问了太多问题，帮它截断一下
      const questionCount = (reply.match(/[?？]/g) || []).length;
      if (questionCount > 3) {
         // 不做太机械的截断，相信新的 Prompt
      }
    }

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('整体错误:', error.message);
    console.error('错误堆栈:', error.stack);
    return NextResponse.json({ error: error.message || '服务器错误，请稍后重试' }, { status: 500 });
  }
}
