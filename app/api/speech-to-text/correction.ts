const COMMON_TERMS = [
  'API',
  'SDK',
  'HTTP',
  'HTTPS',
  'TCP',
  'DNS',
  'CDN',
  'Node.js',
  'Java',
  'Python',
  'JavaScript',
  'TypeScript',
  'Go',
  'Rust',
  'Docker',
  'Kubernetes',
  'CI/CD',
  'Git',
  'Linux',
  'Redis',
  'MySQL',
  'MongoDB',
  'PostgreSQL',
  'JWT',
  'OAuth',
  'REST',
  'GraphQL',
  'WebSocket',
  'async',
  'await',
  'Promise',
  'TCP/IP',
  'Nginx',
  'Kafka',
];

const POSITION_TERMS: Record<string, string[]> = {
  'java-backend': [
    'JVM',
    'JDK',
    'JRE',
    'GC',
    'Minor GC',
    'Major GC',
    'Full GC',
    'G1GC',
    'Spring',
    'Spring Boot',
    'Spring MVC',
    'Spring Cloud',
    'Spring Security',
    'Spring AOP',
    'Bean',
    'IOC',
    'DI',
    'ApplicationContext',
    'CGLIB',
    'Transactional',
    'REQUIRED',
    'REQUIRES_NEW',
    'SUPPORTS',
    'NOT_SUPPORTED',
    'MANDATORY',
    'NEVER',
    'NESTED',
    'Propagation',
    'rollback',
    'savepoint',
    'READ_UNCOMMITTED',
    'READ_COMMITTED',
    'REPEATABLE_READ',
    'SERIALIZABLE',
    'ACID',
    'synchronized',
    'volatile',
    'ThreadLocal',
    'ReentrantLock',
    'ConcurrentHashMap',
    'HashMap',
    'AtomicInteger',
    'ExecutorService',
    'ThreadPoolExecutor',
    'CompletableFuture',
    'MyBatis',
    'Hibernate',
    'JPA',
    'MVCC',
    'B+Tree',
    'CAP',
    'BASE',
    'RabbitMQ',
    'Sentinel',
    'Hystrix',
    'Dubbo',
    'gRPC',
    'Snowflake',
    'TCC',
    'Saga',
    '2PC',
  ],
  'web-frontend': [
    'React',
    'React Router',
    'useEffect',
    'useState',
    'useRef',
    'useContext',
    'useReducer',
    'React.memo',
    'Suspense',
    'Fiber',
    'Virtual DOM',
    'Redux',
    'Redux Toolkit',
    'RTK Query',
    'Vue',
    'Vue 3',
    'Composition API',
    'Next.js',
    'SSR',
    'SSG',
    'ISR',
    'Vite',
    'Webpack',
    'Rollup',
    'Tree Shaking',
    'Code Splitting',
    'ESLint',
    'Prettier',
    'Tailwind CSS',
    'CSS Modules',
    'Flexbox',
    'Grid',
    'XSS',
    'CSRF',
    'CSP',
    'HttpOnly',
    'SameSite',
    'Service Worker',
    'SSE',
    'requestIdleCallback',
    'LCP',
    'INP',
    'CLS',
    'Web Vitals',
    'Lighthouse',
    'Module Federation',
    'Storybook',
    'RBAC',
    'Playwright',
    'Jest',
    'Sentry',
  ],
  'python-algorithm': [
    'GIL',
    'CPython',
    'asyncio',
    'multiprocessing',
    'threading',
    'generator',
    'iterator',
    'coroutine',
    'yield',
    'functools',
    'decorator',
    'lambda',
    'BFS',
    'DFS',
    'Dijkstra',
    'Bellman-Ford',
    'Quicksort',
    'Mergesort',
    'Trie',
    'dynamic programming',
    'memoization',
    'backtracking',
    'sliding window',
    'two pointers',
    'NumPy',
    'Pandas',
    'Scikit-learn',
    'TensorFlow',
    'PyTorch',
    'XGBoost',
    'LightGBM',
    'CatBoost',
    'Dropout',
    'BatchNorm',
    'ReLU',
    'softmax',
    'CNN',
    'RNN',
    'LSTM',
    'Transformer',
    'BERT',
    'AUC-ROC',
    'F1-score',
    'Precision',
    'Recall',
    'MAE',
    'MSE',
    'RMSE',
    'FastAPI',
    'Flask',
    'uvicorn',
    'gunicorn',
    'Polars',
    'Spark',
    'MapReduce',
    'A/B test',
  ],
};

