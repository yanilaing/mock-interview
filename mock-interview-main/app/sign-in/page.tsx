"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearAuthState,
  consumePendingRedirect,
  exchangeAuthingCode,
  getCurrentAuthingUser,
  getStoredAuthToken,
  setPendingRedirect,
} from "../../lib/authing";
import { getAuthingEnv, getAuthingEnvError } from "../../lib/env";

const DEFAULT_REDIRECT = "/";

const getSafeRedirectTarget = (value: string | null) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
};

const getRequestedRedirect = (params: URLSearchParams) =>
  getSafeRedirectTarget(params.get("redirect")) ?? getSafeRedirectTarget(params.get("state"));

const getAuthCallbackUri = (params: URLSearchParams) => {
  const authCallback = params.get("auth_callback");

  if (!authCallback || authCallback === "root") {
    return window.location.origin;
  }

  const safePath = getSafeRedirectTarget(authCallback);
  if (!safePath) {
    return window.location.origin;
  }

  return new URL(safePath, window.location.origin).toString();
};

export default function SignInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const redirectToAuthing = (redirectTarget: string) => {
      const { appId, appHost } = getAuthingEnv();
      if (!appId || !appHost) {
        throw new Error(getAuthingEnvError() || "Authing client failed to initialize");
      }

      const callbackUri = window.location.origin;
      setPendingRedirect(redirectTarget);

      const authUrl = new URL("/oidc/auth", appHost);
      authUrl.searchParams.set("client_id", appId);
      authUrl.searchParams.set("redirect_uri", callbackUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid profile email");
      authUrl.searchParams.set("state", redirectTarget);

      window.location.replace(authUrl.toString());
    };

    const startLogin = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const requestedRedirect = getRequestedRedirect(params);

        if (code) {
          const redirectTarget =
            requestedRedirect ?? getSafeRedirectTarget(consumePendingRedirect()) ?? DEFAULT_REDIRECT;
          const callbackUri = getAuthCallbackUri(params);

          await exchangeAuthingCode(code, callbackUri);
          window.history.replaceState({}, document.title, window.location.pathname);
          router.replace(redirectTarget);
          return;
        }

        const existingToken = getStoredAuthToken();
        if (existingToken) {
          const currentUser = await getCurrentAuthingUser();
          if (currentUser) {
            const redirectTarget =
              requestedRedirect ?? getSafeRedirectTarget(consumePendingRedirect()) ?? DEFAULT_REDIRECT;

            router.replace(redirectTarget);
            return;
          }

          clearAuthState();
        }

        redirectToAuthing(requestedRedirect ?? DEFAULT_REDIRECT);
      } catch (err: unknown) {
        clearAuthState();
        if (!active) {
          return;
        }

        console.error("Login flow failed:", err);
        setError(err instanceof Error ? err.message : "登录失败，请稍后重试。");
        setLoading(false);
      }
    };

    void startLogin();

    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-cyan-50">
        <Link
          href="/"
          className="absolute left-6 top-6 inline-flex items-center text-gray-600 hover:text-indigo-600 transition"
        >
          ← 返回首页
        </Link>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-700 text-lg">正在处理登录...</p>
          <p className="text-gray-500 text-sm mt-2">
            如果长时间没有响应，请检查 Authing 控制台里的回调地址是否为{" "}
            <span className="font-medium">http://localhost:3000</span>
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-cyan-50 p-8">
        <Link
          href="/"
          className="absolute left-6 top-6 inline-flex items-center text-gray-600 hover:text-indigo-600 transition"
        >
          ← 返回首页
        </Link>
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-indigo-800 mb-4">登录失败</h1>
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-xl">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="w-full p-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-medium"
          >
            重试登录
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full p-4 mt-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return null;
}
