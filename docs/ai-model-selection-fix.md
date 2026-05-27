# AI 分析 · 模型选择 / Embedding 配置修复方案

> 自包含实施方案,可在独立 session 直接据此修改。**本文档只描述方案,落地前请按"实施前置"重新核对当前代码。**
> 关联 GitHub issue:#6「[Bug]: AI模型选项不能覆盖」。**已并入 v2.2.0 发布**(P0+P1+P2 全部落地,后端改动已重编 jar)。

## 1. 背景与根因

用户在「本次分析模型」下拉框选了 Gemini 模型,点「测试连接」报:

```
models/text-embedding-004 is not found for API version v1beta, or is not supported for generateContent.
```

即把 **embedding 模型 `text-embedding-004`** 发给了 chat 端点 `:generateContent`。根因(全部在前端):

1. `testProfileChat(profile)` 用 `normalizeProfileModels(profile)[0]`(含 embedding 的全量列表首个),**无视用户在下拉框选的 `modelSelection`**。
2. 下拉框 `modelOptions` 也用 `normalizeProfileModels` 构建 → embedding 模型可被当 chat 模型选中(真实「发送」同样会 404)。
3. profile 列表「聊天模型」展示也用 `normalizeProfileModels` → 把 embedding 误标为聊天模型。
4. Gemini 预设 `defaultChatModels: []` + `defaultEmbeddingModels: ['text-embedding-004']` → 新建 Gemini 配置时唯一存在的模型就是该 embedding,于是泄漏到上面所有地方。

**后端无此 bug**(已核对 `AIAnalysisProxyService.java`):chat 走 `:generateContent` 读 `model`、embeddings 走 `:embedContent` 读 `embeddingModel`、诊断走 ListModels 元数据接口,verb 由命中的端点决定,不会把 embedding 模型送进 generateContent。报告的 404 纯属前端传错 `model`。

## 2. 范围

- **P0**(必做):修报告的聊天模型选择 bug —— 前端改动 A+B+C。
- **P1**(同源,低风险):① 前端 chunk-embedding 补 `providerOptions`;② 后端 `/embeddings` 鉴权头修复。
- **P2**(加固):① 后端 chat 拒收 embedding 类模型;② 补测试。
- **暂缓**(见 §7):资料包(bundle)的 `defaultEmbeddingModel / defaultRetrievalMode` 死设置,需单独评估,不在本次。

涉及文件:
- `Horosa-Web/astrostudyui/src/utils/aiAnalysisProviders.js`
- `Horosa-Web/astrostudyui/src/components/aianalysis/AIAnalysisMain.js`
- `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/service/AIAnalysisProxyService.java`

---

## 3. P0 — 聊天模型选择(前端)

### P0-1 · `aiAnalysisProviders.js` · Gemini 补默认聊天模型
找到 `gemini:` 预设,把 `defaultChatModels: []` 改为:

```js
	gemini: {
		label: 'Gemini',
		protocolFamily: 'gemini',
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
		defaultChatModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],   // 原为 []
		defaultEmbeddingModels: ['text-embedding-004'],
		requestTimeoutMs: 120000,
	},
```

### P0-2 · `AIAnalysisMain.js` · 共 5 处
顶部已 `import { ... splitProviderModels } from '../../utils/aiAnalysisProviders'`,无需新增 import。`uniqueTextList / parseModelSelection / modelSelection` 均在作用域内。

**(a) 新增辅助函数**,紧跟在现有 `normalizeProfileModels` 之后:

```js
function normalizeProfileChatModels(profile){
	if(!profile){
		return [];
	}
	const all = normalizeProfileModels(profile);
	const embedding = new Set(splitProviderModels(all, profile.providerType).embeddingModels);
	return all.filter((model)=>!embedding.has(model));
}
```
> 在 `normalizeProfileModels` 的全量结果上剔除被 `splitProviderModels` 判为 embedding 的项,保序、绝不误删真实聊天模型。

**(b) 下拉框只列聊天模型** —— `modelOptions` 的 `React.useMemo` 内:
```js
// 原
			normalizeProfileModels(profile).forEach((model)=>{
// 改为
			normalizeProfileChatModels(profile).forEach((model)=>{
```

**(c) profile 列表「聊天模型」展示** —— 两处 `normalizeProfileModels(item)` 同改:
```js
// 原
							<div>聊天模型：{normalizeProfileModels(item).length ? normalizeProfileModels(item).join('、') : '未配置'}</div>
// 改为
							<div>聊天模型：{normalizeProfileChatModels(item).length ? normalizeProfileChatModels(item).join('、') : '未配置'}</div>
```

**(d) `testProfileChat` 改用选中/首个聊天模型,无模型时清晰提示** —— 整函数替换:
```js
	async function testProfileChat(profile, preferredModel){
		const chatModels = normalizeProfileChatModels(profile);
		const model = `${preferredModel || ''}`.trim() || chatModels[0] || '';
		if(!model){
			message.warning('该配置还没有可用的对话模型，请在「配置 API」→「聊天模型列表」中填写（如 gemini-2.5-flash），或点「拉取模型」自动获取');
			return;
		}
		try{
			const rsp = ensureServiceResponse(await requestAIAnalysisChat({
				providerType: profile.providerType,
				apiKey: profile.apiKey,
				baseUrl: profile.baseUrl,
				model,
				providerOptions: profile.providerOptions || {},
				messages: [
					{
						role: 'user',
						content: '请仅回复“连接成功”。',
					},
				],
			}), '测试连接失败');
			const text = rsp && rsp.Result && rsp.Result.content ? rsp.Result.content : '';
			message.success(text ? `测试成功：${text.slice(0, 24)}` : '测试成功');
		}catch(e){
			message.error(e && e.message ? `测试连接失败：${e.message}` : '测试连接失败');
		}
	}
```
要点:签名加 `preferredModel`;模型 = `preferredModel || chatModels[0]`;`model: models[0]` → `model`;空时 `warning` 而非静默 404。