const NORMALIZATION_RULES: Array<[RegExp, string]> = [
  [/\bnode\s*\.?\s*js\b/gi, 'Node.js'],
  [/\bnext\s*\.?\s*js\b/gi, 'Next.js'],
  [/\bvue\s*\.?\s*js\b/gi, 'Vue.js'],
  [/\bjava\s*script\b/gi, 'JavaScript'],
  [/\btype\s*script\b/gi, 'TypeScript'],
  [/\breact\s*js\b/gi, 'React'],
  [/\bspring\s*boot\b/gi, 'Spring Boot'],
  [/\bspring\s*cloud\b/gi, 'Spring Cloud'],
  [/\bspring\s*mvc\b/gi, 'Spring MVC'],
  [/\bspring\s*security\b/gi, 'Spring Security'],
  [/\bspring\s*aop\b/gi, 'Spring AOP'],
  [/\bpostgre\s*sql\b/gi, 'PostgreSQL'],
  [/\bmy\s*sql\b/gi, 'MySQL'],
  [/\bmongo\s*db\b/gi, 'MongoDB'],
  [/\bweb\s*socket\b/gi, 'WebSocket'],
  [/\bgraph\s*ql\b/gi, 'GraphQL'],
  [/\boauth\b/gi, 'OAuth'],
  [/\bgil\b/gi, 'GIL'],
  [/\bgrpc\b/gi, 'gRPC'],
  [/\bcicd\b/gi, 'CI/CD'],
  [/\bci\/cd\b/g, 'CI/CD'],
  [/\bapi\b/gi, 'API'],
  [/\bsdk\b/gi, 'SDK'],
  [/\bhttp\b/gi, 'HTTP'],
  [/\bhttps\b/gi, 'HTTPS'],
  [/\btcp\/ip\b/gi, 'TCP/IP'],
  [/\bjwt\b/gi, 'JWT'],
  [/\bcss\b/gi, 'CSS'],
  [/\bhtml\b/gi, 'HTML'],
  [/\bjs\b/g, 'JS'],
  [/\bts\b/g, 'TS'],
  [/\bpython\b/gi, 'Python'],
  [/\bjava\b/gi, 'Java'],
  [/\btypescript\b/gi, 'TypeScript'],
  [/\bjavascript\b/gi, 'JavaScript'],
];

const uniqueTerms = (positionSlug: string) =>
  Array.from(new Set([...COMMON_TERMS, ...(POSITION_TERMS[positionSlug] ?? [])]));

const sanitizeContext = (context: string) =>
  context
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-3)
    .join(' | ')
    .slice(0, 400);

export const normalizeASRText = (input: string) => {
  let output = input.trim();

  for (const [pattern, replacement] of NORMALIZATION_RULES) {
    output = output.replace(pattern, replacement);
  }

  return output.replace(/\s{2,}/g, ' ').trim();
};

export const buildSpeechRecognitionSystemPrompt = (
  positionSlug: string,
  context: string,
) => {
  const glossary = uniqueTerms(positionSlug).slice(0, 120).join(', ');
  const contextHint = sanitizeContext(context);

  return [
    '你是技术面试场景的语音转写器。',
    '只做忠实转写，不总结、不补充、不解释。',
    '遇到技术术语时，优先保留英文原文和正确大小写，不要翻译成中文。',
    '如果语音里同时包含中文和英文，请直接输出中英混排结果。',
    '重点关注这些技术词汇：',
    glossary,
    contextHint ? `上文仅用于消歧，不要复述：${contextHint}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};

const buildCorrectionSystemPrompt = (positionSlug: string) => {
  const glossary = uniqueTerms(positionSlug).join(', ');

  return [
    '你是计算机技术面试场景的 ASR 后处理纠错器。',
    '你的任务是修正语音识别里的技术术语、英文单词、大小写和明显的同音误识别。',
    '规则：',
    '1. 只在你有足够把握时纠错，没有把握就保留原文。',
    '2. 不要删除原文里已经正确的英文技术词。',
    '3. 不要翻译原文，只做纠错。',
    '4. 输出最终纠错后的文本，不要加解释。',
    `当前可参考的技术词汇表：${glossary}`,
  ].join('\n');
};

export async function correctASRText(
  rawText: string,
  context: string = '',
  positionSlug: string = 'java-backend',
): Promise<string> {
  const normalizedRawText = normalizeASRText(rawText);
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    console.warn('未配置 DASHSCOPE_API_KEY，跳过纠错');
    return normalizedRawText;
  }

  const userContent = context
    ? `上文上下文（仅用于判断术语，不要复述）：\n${sanitizeContext(
        context,
      )}\n\n待纠错文本：\n${normalizedRawText}`
    : normalizedRawText;

  try {
    const response = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [
            { role: 'system', content: buildCorrectionSystemPrompt(positionSlug) },
            { role: 'user', content: userContent },
          ],
          temperature: 0,
          max_tokens: 300,
        }),
      },
    );

    if (!response.ok) {
      console.warn(`ASR 纠错请求失败: ${response.status}`);
      return normalizedRawText;
    }

    const data = await response.json();
    const correctedText = data.choices?.[0]?.message?.content?.trim();
    return normalizeASRText(correctedText || normalizedRawText);
  } catch (error) {
    console.warn('ASR 纠错异常，降级返回原始识别结果', error);
    return normalizedRawText;
  }
}
