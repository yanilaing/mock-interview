"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '../../lib/supabase';
import {
  buildDimensionScores,
  extractTotalScore,
  normalizeInterviewFeedback,
  normalizeTotalScore,
} from '../../lib/interview-feedback';
import { buildInterviewGuidance } from '../../lib/interview-guidance';
import {
  getInterviewRecordOwnerId,
  migrateInterviewRecordsToAccount,
} from '../../lib/interview-records';

// ========== 1. 类型定义（适配 Supabase 真实字段） ==========
interface InterviewRecord {
  id: string;
  user_id: string;
  interview_topic: string;
  created_at: string;
  duration: string;
  score: number;
  ai_feedback: string;
  conversation: InterviewMessage[] | null;
  has_resume?: boolean;
  tags?: string[] | string;
}

type InterviewMessage = {
  role: 'user' | 'ai';
  content: string;
};

// ========== 岗位映射表 ==========
const positionFilterMap = {
  'all': { label: '全部岗位', slug: 'all', topic: '' },
  'java-backend': { label: 'Java 后端开发', slug: 'java-backend', topic: 'Java 后端开发' },
  'web-frontend': { label: 'Web前端开发', slug: 'web-frontend', topic: 'Web 前端开发' },
  'python-algorithm': { label: 'Python算法工程师', slug: 'python-algorithm', topic: 'Python算法工程师' },
};