**(e) 工具栏「测试连接」按钮把选中模型传进去**:
```js
// 原
									onClick={()=>activeProviderProfile && testProfileChat(activeProviderProfile)}
// 改为
									onClick={()=>activeProviderProfile && testProfileChat(activeProviderProfile, parseModelSelection(modelSelection).model)}
```
> 列表里那处 `onClick={()=>testProfileChat(item)}` **不动**——它无选中模型,自动取首个聊天模型。

### P0 连带效果(无需额外改)
- 真实「发送」`handleSend`、重生成 `handleRegenerateLastReply`、`applyBundle` 都用 `parseModelSelection(modelSelection).model`;下拉框去掉 embedding 后,这些路径也不会再 404。
- `modelOptions` 变化时的重置 effect 会把历史残留的 embedding 选择自动重置为首个聊天模型,无残留。

---

## 4. P1 — 同源低风险修复

### P1-1 · 前端 · `ensureChunkEmbeddings` 补 `providerOptions`
该函数里的 `requestEmbeddingVectors` 调用漏传 `providerOptions`(超时/额外头/鉴权不生效),与查询向量那次不一致。补一行:
```js
			const rsp = await requestEmbeddingVectors({
				providerType: profile.providerType,
				apiKey: profile.apiKey,
				baseUrl: profile.baseUrl,
				model: embeddingModel,
				embeddingModel,
				providerOptions: profile.providerOptions || {},   // 新增
				input: missing.map((item)=>item.content),
			});
```

### P1-2 · 后端 · `/embeddings` 鉴权头修复（`AIAnalysisProxyService.java`）
`embeddings()` 的两处用了 2 参 `buildAuthHeaders(providerType, apiKey)`(内部 `params=null`),导致丢失 `extraHeaders / authHeaderName / authPrefix /`(anthropic)`apiVersion`;而 chat/stream/listModels 都用 3 参带 `params`。两处改为 3 参:

```java
// openai-compatible 分支(原约 L207)
				buildAuthHeaders(providerType, stringVal(params, "apiKey"), params)
// gemini 分支(原约 L225)
				buildAuthHeaders(providerType, apiKey, params)
```
> 影响:自定义鉴权头的 provider 此前只在 embeddings 失败,修后与 chat 一致。后端改动需重新构建 Java jar(见 §6)。

---

## 5. P2 — 加固

### P2-1 · 后端 · chat 拒收 embedding 类模型（`AIAnalysisProxyService.java`）
在 `chat(...)` 与 `chatStream(...)` 解析出 `model` 之后(各自 `String model = requireModel(params);` 的下一行)加守卫,复用同类内的 `isEmbeddingModel`:
```java
		String model = requireModel(params);
		if(isEmbeddingModel(model, providerType)){
			throw new ErrorCodeException(580014, "所选模型是 Embedding 模型，不能用于对话，请选择聊天模型"); // 错误码取未占用者
		}
```
> 防御性:即便前端再次误传,也给出可读错误而非透传上游 404。

### P2-2 · 测试
`Horosa-Web/astrostudyui/src/utils/__tests__/aiAnalysisProviders.test.js` 现无对 Gemini 默认值的断言,故 P0-1 安全。建议补：
- 断言 `getProviderDefaultChatModels('gemini')` 等于 `['gemini-2.5-flash','gemini-2.5-pro']`;
- 若把 `normalizeProfileChatModels` 抽到可测工具中,补一条"含 embedding 的 profile 过滤后只剩聊天模型"的用例。

---

## 6. 已存在「坏」配置的处理
预设改动不回填已保存配置。用户那条只有 `text-embedding-004` 的 Gemini 配置,改完后:点一次「拉取模型」(写入真实 `gemini-*` 到 `chatModelIds`)或在「聊天模型列表」手填一个即可;在此之前测试会给清晰提示而非 404。

## 7. 暂缓项（待单独评估，不在本次）
资料包(bundle)编辑器可配「默认 Embedding 模型」`defaultEmbeddingModel` 与「默认检索策略」`defaultRetrievalMode`,均已保存,但 `applyBundle` 只应用了 `defaultModel + defaultSystemPrompt`,这两个被忽略 —— 死设置。另:`buildProviderOptionsFromForm` 从不写 `providerOptions.embeddingModel`,而 RAG 优先读它再回退首个 embedding,故该优先项形同虚设。
两条路:**接上**(需新增 session 级 embedding/检索状态,改动略广,像未完成的功能)或**删字段**避免误导。建议立项单独处理。

## 8. 验证
- 前端按 horosa-dev 流程起预览,复现"只有 text-embedding-004 的 Gemini 配置":
  - 改前:测试报 404(embedding 打 generateContent)。
  - 改后:下拉框不再出现该 embedding;新建 Gemini 配置预填 `gemini-2.5-flash/2.5-pro`;选中聊天模型测试走选中模型。
  - 打通 Gemini 200 成功路径需真实 API Key,逻辑/提示路径可本地验,真实成功响应需实测确认。
- 跑 `aiAnalysisProviders.test.js` 等既有用例 + P2-2 新增用例。
- 后端改动(P1-2/P2-1)需重新构建 Java jar 并随发布打包。

## 9. 发布(按既有规矩)
技术文档(本文件) + `docs/windows-sync-handoff.md` 增一条 + `release_preflight.sh` 自检(含版本断言) + 版本号定档。前端 build、后端 jar 重建、签名/公证、GitHub 发布、GitCode 镜像同步,按 horosa-dev 发布 runbook 执行。
