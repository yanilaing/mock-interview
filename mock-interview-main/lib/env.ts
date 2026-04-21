export type PublicEnvKey =
  | "NEXT_PUBLIC_AUTHING_APP_ID"
  | "NEXT_PUBLIC_AUTHING_APP_HOST"
  | "NEXT_PUBLIC_AUTHING_APP_SECRET"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

const readPublicEnv = (): Record<PublicEnvKey, string> => ({
  NEXT_PUBLIC_AUTHING_APP_ID: process.env.NEXT_PUBLIC_AUTHING_APP_ID?.trim() || "",
  NEXT_PUBLIC_AUTHING_APP_HOST: process.env.NEXT_PUBLIC_AUTHING_APP_HOST?.trim() || "",
  NEXT_PUBLIC_AUTHING_APP_SECRET: process.env.NEXT_PUBLIC_AUTHING_APP_SECRET?.trim() || "",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "",
});

export const getPublicEnvValue = (key: PublicEnvKey) => readPublicEnv()[key];

export const getMissingPublicEnvKeys = (keys: PublicEnvKey[]) =>
  keys.filter((key) => !getPublicEnvValue(key));

export const getAuthingEnv = () => ({
  appId: getPublicEnvValue("NEXT_PUBLIC_AUTHING_APP_ID"),
  appHost: getPublicEnvValue("NEXT_PUBLIC_AUTHING_APP_HOST"),
  appSecret: getPublicEnvValue("NEXT_PUBLIC_AUTHING_APP_SECRET"),
});

export const getAuthingEnvError = () => {
  const missing = getMissingPublicEnvKeys([
    "NEXT_PUBLIC_AUTHING_APP_ID",
    "NEXT_PUBLIC_AUTHING_APP_HOST",
  ]);

  if (missing.length === 0) {
    return "";
  }

  return `Authing 配置缺失：${missing.join(", ")}。请检查 .env.local，并确认回调地址包含 http://localhost:3000。`;
};

export const getSupabaseEnvError = () => {
  const missing = getMissingPublicEnvKeys([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]);

  if (missing.length === 0) {
    return "";
  }

  return `Supabase 配置缺失：${missing.join(", ")}。请检查 .env.local；如果刚修改过环境变量，请重启开发服务器。`;
};
