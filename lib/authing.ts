import { AuthenticationClient, type User } from "authing-js-sdk";
import { getAuthingEnv } from "./env";

const AUTH_TOKEN_STORAGE_KEY = "authing_token";
const AUTH_USER_ID_STORAGE_KEY = "authing_user_id";
const AUTH_REDIRECT_STORAGE_KEY = "authing_redirect_after_login";
export const AUTHING_AUTH_STATE_CHANGE_EVENT = "authing-auth-state-change";

export type AuthingAccountProfile = Pick<User, "id" | "username" | "nickname" | "email" | "phone">;

let authingClient: AuthenticationClient | null = null;

type AuthingClientOptions = {
  redirectUri?: string;
  tokenEndPointAuthMethod?: "client_secret_post" | "client_secret_basic" | "none";
  secret?: string;
};

const notifyAuthStateChanged = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTHING_AUTH_STATE_CHANGE_EVENT));
};

const createAuthingClient = (overrides?: AuthingClientOptions) => {
  const { appId, appHost, appSecret } = getAuthingEnv();
  if (!appId || !appHost) {
    return null;
  }

  const secret = overrides?.secret ?? appSecret;

  return new AuthenticationClient({
    appId,
    appHost,
    protocol: "oidc",
    timeout: 10000,
    ...(secret ? { secret } : {}),
    ...(overrides || {}),
  });
};

const syncClientToken = (client: AuthenticationClient | null) => {
  if (typeof window === "undefined" || !client) {
    return client;
  }

  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (token) {
    client.setToken(token);
  }

  return client;
};

const persistAuthState = (user: { token: string; id?: string | null }) => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, user.token);
  sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, user.token);

  if (user.id) {
    localStorage.setItem(AUTH_USER_ID_STORAGE_KEY, user.id);
  } else {
    localStorage.removeItem(AUTH_USER_ID_STORAGE_KEY);
  }

  document.cookie = `authing_token=${user.token}; path=/; max-age=86400; SameSite=Lax`;
  authingClient?.setToken(user.token);
  notifyAuthStateChanged();
};

const toAccountProfile = (user: User): AuthingAccountProfile => ({
  id: user.id,
  username: user.username || "",
  nickname: user.nickname || "",
  email: user.email || "",
  phone: user.phone || "",
});

const getErrorText = (error: unknown) => {
  const e = error as {
    message?: string;
    response?: { status?: number; data?: Record<string, unknown> };
  };

  const status = e.response?.status;
  const data = e.response?.data;
  const detail =
    (typeof data?.error_description === "string" && data.error_description) ||
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.error === "string" && data.error) ||
    e.message ||
    "unknown_error";

  return {
    status,
    detail,
    data,
  };
};

const formatExchangeError = (error: unknown, redirectUri: string) => {
  const { detail, status, data } = getErrorText(error);
  const detailLower = detail.toLowerCase();

  if (detailLower.includes("redirect_uri_mismatch")) {
    return `Authing 登录回调地址不匹配。当前请求回调地址：${redirectUri}。请把这个地址加入 Authing 控制台登录回调 URL 白名单。`;
  }

  if (detailLower.includes("invalid_client")) {
    return "Authing 应用客户端校验失败。请确认 App Secret 配置正确，或将应用类型调整为允许 public client 交换 code。";
  }

  if (detailLower.includes("invalid_grant")) {
    return "授权码已失效或已被使用，请重新点击登录再试。";
  }

  if (status) {
    const extra = data ? `，返回：${JSON.stringify(data)}` : "";
    return `请求失败（HTTP ${status}）${extra}`;
  }

  return detail;
};

export const getStoredAuthToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
};

export const getStoredAuthUserId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(AUTH_USER_ID_STORAGE_KEY);
};

export const getAuthingClient = () => {
  if (typeof window === "undefined") {
    return null;
  }

  if (!authingClient) {
    authingClient = createAuthingClient();
  }

  return syncClientToken(authingClient);
};

export const clearAuthState = () => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_ID_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);

  document.cookie = "authing_token=; path=/; max-age=0";
  document.cookie = `authing_token=; path=/; max-age=0; domain=${window.location.hostname}`;

  authingClient = null;
  notifyAuthStateChanged();
};

export const setPendingRedirect = (redirect: string) => {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, redirect);
};

export const consumePendingRedirect = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const redirect = sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
  return redirect;
};

export const exchangeAuthingCode = async (code: string, redirectUri: string) => {
  const { appSecret } = getAuthingEnv();
  const tokenMethod = appSecret ? "client_secret_post" : "none";

  const client = createAuthingClient({
    redirectUri,
    tokenEndPointAuthMethod: tokenMethod,
    ...(appSecret ? { secret: appSecret } : {}),
  });

  if (!client) {
    throw new Error("Authing 客户端初始化失败。");
  }

  try {
    const tokenSet = (await client.getAccessTokenByCode(code)) as {
      access_token?: string;
    };
    const accessToken = tokenSet.access_token;

    if (!accessToken) {
      throw new Error("没有从 Authing 获取到有效访问令牌。");
    }

    client.setToken(accessToken);
    const currentUser = await client.getCurrentUser();
    persistAuthState({ token: accessToken, id: currentUser?.id || null });
    authingClient = client;

    return currentUser ? toAccountProfile(currentUser) : null;
  } catch (error: unknown) {
    throw new Error(formatExchangeError(error, redirectUri));
  }
};

export const setAuthCookie = (token: string) => {
  persistAuthState({ token });
};

export const isAuthenticated = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const hasLocalToken = Boolean(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
  const hasCookieToken = document.cookie
    .split("; ")
    .some((row) => row.startsWith("authing_token="));

  return hasLocalToken || hasCookieToken;
};

export const getCurrentAuthingUser = async (): Promise<AuthingAccountProfile | null> => {
  const client = getAuthingClient();
  if (!client) {
    return null;
  }

  const user = await client.getCurrentUser();
  if (!user) {
    return null;
  }

  if (user.token) {
    persistAuthState({ token: user.token, id: user.id || null });
  }

  return toAccountProfile(user);
};

export const updateCurrentUsername = async (username: string) => {
  const client = getAuthingClient();
  if (!client) {
    throw new Error("Authing 客户端初始化失败。");
  }

  const nextUsername = username.trim();
  if (!nextUsername) {
    throw new Error("用户名不能为空。");
  }

  const user = await client.updateProfile({ username: nextUsername });
  if (user.token) {
    persistAuthState({ token: user.token, id: user.id || null });
  }

  return toAccountProfile(user);
};

export const updateCurrentPassword = async (newPassword: string, oldPassword?: string) => {
  const client = getAuthingClient();
  if (!client) {
    throw new Error("Authing 客户端初始化失败。");
  }

  const nextPassword = newPassword.trim();
  const previousPassword = oldPassword?.trim();

  if (!nextPassword) {
    throw new Error("新密码不能为空。");
  }

  const user = await client.updatePassword(nextPassword, previousPassword || undefined);
  if (user.token) {
    persistAuthState({ token: user.token, id: user.id || null });
  }
};

export const logout = async () => {
  if (typeof window === "undefined") {
    return;
  }

  const client = getAuthingClient();

  try {
    await client?.logout();
  } catch (error) {
    console.warn("Authing logout failed", error);
  }

  clearAuthState();
};
