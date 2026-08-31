/**
 * Dashboard dictionaries (en / zh). `en` is the source of truth — TypeScript
 * enforces that `zh` mirrors every key (Record<TKey, string>).
 * Values may contain {param} placeholders filled by I18nProvider.t().
 */
export type Locale = "en" | "zh";

export const en = {
  // Nav
  "nav.subscriptions": "Subscriptions",
  "nav.events": "Events",
  "nav.admin": "Admin",

  // Subscriptions page
  "subs.title": "Subscriptions",
  "subs.lead":
    "Each subscription creates a webhook endpoint for a platform source and queues its events for your agent.",
  "subs.new": "New",
  "subs.empty.title": "No subscriptions yet",
  "subs.empty.desc":
    "Create your first subscription to start receiving webhook events from GitHub, Stripe, Linear and more.",
  "subs.empty.cta": "Create subscription",

  // New subscription dialog
  "dialog.title": "New subscription",
  "dialog.desc":
    "Pick the platform you want to receive events from, then give this subscription a name.",
  "dialog.platform": "Platform",
  "dialog.platform.placeholder": "Select a platform",
  "dialog.source.custom": "Custom webhook",
  "dialog.label": "Subscription name",
  "dialog.label.placeholder": "e.g. My {name} project",
  "dialog.label.hint": "A friendly name to help you identify this subscription.",
  "dialog.submit": "Create subscription",
  "dialog.submitting": "Creating...",
  "dialog.error.nameRequired": "Subscription name is required",
  "dialog.error.createFailed": "Failed to create subscription",

  // Subscription card
  "card.disabled": "Disabled",
  "card.created": "Created {date}",
  "card.tab.webhook": "Webhook config",
  "card.tab.agent": "Connect your Agent",
  "card.agent.infoPrefix": "Send the instructions below to",
  "card.agent.infoSuffix":
    "— the guide installs the adapter, and the credentials connect it to this subscription.",
  "card.agent.prompt": [
    "Install the EventPort adapter by following {guideUrl}",
    "and connect it to my subscription.",
    "The guide's src/index.js has EG_URL / EG_TOKEN placeholders in double braces —",
    "replace them with these actual values:",
    "EG_URL={gatewayUrl}",
    "EG_TOKEN={consumerKey}",
  ].join("\n"),
  "card.agent.tokenUnavailable": "Consumer token unavailable.",
  "card.instructions.title": "Event instructions",
  "card.instructions.hint":
    "Rendered for every event and sent to your agent as text. Use {{a.b.c}} placeholders to extract fields from the payload; leave empty to send the raw payload only.",
  "card.instructions.placeholder":
    "e.g. Review this GitHub PR: repo {{repository.full_name}}, branch {{pull_request.head.ref}}",
  "card.instructions.save": "Save",
  "card.instructions.saving": "Saving...",
  "card.instructions.saved": "Instructions saved",
  "card.test": "Send test event",
  "card.testing": "Sending...",
  "card.delete": "Delete",
  "card.delete.title": "Delete “{label}”?",
  "card.delete.desc":
    "This action is irreversible: the subscription, both API keys, and any events in the queue not yet consumed by the Agent will be permanently deleted. The webhook configured on the source platform will also be invalidated.",
  "card.delete.cancel": "Cancel",
  "card.delete.confirm": "Delete subscription",

  // Source guidance — GitHub
  "guidance.github.title": "Configure GitHub webhook",
  "guidance.github.intro.pre": "Go to your GitHub repository, open",
  "guidance.github.intro.nav": "Settings → Webhooks → Add webhook",
  "guidance.github.intro.post": "and fill in:",
  "guidance.payloadUrl": "Payload URL",
  "guidance.contentType": "Content type",
  "guidance.secret": "Secret",
  "guidance.github.secretNote":
    "Required. GitHub uses this to sign every delivery — the gateway verifies the signature and rejects unsigned events.",
  "guidance.events": "Events",
  "guidance.github.events.pre": "Select",
  "guidance.github.events.option": "Let me select individual events",
  "guidance.github.events.mid": "and pick the ones you need (e.g.",
  "guidance.github.events.sep": ", ",
  "guidance.github.events.post":
    "). The gateway stores all delivered events; your local agent decides which to act on.",

  // Source guidance — default (passthrough)
  "guidance.default.title": "Configure webhook",
  "guidance.default.desc":
    "Set the following URL as the webhook endpoint in your service. Events are accepted without signature verification (passthrough mode).",

  // Events page
  "events.title": "Events",
  "events.lead":
    "Events queued for your agent, newest first. Viewing here does not consume them — your agent still receives every event.",
  "events.refresh": "Refresh",
  "events.loading": "Loading...",
  "events.all": "All subscriptions",
  "events.loadingEvents": "Loading events...",
  "events.empty.title": "No queued events",
  "events.empty.desc":
    "Events appear here once a platform delivers a webhook to your subscription endpoint, and disappear after your agent consumes them.",
  "events.col.time": "Time",
  "events.col.subscription": "Subscription",
  "events.col.messageId": "Message ID",
  "events.col.payload": "Payload",

  // Admin page
  "admin.title": "Admin",
  "admin.lead": "Manage users and subscription rate limits.",
  "admin.tab.users": "Users",
  "admin.tab.subscriptions": "Subscriptions",
  "admin.col.email": "Email",
  "admin.col.provider": "Provider",
  "admin.col.admin": "Admin",
  "admin.col.status": "Status",
  "admin.col.created": "Created",
  "admin.col.actions": "Actions",
  "admin.col.label": "Label",
  "admin.col.id": "ID",
  "admin.col.owner": "Owner",
  "admin.col.rateLimit": "Rate limit",
  "admin.yes": "Yes",
  "admin.no": "No",
  "admin.active": "Active",
  "admin.disabled": "Disabled",
  "admin.revoked": "Revoked",
  "admin.enable": "Enable",
  "admin.disable": "Disable",
  "admin.loadFailed": "Failed to load data",

  // Language toggle
  "lang.label": "Language",

  // Login page
  "login.title": "Log in",
  "login.lead": "Sign in to manage notifications for your agents.",
  "login.emailLabel": "Email",
  "login.emailPlaceholder": "you@example.com",
  "login.submitEmail": "Continue with Email",
  "login.sendingCode": "Sending...",
  "login.codeSent": "Code sent to",
  "login.differentEmail": "Use a different email",
  "login.codeLabel": "Verification code",
  "login.codePlaceholder": "6-digit code",
  "login.submitCode": "Sign in",
  "login.verifying": "Verifying...",
  "login.notReceived": "Didn't receive it?",
  "login.resend": "Resend code",
  "login.divider": "OR",
  "login.continueGoogle": "Continue with Google",
  "login.backHome": "← Back to home",

  // Client-side form validation (shown via toast)
  "login.err.emailRequired": "Please enter your email",
  "login.err.emailInvalid": "Please enter a valid email address",
  "login.err.codeRequired": "Please enter the verification code",

  // OAuth callback error messages (shown via ?error= query param)
  "login.oauth.missing_code": "Login failed: missing authorization code",
  "login.oauth.token_exchange_failed": "Login failed: unable to verify Google credentials",
  "login.oauth.userinfo_failed": "Login failed: unable to fetch your profile",
  "login.oauth.no_email": "Login failed: Google did not share your email",
  "login.oauth.account_disabled": "This account has been disabled",
  "login.oauth.login_failed": "Login failed. Please try again.",

  // Server action errors (translated server-side via the request locale)
  "err.accountDisabled": "Account disabled",
  "err.loginFailed": "Login failed",
  "err.createTokenFailed": "Failed to create token",
  "err.loadSubscriptionsFailed": "Failed to load subscriptions",
  "err.loadEventsFailed": "Failed to load events",
  "err.subscriptionNotFound": "Subscription not found",
  "err.deleteSubscriptionFailed": "Failed to delete subscription",
  "err.loadTokensFailed": "Failed to load tokens",
  "err.webhookTokenNotFound": "Webhook token not found or revoked",
  "err.gatewayReturned": "Gateway returned {status}: {text}",
  "err.unknown": "Unknown error",
  "err.sendTestWebhookFailed": "Failed to send test webhook",
  "err.subscriptionNotFoundOrRevoked": "Subscription not found or revoked",
  "err.loadSubscriptionFailed": "Failed to load subscription",
  "err.loadUsersFailed": "Failed to load users",
  "err.updateUserFailed": "Failed to update user",
  "err.updateSubscriptionFailed": "Failed to update subscription",
  "err.updateInstructionsFailed": "Failed to update instructions",
  "err.invalidRateLimit": "Invalid rate limit",
  "err.updateRateLimitFailed": "Failed to update rate limit",
  "err.invalidEmail": "Invalid email address",
  "err.otpTooManySent": "Too many codes sent. Please wait a few minutes.",
  "err.otpExpired": "Code expired or not found. Please request a new one.",
  "err.otpTooManyAttempts": "Too many failed attempts. Please request a new one.",
  "err.otpInvalidCode": "Invalid code",
};

