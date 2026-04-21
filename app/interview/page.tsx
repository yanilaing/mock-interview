"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InterviewHomePage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingLogin, setIsCheckingLogin] = useState(true);
  const positionCards = [
    {
      href: '/interview/java-backend',
      title: 'Java 后端开发',
      description: 'Spring Boot、微服务、数据库等',
    },
    {
      href: '/interview/web-frontend',
      title: 'Web 前端开发',
      description: 'React、TypeScript、性能优化等',
    },
    {
      href: '/interview/python-algorithm',
      title: 'Python 算法工程师',
      description: '数据结构、算法、LeetCode 等',
    },
  ];

  // ========== 核心合并：登录检查逻辑 ==========
  useEffect(() => {
    const authToken = localStorage.getItem('authing_token');
    setIsCheckingLogin(false);
    
    if (!authToken) {
      alert('请先登录后选择面试岗位！');
      router.push(`/sign-in?redirect=${encodeURIComponent(window.location.pathname)}`);
      setIsLoggedIn(false);
    } else {
      setIsLoggedIn(true);
    }
  }, [router]);

  // ========== 加载中状态 ==========
  if (isCheckingLogin) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-cyan-50">
        <Link
          href="/"
          className="absolute left-6 top-6 inline-flex items-center text-gray-600 hover:text-indigo-600 transition"
        >
          ← 返回首页
        </Link>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // ========== 未登录不渲染内容 ==========
  if (!isLoggedIn) return null;

  // ========== 已登录：完整保留第一段的精美UI ==========
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-indigo-50 to-cyan-50 flex items-center justify-center p-8">
      <Link
        href="/"
        className="absolute left-8 top-8 inline-flex items-center text-gray-600 hover:text-indigo-600 transition"
      >
        ← 返回首页
      </Link>
      <div className="text-center max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold text-indigo-800 mb-12">
          AI 模拟面试
        </h1>
        <p className="text-xl text-gray-700 mb-10">
          请选择你要练习的岗位
        </p>

        <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {positionCards.map((card) => (
            <Link key={card.href} href={card.href} className="block h-full">
              <div className="flex h-full min-h-[220px] cursor-pointer flex-col justify-center rounded-2xl border border-indigo-100 bg-white p-8 text-center shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
                <div className="flex min-h-[72px] items-center justify-center">
                  <h2 className="text-2xl font-semibold leading-tight text-indigo-700">{card.title}</h2>
                </div>
                <div className="mt-4 flex min-h-[72px] items-start justify-center">
                  <p className="max-w-[14ch] text-gray-600 leading-relaxed">{card.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
