# Mock Interview

一个基于 Next.js 的模拟面试项目，包含 Authing 登录、题库检索、语音识别和 AI 面试问答。

## 启动前必做

这个项目依赖本地环境变量。`.env.local` 默认不会提交到 Git，所以从别人电脑拷贝代码或重新拉仓库后，需要先自己创建一份。

在 PowerShell 里执行：

```powershell
Copy-Item .env.example .env.local
```

然后填写 `.env.local` 里的配置。

## 必要环境变量

```env
NEXT_PUBLIC_AUTHING_APP_ID=
NEXT_PUBLIC_AUTHING_APP_HOST=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DEEPSEEK_API_KEY=
DASHSCOPE_API_KEY=
```

其中登录至少需要这两个：

```env
NEXT_PUBLIC_AUTHING_APP_ID=
NEXT_PUBLIC_AUTHING_APP_HOST=
```

如果这两个没配，访问登录页会直接提示 `Authing 配置缺失`，也就会出现“点登录没反应 / 进不去”的情况。

## Authing 配置提醒

- Authing 控制台里的回调地址需要和项目代码保持一致：`http://localhost:3000`
- 如果你换了端口，记得同时修改 Authing 控制台和项目里的登录回调地址

## 本地运行

先安装依赖：

```bash
npm install
```

再启动开发环境：

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 常见问题

### 为什么别人电脑上能登录，我拷贝下来不行？

因为别人本地通常已经有自己的 `.env.local`，而这个文件被 `.gitignore` 忽略，不会跟着代码一起传过来。你需要按上面的步骤自己补一份。
