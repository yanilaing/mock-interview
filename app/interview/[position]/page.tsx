"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '../../../lib/supabase';
import {
  getInterviewRecordOwnerId,
  migrateInterviewRecordsToAccount,
} from '../../../lib/interview-records';
import { buildInterviewGuidance } from '../../../lib/interview-guidance';
import {
  startSpeechCapture,
  type SpeechCaptureSession,
} from '../../../lib/speech';

// ========== PDF.js和mammoth动态导入 ==========
type PdfJsModule = typeof import('pdfjs-dist');
type MammothModule = {
  extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
};

let pdfjsLib: PdfJsModule | null = null;
let mammoth: MammothModule | null = null;
const INTERVIEW_DURATION_SECONDS = 20 * 60;
const INTERVIEW_ENDING_REMINDER_SECONDS = 60;

const loadPdfJs = async () => {
  if (typeof window === 'undefined') return;

  if (!pdfjsLib) {
    const pdfModule = await import('pdfjs-dist');
    pdfjsLib = pdfModule;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }

  return pdfjsLib;
};

const loadMammoth = async () => {
  if (!mammoth) {
    const mammothModule = await import('mammoth');
    mammoth = ('default' in mammothModule ? mammothModule.default : mammothModule) as unknown as MammothModule;
  }

  return mammoth;
};

const positionMap: Record<string, string> = {
  'java-backend': 'Java 后端开发',
  'web-frontend': 'Web 前端开发',
  'python-algorithm': 'Python 算法工程师',
};

