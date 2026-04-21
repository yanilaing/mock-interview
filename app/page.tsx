'use client';

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import {
  AUTHING_AUTH_STATE_CHANGE_EVENT,
  isAuthenticated,
  logout as authingLogout,
} from "../lib/authing";

const steps = [
  {
    step: "1",
    icon: "🎤",
    text: "语音/文字开始对话",
  },
  {
    step: "2",
    icon: "💬",
    text: "AI 实时提问互动",
  },
  {
    step: "3",
    icon: "✨",
    text: "生成面试反馈建议",
  },
];

const features = [
  {
    icon: "🧩",
    title: "MBTI 职业测试",
    description: "通过性格测试了解更适合你的职业方向和岗位风格。",
    href: "/mbti-test",
  },
  {
    icon: "📚",
    title: "真题召回 + 知识库",
    description: "RAG 智能检索，快速找到相似面试题与核心知识点。",
    href: "/question-bank",
  },
  {
    icon: "📊",
    title: "成长记录",
    description: "沉淀每次练习结果，持续观察自己的进步曲线。",
    href: "/growth",
  },
];

export default function Home() {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const loggedIn = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") {
        return () => undefined;
      }

      window.addEventListener(AUTHING_AUTH_STATE_CHANGE_EVENT, onStoreChange);
      window.addEventListener("storage", onStoreChange);

      return () => {
        window.removeEventListener(AUTHING_AUTH_STATE_CHANGE_EVENT, onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    () => (hydrated ? isAuthenticated() : false),
    () => false,
  );

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (code) {
      const signInUrl = new URL("/sign-in", window.location.origin);
      signInUrl.search = window.location.search;
      signInUrl.searchParams.set("auth_callback", "root");
      window.location.replace(signInUrl.toString());
      return;
    }
  }, []);

  // 🔥 新增：用 useEffect 注入动画样式（替代 style jsx）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes float {
        0% { transform: translateY(0px) rotate(12deg); }
        50% { transform: translateY(-10px) rotate(12deg); }
        100% { transform: translateY(0px) rotate(12deg); }
      }
      @keyframes float-reverse {
        0% { transform: translateY(0px) rotate(45deg); }
        50% { transform: translateY(10px) rotate(45deg); }
        100% { transform: translateY(0px) rotate(45deg); }
      }
    `;
    document.head.appendChild(style);
    return () => {document.head.removeChild(style)};
  }, []);

  const withRedirect = (path: string) =>
    loggedIn ? path : `/sign-in?redirect=${encodeURIComponent(path)}`;

  const handleLogout = async () => {
    await authingLogout();
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f8fcff]">
      {/* 背景装饰 - 纯 Tailwind */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 right-0 h-[700px] w-[700px] rounded-full bg-[#c7e2ff]/40 blur-[160px] opacity-70" />
        <div className="absolute bottom-0 left-0 h-[600px] w-[600px] rounded-full bg-[#d6e9ff]/40 blur-[120px] opacity-70" />
      </div>

      {/* 浮动小球 - 纯 Tailwind */}
      <div
        className="absolute top-20 left-10 h-28 w-28 rounded-full border-2 border-[#c7e2ff]/50 opacity-60 animate-pulse"
        style={{ animationDuration: "3s" }}
      />
      <div
        className="absolute bottom-32 right-20 h-24 w-24 rounded-2xl bg-[#c7e2ff]/20 rotate-12"
        style={{ animation: "float 6s infinite ease-in-out" }}
      />
      <div
        className="absolute top-40 right-32 h-16 w-16 rounded-lg border-2 border-[#c7e2ff]/40 rotate-45"
        style={{ animation: "float-reverse 7s infinite ease-in-out" }}
      />

      {/* 导航栏 - 纯 Tailwind */}
      <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="text-lg font-semibold text-slate-800">Mock Interview</div>
        <div className="flex items-center gap-6 text-sm text-gray-500">
          {loggedIn ? (
            <button
              onClick={handleLogout}
              className="rounded-full border border-[#c7e2ff] bg-white px-4 py-2 shadow-sm transition-all hover:border-[#9cc9ff] hover:text-[#6ba6e7]"
            >
              退出登录
            </button>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-full border border-[#c7e2ff] bg-white px-4 py-2 shadow-sm transition-all hover:border-[#9cc9ff] hover:text-[#6ba6e7]"
            >
              登录
            </Link>
          )}

          <Link href={withRedirect("/question-bank")} className="hover:text-[#6ba6e7]">
            真题库
          </Link>
          <Link href={withRedirect("/growth")} className="hover:text-[#6ba6e7]">
            成长记录
          </Link>
          {loggedIn && (
            <Link href="/account" className="hover:text-[#6ba6e7]">
              账号设置
            </Link>
          )}
        </div>
      </nav>

      {/* 核心内容区 - 纯 Tailwind */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 pt-12 pb-20">
        <div className="w-full max-w-5xl text-center">
          {/* 标题 */}
          <div className="mb-14">
            <p className="text-sm uppercase tracking-[0.4em] text-[#6ba6e7]">AI Interview Practice</p>
            <h1 className="mt-4 text-4xl font-bold md:text-6xl">
              <span className="bg-gradient-to-r from-[#6ba6e7] to-[#9cc9ff] bg-clip-text text-transparent">
                AI 模拟面试助手
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              支持语音和文字模拟面试，帮助你更高频率地练习表达、结构和临场反应。
            </p>
          </div>

          {/* 步骤说明 */}
          <div className="mb-16 flex flex-col items-center justify-center gap-4 md:flex-row md:gap-6">
            {steps.map((item, idx) => (
              <div key={item.step} className="flex items-center gap-3">
                <div className="h-[120px] w-[180px] rounded-2xl border border-[#c7e2ff] bg-white px-5 py-4 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                  <div className="text-3xl">{item.icon}</div>
                  <div className="mt-2 text-xs font-medium text-[#6ba6e7]">
                    STEP {item.step}
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{item.text}</p>
                </div>
                {idx < steps.length - 1 && <span className="hidden text-3xl text-slate-400 md:inline">→</span>}
              </div>
            ))}
          </div>

          {/* 功能卡片 */}
          <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {features.map((item) => (
              <Link key={item.href} href={withRedirect(item.href)} className="block">
                <div className="flex h-full flex-col rounded-3xl border border-[#e0f0ff] bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                  <div className="text-4xl">{item.icon}</div>
                  <h3 className="text-lg font-bold text-gray-800">{item.title}</h3>
                  <p className="mt-3 flex-grow text-sm leading-7 text-gray-500">{item.description}</p>
                  {!loggedIn && (
                    <p className="mt-4 text-sm font-medium text-[#6ba6e7]">登录后可访问</p>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* 开始面试按钮（已删除白色底框） */}
          <Link
            href={withRedirect("/interview")}
            className="inline-flex rounded-full bg-[#9cc9ff] px-10 py-4 font-medium text-white shadow-md transition-all hover:bg-[#6ba6e7] hover:shadow-lg"
          >
            {loggedIn ? "开始模拟面试" : "登录后开始面试"}
          </Link>
        </div>
      </div>
    </main>
  );
}