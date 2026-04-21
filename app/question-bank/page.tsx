"use client";
import { useState } from 'react';
import Link from 'next/link';
import interviewData from '../data/interviewData.json';

// 提取所有岗位信息
const positions = Object.entries(interviewData).map(([slug, data]) => ({
  slug,
  displayName: data.displayName,
}));

// 提取所有分类（去重）
const allCategories = Array.from(
  new Set(Object.values(interviewData).flatMap(data => 
    data.questions.map(q => q.category)
  ))
);

// 提取所有难度/频率
const difficulties = ["easy", "medium", "hard"];
const frequencies = ["高频", "中频", "低频"];

export default function QuestionBankPage() {
  // 筛选状态
  const [selectedPosition, setSelectedPosition] = useState(positions[0].slug);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedDifficulty, setSelectedDifficulty] = useState("全部");
  const [selectedFrequency, setSelectedFrequency] = useState("全部");
  // 展开的问题ID（用于展示示例回答）
  const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(null);
  // 搜索关键词状态
  const [searchKeyword, setSearchKeyword] = useState("");
  const normalizedKeyword = searchKeyword.trim().toLowerCase();

  // 筛选逻辑
  const filteredQuestions = interviewData[selectedPosition].questions.filter(q => {
    const categoryMatch = selectedCategory === "全部" || q.category === selectedCategory;
    const difficultyMatch = selectedDifficulty === "全部" || q.difficulty === selectedDifficulty;
    const frequencyMatch = selectedFrequency === "全部" || q.frequency === selectedFrequency;
    const keywordMatch = normalizedKeyword === "" ||
      q.question.toLowerCase().includes(normalizedKeyword) ||
      q.tags?.some(tag => tag.toLowerCase().includes(normalizedKeyword)) ||
      q.keyPoints?.some(point => point.toLowerCase().includes(normalizedKeyword));
    return categoryMatch && difficultyMatch && frequencyMatch && keywordMatch;
  });

  // 切换展开/收起
  const toggleQuestion = (id: number) => {
    setExpandedQuestionId(expandedQuestionId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-cyan-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-gray-600 hover:text-indigo-600 transition">
            ← 返回首页
          </Link>
        </div>
        {/* 标题 */}
        <h1 className="text-4xl font-bold text-center mb-10 text-indigo-800">
          AI模拟面试 · 真题库
        </h1>

        {/* 筛选栏 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-indigo-100">
          {/* 搜索框 */}
          <div className="mb-6">
            <input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="输入关键词搜索（如JVM、React、快速排序）"
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400 text-black"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* 岗位筛选 */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">选择岗位</label>
              <select
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black"
              >
                {positions.map((pos) => (
                  <option key={pos.slug} value={pos.slug} className="text-black">
                    {pos.displayName}
                  </option>
                ))}
              </select>
            </div>

            {/* 分类筛选 */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">问题分类</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black"
              >
                <option value="全部" className="text-black">全部</option>
                {allCategories.map((cate) => (
                  <option key={cate} value={cate} className="text-black">{cate}</option>
                ))}
              </select>
            </div>

            {/* 难度筛选 */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">难度</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black"
              >
                <option value="全部" className="text-black">全部</option>
                {difficulties.map((diff) => (
                  <option key={diff} value={diff} className="text-black">
                    {diff === "easy" ? "简单" : diff === "medium" ? "中等" : "困难"}
                  </option>
                ))}
              </select>
            </div>

            {/* 频率筛选 */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">出现频率</label>
              <select
                value={selectedFrequency}
                onChange={(e) => setSelectedFrequency(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black"
              >
                <option value="全部" className="text-black">全部</option>
                {frequencies.map((freq) => (
                  <option key={freq} value={freq} className="text-black">{freq}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 题库列表 */}
        <div className="grid grid-cols-1 gap-6">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              暂无匹配的题库内容
            </div>
          ) : (
            filteredQuestions.map((q, idx) => (
              <div 
                key={idx} 
                className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden hover:shadow-md transition"
              >
                {/* 问题头部（可点击展开） */}
                <div 
                  className="p-6 cursor-pointer flex justify-between items-center"
                  onClick={() => toggleQuestion(idx)}
                >
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{q.question}</h3>
                    <div className="flex gap-3 mt-2 text-sm">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full">{q.category}</span>
                      <span className="px-2 py-1 bg-gray-50 text-gray-700 rounded-full">
                        {q.difficulty === "easy" ? "简单" : q.difficulty === "medium" ? "中等" : "困难"}
                      </span>
                      <span className="px-2 py-1 bg-cyan-50 text-cyan-700 rounded-full">{q.frequency}</span>
                      {q.tags?.map((tag) => (
                        <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <span className="text-indigo-500 text-xl">
                    {expandedQuestionId === idx ? "▼" : "▶"}
                  </span>
                </div>

                {/* 展开后：要点 + 示例回答 */}
                {expandedQuestionId === idx && (
                  <div className="px-6 pb-6 border-t border-gray-100">
                    {/* 核心要点 */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">核心要点：</h4>
                      <div className="flex flex-wrap gap-2">
                        {q.keyPoints?.map((point, pIdx) => (
                          <span key={pIdx} className="px-2 py-1 bg-gray-50 text-gray-600 rounded">{point}</span>
                        ))}
                      </div>
                    </div>

                    {/* 示例回答 */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">示例回答：</h4>
                      {q.exampleAnswers?.map((ans, aIdx) => (
                        <div key={aIdx} className="mb-4 bg-gray-50 rounded-xl p-4">
                          <div className="text-xs text-gray-500 mb-2">{ans.type}</div>
                          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                            {ans.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
  