type ChatMessage = { role: 'user' | 'ai'; content: string };
type EndInterviewOptions = {
  finalMessages?: ChatMessage[];
  appendClosingNotice?: boolean;
};

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const positionSlug = params.position as string;
  const position = positionMap[positionSlug] || 'Java 后端开发（未知岗位）';

  // ========== 核心状态 ==========
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [resume, setResume] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  // ========== 语音相关 ==========
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const speechSessionRef = useRef<SpeechCaptureSession | null>(null);
  const contextWindowRef = useRef<string[]>([]);

  // ========== 面试控制 ==========
  const [remainingTime, setRemainingTime] = useState(INTERVIEW_DURATION_SECONDS);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [isInterviewEnded, setIsInterviewEnded] = useState(false);
  const [isClosingStage, setIsClosingStage] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [startingInterview, setStartingInterview] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const endInterviewRef = useRef<
    (endReason?: 'manual' | 'timeout', options?: EndInterviewOptions) => Promise<void>
  >(async () => undefined);
  const hasShownEndingReminderRef = useRef(false);
  const isEndingInterviewRef = useRef(false);

  // ========== 登录校验 ==========
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  // ========== 时间格式化 ==========
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ========== 登录检查 ==========
  const checkLogin = useCallback(() => {
    const authToken = localStorage.getItem('authing_token');
    if (!authToken) {
      alert('请先登录后再进行面试！');
      router.push(`/sign-in?redirect=${encodeURIComponent(window.location.pathname)}`);
      return false;
    }
    return true;
  }, [router]);

  useEffect(() => {
    if (!checkLogin()) {
      setIsLoggedIn(false);
    }
  }, [checkLogin]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      const currentSession = speechSessionRef.current;
      speechSessionRef.current = null;
      if (currentSession) {
        void currentSession.cancel().catch(() => undefined);
      }
    };
  }, []);

  // ========== 倒计时 ==========
  useEffect(() => {
    if (!isInterviewActive || isInterviewEnded) return;

    timerRef.current = setInterval(() => {
      setRemainingTime((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isInterviewActive, isInterviewEnded]);

  useEffect(() => {
    if (!isInterviewActive || isInterviewEnded) return;

    if (
      remainingTime > 0 &&
      remainingTime <= INTERVIEW_ENDING_REMINDER_SECONDS &&
      !hasShownEndingReminderRef.current
    ) {
      hasShownEndingReminderRef.current = true;
      setIsClosingStage(true);
      setMessages((prev) => {
        const nextMessages = [
          ...prev,
          {
            role: 'ai' as const,
            content:
              '时间差不多了，我们做最后收尾。你可以用这 1 分钟简要总结一下你的项目亮点、技术取舍和还想优化的点。',
          },
        ];
        messagesRef.current = nextMessages;
        return nextMessages;
      });
    }

    if (remainingTime === 0 && !isEndingInterviewRef.current) {
      void endInterviewRef.current('timeout');
    }
  }, [isInterviewActive, isInterviewEnded, remainingTime]);

  // ========== 自动滚动 ==========
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isInterviewEnded]);

  // ========== 文档解析 ==========
  const parseFileContent = useCallback(async (file: File): Promise<string> => {
    const fileName = file.name.toLowerCase();
    setLoadingFile(true);

    try {
      if (fileName.endsWith('.txt')) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }

      if (fileName.endsWith('.pdf')) {
        const pdfjs = await loadPdfJs();
        if (!pdfjs) {
          throw new Error('PDF 解析器初始化失败，请刷新页面后重试');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument(arrayBuffer).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ');
        fullText += pageText + '\n';
      }
        return fullText;
      }

      if (fileName.endsWith('.docx')) {
        const mammothLib = await loadMammoth();
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammothLib.extractRawText({ arrayBuffer });
        return result.value;
      }

      if (fileName.endsWith('.doc')) {
        throw new Error('不支持 .doc 格式，请转换为 .docx 或 .pdf 格式后重试');
      }

      throw new Error('不支持的文件格式，请上传 .txt / .docx / .pdf 文件');
    } finally {
      setLoadingFile(false);
    }
  }, []);

  const rememberContext = useCallback((text: string) => {
    const normalized = text.trim();
    if (!normalized) return;

    const history = contextWindowRef.current;
    if (history[history.length - 1] !== normalized) {
      history.push(normalized);
    }
  }, []);

  // ========== 文件上传 ==========
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await parseFileContent(file);
      setResume(content);
      alert('简历文件解析成功！内容已填入文本框，可编辑后开始面试。');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      console.error('文件解析失败:', err);
      alert(`文件解析失败：${message}`);
    }

    e.target.value = '';
  };

  // ========== 🔥 修复1：保存面试记录（接收真实分数参数） ==========
  const saveInterviewRecord = async (
    feedbackToSave?: string,
    finalScore: number = 50,
    conversationToSave?: ChatMessage[]
  ) => {
    if (!checkLogin()) return;

    setSavingRecord(true);
    try {
      const recordConversation = conversationToSave ?? messagesRef.current;
      const totalSeconds = INTERVIEW_DURATION_SECONDS - remainingTime;
      const durationText = `${Math.floor(totalSeconds / 60)}分${totalSeconds % 60}秒`;

      const ownerId = await getInterviewRecordOwnerId();
      if (!ownerId) {
        /*
        throw new Error('褰撳墠璐﹀彿鏍囪瘑涓㈠け锛岃閲嶆柊鐧诲綍鍚庡啀璇曘€?);
      }

        */
        throw new Error('Account ID is missing. Please sign in again and retry.');
      }

      await migrateInterviewRecordsToAccount(ownerId);
      const supabase = getSupabaseClient();

      // 🔥 核心修复：直接使用传进来的真实分数，不再用State兜底
      const { error } = await supabase
        .from('user_interview_records')
        .insert([
          {
            user_id: ownerId,
            interview_topic: position,
            user_answer: recordConversation
              .map((msg) => `${msg.role === 'user' ? '我' : '面试官'}：${msg.content}`)
              .join('\n'),
            ai_feedback: feedbackToSave || feedback || '暂无反馈',
            score: finalScore,
            duration: durationText,
            tags: [positionSlug],
            created_at: new Date().toISOString(),
            conversation: recordConversation,
          },
        ]);

      if (error) {
        if (error.message.includes('RLS')) {
          throw new Error('权限错误：无法保存记录，请检查登录状态');
        } else {
          throw new Error(error.message);
        }
      }
      alert('面试记录保存成功！');
      router.push('/growth');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      console.error('数据库插入失败:', err);
      alert(`保存失败：${message}`);
    } finally {
      setSavingRecord(false);
    }
  };

  // ========== 开始面试 ==========
  const handleStartInterview = async () => {
    if (!checkLogin()) return;

    hasShownEndingReminderRef.current = false;
    isEndingInterviewRef.current = false;
    setIsClosingStage(false);
    setRemainingTime(INTERVIEW_DURATION_SECONDS);
    setIsInterviewEnded(false);
    setFeedback('');
    contextWindowRef.current = [];
    setStartingInterview(true);
    setIsInterviewActive(true);

      try {
        const startMessage = '面试官好，请开始模拟面试吧。';
        const userMsg = { role: 'user' as const, content: startMessage };
        messagesRef.current = [userMsg];
        setMessages([userMsg]);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [userMsg],
          position,
          resume: resume.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setMessages((prev) => {
          const nextMessages = [...prev, { role: 'ai' as const, content: `错误：${data.error}` }];
          messagesRef.current = nextMessages;
          return nextMessages;
        });
      } else {
        setMessages((prev) => {
          const nextMessages = [...prev, { role: 'ai' as const, content: data.reply }];
          messagesRef.current = nextMessages;
          return nextMessages;
        });
      }
    } catch (err) {
      console.error('开始面试失败:', err);
      messagesRef.current = [{ role: 'ai', content: '网络错误，面试启动失败，请刷新页面重试。' }];
      setMessages(messagesRef.current);
      setIsInterviewActive(false);
    } finally {
      setStartingInterview(false);
      }
  };

  // ========== 🔥 修复2：结束面试（直接传递真实分数） ==========
  async function handleEndInterview(
    endReason: 'manual' | 'timeout' = 'manual',
    options?: EndInterviewOptions
  ) {
    if (isEndingInterviewRef.current) return;
    isEndingInterviewRef.current = true;

    const closingNotice =
      endReason === 'timeout'
        ? '时间到了，今天的模拟面试到此结束。稍后系统会根据你刚才的表现生成反馈总结。'
        : '本场模拟面试先到这里。稍后系统会生成本次模拟的反馈总结。';
    const finalMessages = options?.finalMessages ?? messagesRef.current;
    const shouldAppendClosingNotice = options?.appendClosingNotice !== false;
    const closingNoticeMessage = { role: 'ai' as const, content: closingNotice };
    const recordConversation = shouldAppendClosingNotice
      ? [...finalMessages, closingNoticeMessage]
      : finalMessages;

    const currentSession = speechSessionRef.current;
    speechSessionRef.current = null;
    if (currentSession) {
      setIsRecording(false);
      await currentSession.cancel().catch(() => undefined);
    }

    if (timerRef.current) clearInterval(timerRef.current);
    setIsInterviewActive(false);
    setIsInterviewEnded(true);
    setIsClosingStage(false);
    contextWindowRef.current = [];
    setLoadingFeedback(true);
    if (shouldAppendClosingNotice) {
      messagesRef.current = recordConversation;
      setMessages(recordConversation);
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'END_INTERVIEW',
          messages: finalMessages,
          position,
        }),
      });

      const data = await res.json();

      let feedbackContent = '暂无反馈';
      let realFinalScore = 50;

      if (data.score !== undefined && data.score !== null && !isNaN(data.score)) {
        realFinalScore = Math.min(100, Math.max(0, data.score));
        console.log('✅ 收到 AI 返回的最终分数：', realFinalScore);
      }

      if (data.feedback) {
        feedbackContent =
          endReason === 'timeout'
            ? `今天的模拟面试到此结束。\n\n${data.feedback}`
            : data.feedback;
        setFeedback(feedbackContent);
      } else if (data.error) {
        feedbackContent = `生成反馈失败：${data.error}`;
        setFeedback(feedbackContent);
      }

      await saveInterviewRecord(feedbackContent, realFinalScore, recordConversation);
    } catch (err) {
      console.error('生成反馈错误:', err);
      const errorFeedback = '生成反馈时发生网络错误，请刷新页面重试。';
      setFeedback(errorFeedback);
      await saveInterviewRecord(errorFeedback, 50, recordConversation);
    } finally {
      setLoadingFeedback(false);
    }
  }

  // ========== 语音识别 ==========
  useEffect(() => {
    endInterviewRef.current = handleEndInterview;
  });

  const startRecording = async () => {
    if (!isInterviewActive || isInterviewEnded || isRecording || isTranscribing) return;

    try {
      speechSessionRef.current = await startSpeechCapture();
      setIsRecording(true);
      console.log('开始录音...');
    } catch (err) {
      console.error('获取麦克风权限失败:', err);
      alert('无法获取麦克风权限，请检查浏览器设置');
    }
  };

  const stopRecording = async () => {
    const currentSession = speechSessionRef.current;
    if (!currentSession || !isRecording) {
      return;
    }

    speechSessionRef.current = null;
    setIsRecording(false);
    setIsTranscribing(true);

    try {
      const payload = await currentSession.stop();

      if ('text' in payload) {
        setInput(payload.text);
        rememberContext(payload.text);
        return;
      }

      const res = await fetch('/api/speech-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          context: contextWindowRef.current.slice(-3).join('\n'),
          positionSlug,
        }),
      });

      const data = await res.json();
      if (data.text) {
        setInput(data.text);
        rememberContext(data.text);
      } else if (data.error) {
        const errorMessage = String(data.error || '');
        const isInvalidApiKey = /InvalidApiKey|401/i.test(errorMessage);
        alert(
          isInvalidApiKey
            ? '语音识别服务配置无效，当前云端识别不可用。请先修复 DASHSCOPE_API_KEY，或改用浏览器内置识别/直接打字。'
            : `识别失败: ${errorMessage}`
        );
      }
    } catch (err: unknown) {
      console.error('识别请求错误:', err);
      const message = err instanceof Error ? err.message : '语音识别失败，请重试或直接打字';
      alert(message);
    } finally {
      setIsTranscribing(false);
      console.log('停止录音，正在识别...');
    }
  };

  const cancelRecording = async () => {
    const currentSession = speechSessionRef.current;
    if (!currentSession || !isRecording) {
      return;
    }

    speechSessionRef.current = null;
    try {
      await currentSession.cancel();
    } finally {
      setIsRecording(false);
    }
  };

  // ========== 发送消息 ==========
  const sendMessage = async () => {
    if (!isInterviewActive || isInterviewEnded) return;

    const userMsg = { role: 'user' as const, content: input.trim() || '无内容' };
    const updatedMessages = [...messagesRef.current, userMsg];
    const shouldWrapUp = isClosingStage || remainingTime <= INTERVIEW_ENDING_REMINDER_SECONDS;

    messagesRef.current = updatedMessages;
    setMessages(updatedMessages);
    setInput('');
    if (input.trim()) rememberContext(input.trim());

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          position,
          resume: resume.trim() || undefined,
          interviewStage: shouldWrapUp ? 'closing' : 'main',
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages((prev) => {
          const nextMessages = [...prev, { role: 'ai' as const, content: `错误：${data.error}` }];
          messagesRef.current = nextMessages;
          return nextMessages;
        });
      } else {
        const aiReply = { role: 'ai' as const, content: data.reply };
        const nextMessages = [...updatedMessages, aiReply];
        messagesRef.current = nextMessages;
        setMessages(nextMessages);

        if (shouldWrapUp) {
          await handleEndInterview('manual', {
            finalMessages: nextMessages,
            appendClosingNotice: false,
          });
        }
      }
    } catch {
      setMessages((prev) => {
        const nextMessages = [...prev, { role: 'ai' as const, content: '网络错误，请检查控制台' }];
        messagesRef.current = nextMessages;
        return nextMessages;
      });
    }
  };

  // ========== 未登录渲染 ==========
  if (!isLoggedIn) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-cyan-50">
        <Link
          href="/"
          className="absolute left-6 top-6 inline-flex items-center text-gray-600 hover:text-indigo-600 transition"
        >
          ← 返回首页
        </Link>
        <div className="text-center">
          <div className="text-xl text-gray-600">正在跳转到登录页面...</div>
        </div>
      </div>
    );
  }

  const interviewGuidance = buildInterviewGuidance(feedback);
  const reportSummary = interviewGuidance.reportSummary || feedback;

  // ========== 主渲染 ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-cyan-50 p-6 flex flex-col">
      <div className="max-w-4xl mx-auto w-full mb-4">
        <Link href="/" className="inline-flex items-center text-gray-600 hover:text-indigo-600 transition">
          ← 返回首页
        </Link>
      </div>

      {/* 顶部栏 */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-sm mb-6 max-w-4xl mx-auto w-full">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-indigo-800 whitespace-nowrap">
            AI 模拟面试 - {position}岗
          </h1>

          <button
            onClick={() => router.push('/growth')}
            className="px-4 py-2 bg-indigo-100 text-indigo-800 font-bold rounded-lg hover:bg-indigo-200 transition whitespace-nowrap"
          >
            📊 我的面试记录
          </button>

          {isInterviewActive && !isInterviewEnded && (
            <div className="flex items-center gap-4 shrink-0">
              <div
                className={`px-4 py-2 rounded-lg transition-colors font-bold whitespace-nowrap ${
                  remainingTime < 60
                    ? 'bg-red-100 text-red-600 animate-pulse'
                    : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                剩余：{formatTime(remainingTime)}
              </div>
              <button
                onClick={() => {
                  void handleEndInterview();
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium shadow whitespace-nowrap"
              >
                提前结束面试
              </button>
            </div>
          )}
          {isInterviewEnded && (
            <div className="text-lg font-bold text-gray-600 flex items-center gap-2">
              ✅ 面试已结束
              {savingRecord && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 简历上传区 */}
      {!isInterviewEnded && (
        <div className="max-w-4xl mx-auto w-full mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            先上传或粘贴简历（强烈推荐，让 AI 更针对性出题）
          </label>
          <div className="flex gap-3 mb-3">
            <textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="粘贴简历内容，或上传文件（支持 .txt / .docx / .pdf）"
              className="flex-1 h-40 p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition disabled:bg-gray-50 disabled:cursor-not-allowed"
              disabled={isInterviewActive}
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isInterviewActive || loadingFile}
              >
                {loadingFile ? '解析中...' : '上传简历文件'}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".txt,.docx,.pdf"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isInterviewActive}
              />
              {!isInterviewActive && (
                <button
                  onClick={handleStartInterview}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-medium disabled:opacity-50"
                  disabled={startingInterview}
                >
                  {startingInterview ? '启动中...' : '开始面试'}
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-500">
            {isInterviewActive
              ? '面试进行中，简历已锁定。'
              : '上传后内容会自动填入文本框，你可以编辑后点击「开始面试」。'}
          </p>
        </div>
      )}

      {/* 聊天区 */}
      <div className="flex-1 overflow-y-auto mb-6 space-y-4 max-w-4xl mx-auto w-full">
        {!isInterviewActive && messages.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            请先上传/填写简历，点击「开始面试」进入模拟环节
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] p-4 rounded-2xl shadow ${
                msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />

        {isInterviewEnded && (
          <div className="mt-8 p-6 bg-white rounded-2xl shadow-lg border border-indigo-100">
            <h2 className="text-2xl font-bold text-indigo-800 mb-4 flex items-center gap-2">
              📋 面试结束 | 专属反馈报告
            </h2>
            {loadingFeedback ? (
              <div className="flex items-center justify-center py-10 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
                正在生成专业反馈，请稍候...
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-indigo-800 mb-3">评估报告</h3>
                  <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                    {reportSummary}
                  </div>
                </div>

                {interviewGuidance.suggestions.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-indigo-800 mb-3">五维提升建议</h3>
                    <div className="space-y-3">
                      {interviewGuidance.suggestions.map((item, index) => (
                        <div
                          key={`${index}-${item}`}
                          className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4"
                        >
                          <div className="text-sm font-semibold text-indigo-700 mb-1">
                            建议 {index + 1}
                          </div>
                          <div className="text-sm text-gray-700 leading-7">{item}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {interviewGuidance.practicePlan.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-indigo-800 mb-3">7 天练习计划</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {interviewGuidance.practicePlan.map((item) => (
                        <div
                          key={item.day}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
                              {item.day}
                            </span>
                            <span className="text-sm text-slate-500">{item.focus}</span>
                          </div>
                          <div className="text-sm font-medium text-slate-800 leading-6 mb-2">
                            {item.task}
                          </div>
                          <div className="text-xs text-slate-600 leading-5 mb-2">
                            复盘要求：{item.review}
                          </div>
                          <div className="text-xs text-slate-500 leading-5">
                            完成标准：{item.goal}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部输入区 */}
      {isInterviewActive && !isInterviewEnded && (
        <div className="flex gap-3 max-w-4xl mx-auto w-full">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder={isClosingStage ? '最后 1 分钟，做个简短总结...' : '输入你的回答，或按住右侧按钮说话...'}
            className="flex-1 p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={cancelRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            onTouchCancel={cancelRecording}
            disabled={isTranscribing}
            className={`px-6 py-4 rounded-xl text-white font-medium transition ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                : isTranscribing
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isRecording ? '正在录音...' : isTranscribing ? '识别中...' : '🎤 按住说话'}
          </button>
          <button
            onClick={sendMessage}
            className="px-8 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-medium"
            disabled={!input.trim()}
          >
            发送
          </button>
        </div>
      )}
    </div>
  );
}