export type TKey = keyof typeof en;

export const zh: Record<TKey, string> = {
  // Nav
  "nav.subscriptions": "订阅",
  "nav.events": "事件",
  "nav.admin": "管理",

  // Subscriptions page
  "subs.title": "订阅",
  "subs.lead": "每个订阅会为一个平台来源创建 Webhook 端点，并将其事件排队等待你的 Agent 消费。",
  "subs.new": "新建",
  "subs.empty.title": "还没有订阅",
  "subs.empty.desc": "创建你的第一个订阅，开始接收来自 GitHub、Stripe、Linear 等平台的 Webhook 事件。",
  "subs.empty.cta": "创建订阅",

  // New subscription dialog
  "dialog.title": "新建订阅",
  "dialog.desc": "选择你要接收事件的平台，然后为这个订阅取一个名字。",
  "dialog.platform": "平台",
  "dialog.platform.placeholder": "选择一个平台",
  "dialog.source.custom": "自定义 Webhook",
  "dialog.label": "订阅名称",
  "dialog.label.placeholder": "例如：我的 {name} 项目",
  "dialog.label.hint": "一个便于识别的友好名称。",
  "dialog.submit": "创建订阅",
  "dialog.submitting": "创建中...",
  "dialog.error.nameRequired": "请填写订阅名称",
  "dialog.error.createFailed": "创建订阅失败",

  // Subscription card
  "card.disabled": "已禁用",
  "card.created": "创建于 {date}",
  "card.tab.webhook": "Webhook 配置",
  "card.tab.agent": "接入你的 Agent",
  "card.agent.infoPrefix": "将下面的指令发给",
  "card.agent.infoSuffix": "——指引会完成适配器安装，凭证会将其连接到本订阅。",
  "card.agent.prompt": [
    "请按照 {guideUrl} 安装 EventPort 适配器，并连接到我的订阅。",
    "指南 src/index.js 中带双花括号的 EG_URL / EG_TOKEN 占位符，",
    "必须替换为以下实际值：",
    "EG_URL={gatewayUrl}",
    "EG_TOKEN={consumerKey}",
  ].join("\n"),
  "card.agent.tokenUnavailable": "消费者令牌不可用。",
  "card.instructions.title": "事件指令",
  "card.instructions.hint":
    "每个事件到达时按 payload 渲染，随 text 发给你的 agent。用 {{a.b.c}} 占位符从 payload 提取字段；留空则只发送原始 payload。",
  "card.instructions.placeholder":
    "例如：请 review 这个 GitHub PR：仓库 {{repository.full_name}}，分支 {{pull_request.head.ref}}",
  "card.instructions.save": "保存",
  "card.instructions.saving": "保存中...",
  "card.instructions.saved": "指令已保存",
  "card.test": "发送测试事件",
  "card.testing": "发送中...",
  "card.delete": "删除",
  "card.delete.title": "删除“{label}”？",
  "card.delete.desc":
    "此操作不可撤销：订阅、两个 API 密钥以及队列中尚未被 Agent 消费的所有事件都将被永久删除，源平台上配置的 Webhook 也会随之失效。",
  "card.delete.cancel": "取消",
  "card.delete.confirm": "删除订阅",

  // Source guidance — GitHub
  "guidance.github.title": "配置 GitHub Webhook",
  "guidance.github.intro.pre": "前往你的 GitHub 仓库，打开",
  "guidance.github.intro.nav": "Settings → Webhooks → Add webhook",
  "guidance.github.intro.post": "并填写以下内容：",
  "guidance.payloadUrl": "Payload URL",
  "guidance.contentType": "Content type",
  "guidance.secret": "Secret",
  "guidance.github.secretNote": "必填。GitHub 会用它为每次投递签名——网关会校验签名并拒绝未签名的事件。",
  "guidance.events": "事件",
  "guidance.github.events.pre": "选择",
  "guidance.github.events.option": "Let me select individual events",
  "guidance.github.events.mid": "并勾选你需要的事件（例如",
  "guidance.github.events.sep": "、",
  "guidance.github.events.post": "）。网关会存储所有送达的事件，由本地 Agent 决定处理哪些。",

  // Source guidance — default (passthrough)
  "guidance.default.title": "配置 Webhook",
  "guidance.default.desc": "将以下 URL 设置为你的服务中的 Webhook 端点。事件将以透传模式接收（不校验签名）。",

  // Events page
  "events.title": "事件",
  "events.lead": "为你的 Agent 排队的事件，最新在前。在此查看不会消耗事件——Agent 仍会收到全部事件。",
  "events.refresh": "刷新",
  "events.loading": "加载中...",
  "events.all": "全部订阅",
  "events.loadingEvents": "正在加载事件...",
  "events.empty.title": "暂无排队事件",
  "events.empty.desc": "当平台向你的订阅端点投递 Webhook 后，事件会出现在这里；Agent 消费后即消失。",
  "events.col.time": "时间",
  "events.col.subscription": "订阅",
  "events.col.messageId": "消息 ID",
  "events.col.payload": "负载",

  // Admin page
  "admin.title": "管理",
  "admin.lead": "管理用户和订阅速率限制。",
  "admin.tab.users": "用户",
  "admin.tab.subscriptions": "订阅",
  "admin.col.email": "邮箱",
  "admin.col.provider": "登录方式",
  "admin.col.admin": "管理员",
  "admin.col.status": "状态",
  "admin.col.created": "创建时间",
  "admin.col.actions": "操作",
  "admin.col.label": "标签",
  "admin.col.id": "ID",
  "admin.col.owner": "所有者",
  "admin.col.rateLimit": "速率限制",
  "admin.yes": "是",
  "admin.no": "否",
  "admin.active": "启用中",
  "admin.disabled": "已禁用",
  "admin.revoked": "已撤销",
  "admin.enable": "启用",
  "admin.disable": "禁用",
  "admin.loadFailed": "加载数据失败",

  // Language toggle
  "lang.label": "语言",

  // Login page
  "login.title": "登录",
  "login.lead": "登录后管理你的 Agent 通知。",
  "login.emailLabel": "邮箱",
  "login.emailPlaceholder": "you@example.com",
  "login.submitEmail": "使用邮箱继续",
  "login.sendingCode": "发送中...",
  "login.codeSent": "验证码已发送至",
  "login.differentEmail": "换一个邮箱",
  "login.codeLabel": "验证码",
  "login.codePlaceholder": "6 位数字验证码",
  "login.submitCode": "登录",
  "login.verifying": "验证中...",
  "login.notReceived": "没收到？",
  "login.resend": "重新发送",
  "login.divider": "或",
  "login.continueGoogle": "使用 Google 登录",
  "login.backHome": "← 返回首页",

  // Client-side form validation (shown via toast)
  "login.err.emailRequired": "请输入邮箱",
  "login.err.emailInvalid": "请输入正确的邮箱地址",
  "login.err.codeRequired": "请输入验证码",

  // OAuth callback error messages (shown via ?error= query param)
  "login.oauth.missing_code": "登录失败：缺少授权码",
  "login.oauth.token_exchange_failed": "登录失败：无法验证 Google 凭据",
  "login.oauth.userinfo_failed": "登录失败：无法获取你的个人资料",
  "login.oauth.no_email": "登录失败：Google 未分享你的邮箱",
  "login.oauth.account_disabled": "该账号已被禁用",
  "login.oauth.login_failed": "登录失败，请重试。",

  // Server action errors (translated server-side via the request locale)
  "err.accountDisabled": "账号已被禁用",
  "err.loginFailed": "登录失败",
  "err.createTokenFailed": "创建令牌失败",
  "err.loadSubscriptionsFailed": "加载订阅失败",
  "err.loadEventsFailed": "加载事件失败",
  "err.subscriptionNotFound": "订阅不存在",
  "err.deleteSubscriptionFailed": "删除订阅失败",
  "err.loadTokensFailed": "加载令牌失败",
  "err.webhookTokenNotFound": "Webhook 令牌不存在或已撤销",
  "err.gatewayReturned": "网关返回 {status}：{text}",
  "err.unknown": "未知错误",
  "err.sendTestWebhookFailed": "发送测试 Webhook 失败",
  "err.subscriptionNotFoundOrRevoked": "订阅不存在或已撤销",
  "err.loadSubscriptionFailed": "加载订阅失败",
  "err.loadUsersFailed": "加载用户失败",
  "err.updateUserFailed": "更新用户失败",
  "err.updateSubscriptionFailed": "更新订阅失败",
  "err.updateInstructionsFailed": "更新指令失败",
  "err.invalidRateLimit": "无效的速率限制",
  "err.updateRateLimitFailed": "更新速率限制失败",
  "err.invalidEmail": "无效的邮箱地址",
  "err.otpTooManySent": "发送次数过多，请稍后再试。",
  "err.otpExpired": "验证码已过期或不存在，请重新获取。",
  "err.otpTooManyAttempts": "失败次数过多，请重新获取验证码。",
  "err.otpInvalidCode": "验证码错误",
};

/** Shared lookup + {param} interpolation used by both the client provider and
 * the server-side translator. */
export const translate = (
  locale: Locale,
  key: TKey,
  params?: Record<string, string | number>,
): string => {
  let text = dictionaries[locale][key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
};

export const dictionaries: Record<Locale, Record<TKey, string>> = { en, zh };