// ========== 2. 页面主组件 ==========
export default function GrowthPage() {
  const router = useRouter();
  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [recordOwnerId, setRecordOwnerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<InterviewRecord | null>(null);
  const [filterPosition, setFilterPosition] = useState<string>('all');

  // ========== 3. 加载数据 ==========
  useEffect(() => {
    const fetchUserRecords = async () => {
      try {
        const ownerId = await getInterviewRecordOwnerId();
        if (!ownerId) {
          alert('请先登录查看面试记录');
          router.push('/sign-in');
          return;
        }

        setRecordOwnerId(ownerId);
        await migrateInterviewRecordsToAccount(ownerId);
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('user_interview_records')
          .select('*')
          .eq('user_id', ownerId)
          .order('created_at', { ascending: false });

        if (error) {
          if (error.message.includes('RLS')) {
            throw new Error('权限错误：无法查看记录，请检查登录状态');
          } else {
            throw new Error(error.message);
          }
        }
        setRecords(data || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '未知错误';
        setError(`加载失败：${message}`);
        console.error('查询记录失败:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRecords();
  }, [router]);

  // ========== 辅助函数 ==========
  const extractTags = (feedback: string) => {
    if (!feedback) return ['暂无标签'];
    return [feedback.substring(0, 15) + '...'];
  };

  const getNormalizedRecordScore = (record: InterviewRecord) => {
    if (typeof record.score === 'number' && !isNaN(record.score)) {
      return normalizeTotalScore(record.score);
    }

    const feedbackTotalScore = extractTotalScore(record.ai_feedback);
    return feedbackTotalScore ?? 0;
  };

  const getDisplayScore = (record: InterviewRecord) => {
    return buildDimensionScores(record.ai_feedback, getNormalizedRecordScore(record))
      .reduce((sum, item) => sum + item.score, 0);
  };

  const getDisplayFeedback = (record: InterviewRecord) => {
    if (!record.ai_feedback) {
      return record.ai_feedback;
    }

    return normalizeInterviewFeedback(record.ai_feedback, getNormalizedRecordScore(record)).feedback;
  };

  const getRecordGuidance = (record: InterviewRecord) => {
    return buildInterviewGuidance(getDisplayFeedback(record), getDisplayScore(record));
  };

  const getDisplaySummary = (record: InterviewRecord) => {
    const guidance = getRecordGuidance(record);
    return guidance.reportSummary || getDisplayFeedback(record);
  };

  const extractDimensionScores = (aiFeedback: string, recordTotalScore: number) => {
    return buildDimensionScores(aiFeedback, normalizeTotalScore(recordTotalScore));
  };

  // 🔥 筛选逻辑
  const filteredRecords = filterPosition === 'all' 
    ? records 
    : records.filter(r => {
        const filterConfig = positionFilterMap[filterPosition as keyof typeof positionFilterMap];
        if (!filterConfig) return false;

        let parsedTags: string[] = [];
        try {
          parsedTags = typeof r.tags === 'string' ? JSON.parse(r.tags) : (Array.isArray(r.tags) ? r.tags : []);
        } catch {
          parsedTags = [];
        }
        const matchTag = parsedTags.includes(filterConfig.slug);

        const rawTopic = r.interview_topic || '';
        const normalizedTopic = rawTopic.replace(/\s+/g, '').toLowerCase();
        const normalizedFilterTopic = filterConfig.topic.replace(/\s+/g, '').toLowerCase();
        const matchTopic = normalizedTopic.includes(normalizedFilterTopic);

        return matchTag || matchTopic;
      });

  // 计算数据
  const totalSessions = records.length;
  const totalDuration = records.reduce((sum, r) => {
    const minMatch = r.duration.match(/(\d+)分/);
    const secMatch = r.duration.match(/(\d+)秒/);
    const min = minMatch ? parseInt(minMatch[1]) : 0;
    const sec = secMatch ? parseInt(secMatch[1]) : 0;
    return sum + min * 60 + sec;
  }, 0);
  const avgScore = totalSessions > 0 
    ? Math.round(records.reduce((sum, r) => sum + getDisplayScore(r), 0) / totalSessions) 
    : 0;
  const uniquePositions = [...new Set(records.map(r => r.interview_topic))].length;

  const growthTrendData = records.slice().reverse().map((r) => ({
    date: new Date(r.created_at).toLocaleDateString().slice(5),
    score: getDisplayScore(r)
  }));
  const CHART_TOP = 10;
  const CHART_BOTTOM = 90;
  const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP;
  const CHART_MAX_SCORE = 100;
  const getTrendPointX = (index: number) => {
    if (growthTrendData.length <= 1) {
      return 50;
    }

    return 10 + (index * 80) / (growthTrendData.length - 1);
  };
  const getTrendPointY = (score: number) => {
    const normalizedScore = Math.max(0, Math.min(CHART_MAX_SCORE, score));
    return CHART_BOTTOM - (normalizedScore / CHART_MAX_SCORE) * CHART_HEIGHT;
  };
  const selectedRecordGuidance = selectedRecord ? getRecordGuidance(selectedRecord) : null;

  // ========== 删除记录 ==========
  const deleteRecord = async (id: string) => {
    if (!recordOwnerId) {
      /*
      alert('褰撳墠璐﹀彿鏍囪瘑涓㈠け锛岃鍒锋柊椤甸潰鍚庨噸璇曘€?);
      */
      alert('Account ID is missing. Please refresh and try again.');
      return;
    }

    if (!confirm('确定要删除这条面试记录吗？')) return;
    
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('user_interview_records')
        .delete()
        .eq('id', id)
        .eq('user_id', recordOwnerId);

      if (error) throw new Error(error.message);
      setRecords((current) => current.filter((record) => record.id !== id));
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
      alert('记录删除成功！');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      alert(`删除失败：${message}`);
    }
  };

  // ========== 加载/错误状态 ==========
  if (loading) {
    return (
      <div className="relative min-h-screen bg-[#f8fcff] flex items-center justify-center">
        <Link href="/" className="absolute left-6 top-6 inline-flex items-center text-gray-600 hover:text-[#6ba6e7] transition">
          ← 返回首页
        </Link>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6ba6e7] mx-auto mb-4"></div>
          <p className="text-gray-600">加载面试记录中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8fcff] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="p-4 bg-red-100 text-red-700 rounded-xl mb-6">{error}</div>
          <div className="flex gap-4 justify-center">
            <button onClick={() => window.location.reload()} className="px-6 py-3 bg-[#6ba6e7] text-white rounded-xl hover:bg-[#5a95d6] transition">
              重试加载
            </button>
            <Link href="/">
              <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition">
                返回首页
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ========== 主渲染 ==========
  return (
    <div className="min-h-screen bg-[#f8fcff] p-4 md:p-6">
      <div className="max-w-6xl mx-auto w-full mb-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center text-gray-600 hover:text-[#6ba6e7] transition">
            ← 返回首页
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-gray-500 text-sm">面试成长记录</span>
            <Link href="/interview">
              <button className="px-4 py-2 bg-[#6ba6e7] text-white rounded-lg hover:bg-[#5a95d6] transition">
                开始新面试
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full">
        {records.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-[#e0f0ff]">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-medium text-gray-700 mb-2">暂无面试记录</h3>
            <p className="text-gray-500 mb-8">快去完成一场模拟面试，开启你的成长之旅吧！</p>
            <Link href="/interview">
              <button className="px-8 py-4 bg-[#6ba6e7] text-white rounded-xl hover:bg-[#5a95d6] transition font-medium">
                开始第一场面试
              </button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: '累计面试', value: `${totalSessions} 场`, icon: '📝' },
                { label: '练习时长', value: `${Math.floor(totalDuration / 60)} 分钟`, icon: '⏱️' },
                { label: '平均得分', value: `${avgScore} 分`, icon: '📊' },
                { label: '覆盖岗位', value: `${uniquePositions} 个`, icon: '🎯' },
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-[#e0f0ff]">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="text-sm text-gray-500 mb-1">{item.label}</div>
                  <div className="text-xl font-bold text-gray-800">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-[#e0f0ff]">
                <h3 className="text-lg font-bold text-gray-800 mb-6">能力成长趋势</h3>
                {growthTrendData.length > 0 ? (
                  <div className="h-48 relative">
                    <div className="absolute left-0 right-0 top-[10%] h-px bg-gray-100"></div>
                    <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-100"></div>
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-200"></div>
                    <div className="absolute top-0 bottom-0 left-0 w-px bg-gray-200"></div>
                    <div className="pointer-events-none absolute left-0 top-[10%] -translate-y-1/2 text-xs text-gray-400">100</div>
                    <div className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs text-gray-400">50</div>
                    <div className="pointer-events-none absolute bottom-0 left-0 translate-y-1/2 text-xs text-gray-400">0</div>
                    
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polyline
                        points={growthTrendData.map((d, i) => {
                          const x = getTrendPointX(i);
                          const y = getTrendPointY(d.score);
                          return `${x},${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke="#6ba6e7"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    {growthTrendData.map((d, i) => (
                      <div
                        key={i}
                        className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6ba6e7]"
                        style={{
                          left: `${getTrendPointX(i)}%`,
                          top: `${getTrendPointY(d.score)}%`,
                        }}
                      />
                    ))}
                    
                    <div className="absolute bottom-[-25px] left-0 right-0 flex justify-between px-8 text-xs text-gray-500">
                      {growthTrendData.map((d, i) => (
                        <span key={i}>{d.date}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-500">
                    记录不足，暂无趋势图
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#e0f0ff]">
                <h3 className="text-lg font-bold text-gray-800 mb-4">筛选记录</h3>
                <div className="space-y-3">
                  <button onClick={() => setFilterPosition('all')} className={`w-full text-left px-4 py-3 rounded-xl transition ${filterPosition === 'all' ? 'bg-[#9cc9ff]/20 text-[#6ba6e7] border border-[#9cc9ff]' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                    全部岗位
                  </button>
                  <button onClick={() => setFilterPosition('java-backend')} className={`w-full text-left px-4 py-3 rounded-xl transition ${filterPosition === 'java-backend' ? 'bg-[#9cc9ff]/20 text-[#6ba6e7] border border-[#9cc9ff]' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                    Java 后端开发
                  </button>
                  <button onClick={() => setFilterPosition('web-frontend')} className={`w-full text-left px-4 py-3 rounded-xl transition ${filterPosition === 'web-frontend' ? 'bg-[#9cc9ff]/20 text-[#6ba6e7] border border-[#9cc9ff]' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                    Web前端开发
                  </button>
                  <button onClick={() => setFilterPosition('python-algorithm')} className={`w-full text-left px-4 py-3 rounded-xl transition ${filterPosition === 'python-algorithm' ? 'bg-[#9cc9ff]/20 text-[#6ba6e7] border border-[#9cc9ff]' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                    Python算法工程师
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#e0f0ff]">
              <h3 className="text-lg font-bold text-gray-800 mb-6">面试档案列表</h3>
              <div className="space-y-4">
                {filteredRecords.map((record) => (
                  <div key={record.id} className="border border-gray-100 rounded-xl p-5 hover:border-[#9cc9ff] hover:bg-[#f8fcff] transition cursor-pointer">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1" onClick={() => setSelectedRecord(record)}>
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-bold text-gray-800">{record.interview_topic}</h4>
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">已完成</span>
                          {record.has_resume && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">已上传简历</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                          <span>📅 {new Date(record.created_at).toLocaleString()}</span>
                          <span>⏱️ {record.duration}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {extractTags(getDisplaySummary(record)).map((tag, i) => (
                            <span key={i} className="px-3 py-1 bg-[#9cc9ff]/10 text-[#6ba6e7] rounded-full text-sm">{tag}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-[#6ba6e7]">{getDisplayScore(record)}</div>
                          <div className="text-xs text-gray-500">总分</div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteRecord(record.id); }} className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition text-sm">
                          删除
                        </button>
                        <div className="text-gray-400 text-xl" onClick={() => setSelectedRecord(record)}>→</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 详情弹窗 */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{selectedRecord.interview_topic} - 面试详情</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(selectedRecord.created_at).toLocaleString()} · {selectedRecord.duration} · 总分 {getDisplayScore(selectedRecord)}
                </p>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="p-6">
              {/* 分维度评分 */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-800 mb-4">分维度评分</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {extractDimensionScores(selectedRecord.ai_feedback, getDisplayScore(selectedRecord)).map((dim, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-[#6ba6e7] mb-1">{dim.score}</div>
                      <div className="text-sm text-gray-600">{dim.name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 评估报告 */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-800 mb-4">评估报告</h3>
                <div className="p-4 bg-[#f8fcff] border border-[#e0f0ff] rounded-xl text-gray-700 whitespace-pre-wrap">
                  {selectedRecordGuidance?.reportSummary || getDisplayFeedback(selectedRecord)}
                </div>
              </div>

              {selectedRecordGuidance && selectedRecordGuidance.suggestions.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">五维提升建议</h3>
                  <div className="space-y-3">
                    {selectedRecordGuidance.suggestions.map((item, index) => (
                      <div
                        key={`${index}-${item}`}
                        className="rounded-xl border border-[#d8e9ff] bg-[#f8fcff] p-4"
                      >
                        <div className="text-sm font-semibold text-[#6ba6e7] mb-1">建议 {index + 1}</div>
                        <div className="text-sm text-gray-700 leading-7">{item}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRecordGuidance && selectedRecordGuidance.practicePlan.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">7 天练习计划</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedRecordGuidance.practicePlan.map((item) => (
                      <div key={item.day} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <span className="inline-flex rounded-full bg-[#9cc9ff]/20 px-3 py-1 text-sm font-semibold text-[#6ba6e7]">
                            {item.day}
                          </span>
                          <span className="text-sm text-gray-500">{item.focus}</span>
                        </div>
                        <div className="text-sm font-medium text-gray-800 leading-6 mb-2">{item.task}</div>
                        <div className="text-xs text-gray-600 leading-5 mb-2">复盘要求：{item.review}</div>
                        <div className="text-xs text-gray-500 leading-5">完成标准：{item.goal}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 对话记录 */}
              {selectedRecord.conversation && (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4">完整对话记录</h3>
                  <div className="space-y-4">
                    {Array.isArray(selectedRecord.conversation) ? (
                      selectedRecord.conversation.map((msg: InterviewMessage, i: number) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className="max-w-[80%]">
                            <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-[#6ba6e7] text-white' : 'bg-gray-100 text-gray-800'}`}>
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 text-center py-4">对话记录格式不支持预览</div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-center gap-4">
                <Link href="/interview" className="px-6 py-3 bg-[#6ba6e7] text-white rounded-lg hover:bg-[#5a95d6] transition">
                  再练一次
                </Link>
                <button onClick={() => setSelectedRecord(null)} className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
