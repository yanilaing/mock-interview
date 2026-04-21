"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  clearAuthState,
  getCurrentAuthingUser,
  getStoredAuthToken,
  type AuthingAccountProfile,
  updateCurrentPassword,
  updateCurrentUsername,
} from "../../lib/authing";

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const createDefaultPasswordForm = (): PasswordForm => ({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const ACCOUNT_REDIRECT = `/sign-in?redirect=${encodeURIComponent("/account")}`;

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AuthingAccountProfile | null>(null);
  const [username, setUsername] = useState("");
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(createDefaultPasswordForm);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let active = true;

    const redirectToSignIn = () => {
      router.replace(ACCOUNT_REDIRECT);
    };

    const loadCurrentUser = async () => {
      const token = getStoredAuthToken();
      if (!token) {
        clearAuthState();
        redirectToSignIn();
        return;
      }

      try {
        const currentUser = await getCurrentAuthingUser();
        if (!currentUser) {
          clearAuthState();
          redirectToSignIn();
          return;
        }

        if (!active) {
          return;
        }

        setProfile(currentUser);
        setUsername(currentUser.username || "");
        setLoading(false);
      } catch (error) {
        console.error("Failed to load account profile:", error);
        clearAuthState();
        redirectToSignIn();
      }
    };

    void loadCurrentUser();

    return () => {
      active = false;
    };
  }, [router]);

  const handleUsernameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileMessage("");
    setProfileError("");

    const nextUsername = username.trim();
    if (nextUsername.length < 2) {
      setProfileError("用户名至少需要 2 个字符。");
      return;
    }

    setSavingUsername(true);
    try {
      const updatedProfile = await updateCurrentUsername(nextUsername);
      setProfile(updatedProfile);
      setUsername(updatedProfile.username || nextUsername);
      setProfileMessage("用户名已更新。");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "用户名更新失败，请稍后重试。");
    } finally {
      setSavingUsername(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (newPassword.length < 8) {
      setPasswordError("新密码至少需要 8 位。");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("两次输入的新密码不一致。");
      return;
    }

    setSavingPassword(true);
    try {
      await updateCurrentPassword(newPassword, currentPassword);
      setPasswordForm(createDefaultPasswordForm());
      setPasswordMessage("密码已更新。");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "密码更新失败，请稍后重试。");
    } finally {
      setSavingPassword(false);
    }
  };

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
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
          <p className="text-gray-700">正在加载账号信息...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-cyan-100 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/" className="inline-flex items-center text-gray-600 hover:text-indigo-600 transition">
            ← 返回首页
          </Link>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-500">Account Center</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">账号设置</h1>
            <p className="mt-2 text-slate-600">你可以在这里修改用户名和密码。</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/growth"
              className="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-indigo-700 transition hover:bg-indigo-50"
            >
              查看记录
            </Link>
            <Link
              href="/"
              className="hidden"
            >
              返回首页
            </Link>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">当前账号</h2>
            <div className="mt-6 space-y-4 text-sm">
              <InfoRow label="用户 ID" value={profile?.id || "未获取"} />
              <InfoRow label="用户名" value={profile?.username || "未设置"} />
              <InfoRow label="昵称" value={profile?.nickname || "未设置"} />
              <InfoRow label="邮箱" value={profile?.email || "未绑定"} />
              <InfoRow label="手机号" value={profile?.phone || "未绑定"} />
            </div>
            {profileError && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {profileError}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <form
              onSubmit={handleUsernameSubmit}
              className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold text-slate-900">修改用户名</h2>
              <p className="mt-2 text-sm text-slate-500">保存后会同步到当前 Authing 账号。</p>

              <label className="mt-6 block">
                <span className="text-sm font-medium text-slate-700">新用户名</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="请输入新的用户名"
                />
              </label>

              {profileMessage && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {profileMessage}
                </div>
              )}

              {profileError && profile && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {profileError}
                </div>
              )}

              <button
                type="submit"
                disabled={savingUsername}
                className="mt-6 w-full rounded-2xl bg-indigo-600 px-4 py-3 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {savingUsername ? "保存中..." : "保存用户名"}
              </button>
            </form>

            <form
              onSubmit={handlePasswordSubmit}
              className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold text-slate-900">修改密码</h2>
              <p className="mt-2 text-sm text-slate-500">
                如果账号之前设置过密码，请先填写当前密码；首次设置时可以留空。
              </p>

              <div className="mt-6 space-y-4">
                <Field
                  label="当前密码"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(value) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      currentPassword: value,
                    }))
                  }
                  placeholder="如已设置旧密码，请先输入"
                />
                <Field
                  label="新密码"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(value) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      newPassword: value,
                    }))
                  }
                  placeholder="至少 8 位"
                />
                <Field
                  label="确认新密码"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(value) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      confirmPassword: value,
                    }))
                  }
                  placeholder="再次输入新密码"
                />
              </div>

              {passwordMessage && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {passwordMessage}
                </div>
              )}

              {passwordError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {passwordError}
                </div>
              )}

              <button
                type="submit"
                disabled={savingPassword}
                className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {savingPassword ? "更新中..." : "更新密码"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className="break-all text-right text-slate-900">{value}</span>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder={placeholder}
      />
    </label>
  );
}
