package spacex.astrostudy.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.Test;

public class AIAnalysisProxyServiceTest {

	@Test
	public void resolveBaseUrlUsesProviderDefaults() {
		assertEquals("https://api.openai.com/v1", AIAnalysisProxyService.resolveBaseUrl("openai", ""));
		assertEquals("https://api.deepseek.com", AIAnalysisProxyService.resolveBaseUrl("deepseek", null));
		assertEquals("https://openrouter.ai/api/v1", AIAnalysisProxyService.resolveBaseUrl("openrouter", null));
		assertEquals("http://127.0.0.1:11434/v1", AIAnalysisProxyService.resolveBaseUrl("ollama", null));
		assertEquals("https://api.moonshot.cn/v1", AIAnalysisProxyService.resolveBaseUrl("moonshot", null));
		assertEquals("https://open.bigmodel.cn/api/paas/v4", AIAnalysisProxyService.resolveBaseUrl("zhipu", null));
		assertEquals("https://api.siliconflow.cn/v1", AIAnalysisProxyService.resolveBaseUrl("siliconflow", null));
		assertEquals("https://api.groq.com/openai/v1", AIAnalysisProxyService.resolveBaseUrl("groq", null));
		assertEquals("https://api.x.ai/v1", AIAnalysisProxyService.resolveBaseUrl("xai", null));
	}

	@Test
	public void protocolFamilySupportsMainstreamProviderPresets() {
		assertEquals("openai-compatible", AIAnalysisProxyService.protocolFamily("deepseek"));
		assertEquals("openai-compatible", AIAnalysisProxyService.protocolFamily("moonshot"));
		assertEquals("openai-compatible", AIAnalysisProxyService.protocolFamily("zhipu"));
		assertEquals("openai-compatible", AIAnalysisProxyService.protocolFamily("siliconflow"));
		assertEquals("openai-compatible", AIAnalysisProxyService.protocolFamily("groq"));
		assertEquals("openai-compatible", AIAnalysisProxyService.protocolFamily("xai"));
		assertEquals("anthropic", AIAnalysisProxyService.protocolFamily("anthropic"));
		assertEquals("gemini", AIAnalysisProxyService.protocolFamily("gemini"));
		assertEquals("ollama", AIAnalysisProxyService.protocolFamily("ollama"));
	}

	@Test
	public void extractModelIdsSupportsOpenAIAndOllamaShapes() {
		Map<String, Object> payload = new HashMap<String, Object>();
		payload.put("data", Arrays.asList(
			buildMap("id", "gpt-4.1"),
			buildMap("id", "gpt-4.1-mini")
		));
		payload.put("models", Arrays.asList(
			buildMap("name", "llama3.1")
		));
		List<String> ids = AIAnalysisProxyService.extractModelIds(payload);
		assertEquals(Arrays.asList("gpt-4.1", "gpt-4.1-mini", "llama3.1"), ids);
	}

	@Test
	public void splitProviderModelsSeparatesEmbeddingModels() {
		Map<String, Object> split = AIAnalysisProxyService.splitProviderModels(
			Arrays.asList("deepseek-chat", "text-embedding-3-small", "mock-embedding-1"),
			"deepseek"
		);
		assertEquals(Arrays.asList("deepseek-chat"), split.get("chatModels"));
		assertEquals(Arrays.asList("text-embedding-3-small", "mock-embedding-1"), split.get("embeddingModels"));
	}

	@Test
	public void extractChatContentSupportsOpenAIAndGeminiShapes() {
		Map<String, Object> openai = new LinkedHashMap<String, Object>();
		openai.put("choices", Arrays.asList(
			buildMap("message", buildMap("content", "分析结果"))
		));
		assertEquals("分析结果", AIAnalysisProxyService.extractChatContent("openai", openai));

		Map<String, Object> gemini = new LinkedHashMap<String, Object>();
		gemini.put("candidates", Arrays.asList(
			buildMap("content", buildMap("parts", Arrays.asList(buildMap("text", "Gemini结果"))))
		));
		assertEquals("Gemini结果", AIAnalysisProxyService.extractChatContent("gemini", gemini));
	}

	@Test
	public void extractOpenAIStreamDeltaReadsDeltaAndContentList() {
		Map<String, Object> payload = new LinkedHashMap<String, Object>();
		payload.put("choices", Arrays.asList(
			buildMap("delta", buildMap("content", "流式结果"))
		));
		assertEquals("流式结果", AIAnalysisProxyService.extractOpenAIStreamDelta(payload));

		Map<String, Object> richPayload = new LinkedHashMap<String, Object>();
		richPayload.put("choices", Arrays.asList(
			buildMap("delta", buildMap("content", Arrays.asList(buildMap("text", "分段"))))
		));
		assertEquals("分段", AIAnalysisProxyService.extractOpenAIStreamDelta(richPayload));
	}

	@Test
	public void extractAnthropicStreamDeltaOnlyReadsContentBlockDelta() {
		Map<String, Object> payload = buildMap(
			"type", "content_block_delta",
			"delta", buildMap("text", "Anthropic流")
		);
		assertEquals("Anthropic流", AIAnalysisProxyService.extractAnthropicStreamDelta("content_block_delta", payload));
		assertEquals("", AIAnalysisProxyService.extractAnthropicStreamDelta("message_stop", buildMap("type", "message_stop")));
	}

	@Test
	public void extractAnthropicStreamThinkingReadsThinkingDelta() {
		// #54-G：extended thinking 的思考块 delta.type=='thinking_delta'、文本在 delta.thinking。
		Map<String, Object> think = buildMap(
			"type", "content_block_delta",
			"delta", buildMap("type", "thinking_delta", "thinking", "正在推演本命")
		);
		assertEquals("正在推演本命", AIAnalysisProxyService.extractAnthropicStreamThinking("content_block_delta", think));
		// 思考块不应被当作正文 delta(避免思维链混入正文)。
		assertEquals("", AIAnalysisProxyService.extractAnthropicStreamDelta("content_block_delta", think));
		// 正文块(text_delta)不应被当作思考。
		Map<String, Object> body = buildMap(
			"type", "content_block_delta",
			"delta", buildMap("type", "text_delta", "text", "正文")
		);
		assertEquals("", AIAnalysisProxyService.extractAnthropicStreamThinking("content_block_delta", body));
		assertEquals("正文", AIAnalysisProxyService.extractAnthropicStreamDelta("content_block_delta", body));
	}

	@Test
	public void extractGeminiContentExcludesThoughtParts() {
		// #54-G：Gemini 思考模型把思维链放在 part.thought==true；正文只取非思考 part，思考走 reasoning。
		Map<String, Object> payload = buildMap("candidates", Arrays.asList(
			buildMap("content", buildMap("parts", Arrays.asList(
				buildMap("text", "正在思考", "thought", Boolean.TRUE),
				buildMap("text", "正文内容")
			)))
		));
		assertEquals("正文内容", AIAnalysisProxyService.extractGeminiContent(payload));
		assertEquals("正在思考", AIAnalysisProxyService.extractGeminiThinking(payload));
		// 普通响应(无 thought 字段)零回归:全部当正文、思考为空。
		Map<String, Object> plain = buildMap("candidates", Arrays.asList(
			buildMap("content", buildMap("parts", Arrays.asList(buildMap("text", "纯正文"))))
		));
		assertEquals("纯正文", AIAnalysisProxyService.extractGeminiContent(plain));
		assertEquals("", AIAnalysisProxyService.extractGeminiThinking(plain));
	}

	@Test
	public void extractEmbeddingVectorsSupportsOpenAIShape() {
		Map<String, Object> payload = buildMap(
			"data", Arrays.asList(
				buildMap("embedding", Arrays.asList(0.1d, 0.2d)),
				buildMap("embedding", Arrays.asList(0.3d, 0.4d))
			)
		);
		List<List<Double>> vectors = AIAnalysisProxyService.extractEmbeddingVectors(payload);
		assertEquals(2, vectors.size());
		assertEquals(Arrays.asList(0.1d, 0.2d), vectors.get(0));
	}

	@Test
	public void extractModelIdsSkipsEmptyValues() {
		Map<String, Object> payload = buildMap(
			"data", Arrays.asList(
				buildMap("id", ""),
				buildMap("name", "model-a"),
				"",
				null
			)
		);
		List<String> ids = AIAnalysisProxyService.extractModelIds(payload);
		assertEquals(1, ids.size());
		assertEquals("model-a", ids.get(0));
		assertFalse(ids.contains(""));
	}

	@Test
	public void getMessageListNormalizesInput() {
		List<Map<String, Object>> messages = AIAnalysisProxyService.getMessageList(Arrays.asList(
			buildMap("role", "system", "content", "你是助手"),
			buildMap("role", "user", "content", "请分析")
		));
		assertEquals(2, messages.size());
		assertEquals("system", messages.get(0).get("role"));
		assertTrue(messages.get(1).containsKey("content"));
	}

	@Test
	public void buildAuthHeadersSupportsAnthropicApiVersionAndExtraHeaders() {
		Map<String, Object> params = buildMap(
			"providerOptions", buildMap(
				"apiVersion", "2024-02-29",
				"extraHeaders", buildMap("x-test-header", "demo")
			)
		);
		Map<String, String> headers = AIAnalysisProxyService.buildAuthHeaders("anthropic", "anth-key", params);
		assertEquals("2024-02-29", headers.get("anthropic-version"));
		assertEquals("demo", headers.get("x-test-header"));
		assertEquals("anth-key", headers.get("x-api-key"));
	}

	@Test
	public void buildProviderBodyOptionsMergesExtraBodyAndSkipsReservedKeys() {
		Map<String, Object> params = buildMap(
			"providerOptions", buildMap(
				"extraHeaders", buildMap("x-debug", "1"),
				"extraBody", buildMap("response_format", buildMap("type", "json_object")),
				"requestTimeoutMs", 15000,
				"streamStallMs", 2000,
				"streamMaxStreamMs", 60000,
				"maxRetries", 2,
				"top_p", 0.8d
			)
		);
		Map<String, Object> bodyOptions = AIAnalysisProxyService.buildProviderBodyOptions(params);
		assertTrue(bodyOptions.containsKey("response_format"));
		assertEquals(0.8d, bodyOptions.get("top_p"));
		assertFalse(bodyOptions.containsKey("extraHeaders"));
		assertFalse(bodyOptions.containsKey("requestTimeoutMs"));
		// [D68] 代理/前端自用键一律不进上游请求体(官方 schema 校验实抓:maxRetries 进了 Anthropic 顶层 = 400 类)
		assertFalse(bodyOptions.containsKey("streamStallMs"));
		assertFalse(bodyOptions.containsKey("streamMaxStreamMs"));
		assertFalse(bodyOptions.containsKey("maxRetries"));
	}

	@Test
	public void isOpenAIReasoningModelMatchesGpt5AndOSeries() {
		assertTrue(AIAnalysisProxyService.isOpenAIReasoningModel("gpt-5.5"));
		assertTrue(AIAnalysisProxyService.isOpenAIReasoningModel("gpt-5.5-2026-04-23"));
		assertTrue(AIAnalysisProxyService.isOpenAIReasoningModel("o3-mini"));
		assertTrue(AIAnalysisProxyService.isOpenAIReasoningModel("o1"));
		assertTrue(AIAnalysisProxyService.isOpenAIReasoningModel("openai/gpt-5"));
		assertFalse(AIAnalysisProxyService.isOpenAIReasoningModel("gpt-4.1"));
		assertFalse(AIAnalysisProxyService.isOpenAIReasoningModel("gpt-4o"));
		assertFalse(AIAnalysisProxyService.isOpenAIReasoningModel("deepseek-reasoner"));
		assertFalse(AIAnalysisProxyService.isOpenAIReasoningModel(null));
	}

	// 🔴 #54 生产形态回归钉：前端把输出预算写进 **providerOptions.max_tokens**（不是顶层 maxTokens），
	// 此前该形态经 putAll 原样上线 → gpt-5.5/5.6 恒 400 unsupported_parameter。
	// 既有两例喂的都是顶层 maxTokens（生产从不这么发）＝盲区，故补本例。
	@Test
	public void buildOpenAIChatBodyNormalizesProviderOptionsMaxTokensForNewGeneration() {
		List<Map<String, Object>> messages = AIAnalysisProxyService.getMessageList(Arrays.asList(
			buildMap("role", "user", "content", "hi")
		));
		Map<String, Object> params = buildMap("providerOptions", buildMap("max_tokens", 4096));

		for(String model : new String[]{"gpt-5.5", "gpt-5.6-sol", "gpt-5.6-terra", "o3-pro", "openrouter/openai/gpt-6"}) {
			Map<String, Object> body = AIAnalysisProxyService.buildOpenAIChatBody(model, params, messages, false);
			assertFalse(model + " 不应再出现 max_tokens", body.containsKey("max_tokens"));
			assertEquals(model + " 应改键为 max_completion_tokens",
				Integer.valueOf(4096), body.get("max_completion_tokens"));
		}

		// 老代 OpenAI 与非 OpenAI 推理模型：仍用 max_tokens（反向保护，勿误伤）
		for(String model : new String[]{"gpt-4.1", "deepseek-reasoner", "qwen-max"}) {
			Map<String, Object> body = AIAnalysisProxyService.buildOpenAIChatBody(model, params, messages, false);
			assertEquals(model + " 应保持 max_tokens", Integer.valueOf(4096), body.get("max_tokens"));
			assertFalse(model + " 不应出现 max_completion_tokens", body.containsKey("max_completion_tokens"));
		}
	}

	// [Q-062/AW-35] Ollama 原生口:官方**顶层**键(think / format / keep_alive …)必须落顶层,采样类才进 options。
	// 此前除 keep_alive 外一律塞进 options ⇒ 用户在「额外请求体」里写的 think:true 之类被 Ollama 静默忽略。
	@Test
	public void buildOllamaNativeBodyKeepsOfficialTopLevelKeysAtTopLevel() {
		AIAnalysisProxyService svc = new AIAnalysisProxyService();
		Map<String, Object> provOpts = new LinkedHashMap<String, Object>();
		provOpts.put("think", Boolean.TRUE);
		provOpts.put("keep_alive", "10m");
		provOpts.put("num_ctx", 8192);
		provOpts.put("top_k", 40);
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("providerType", "ollama");
		params.put("providerOptions", provOpts);
		List<Map<String, Object>> msgs = AIAnalysisProxyService.getMessageList(Arrays.asList(
			buildMap("role", "user", "content", "你好")));
		Map<String, Object> body = svc.buildOllamaNativeBody("qwen3:8b", params, msgs, false);
		assertEquals(Boolean.TRUE, body.get("think"));
		assertEquals("10m", body.get("keep_alive"));
		@SuppressWarnings("unchecked")
		Map<String, Object> opts = (Map<String, Object>) body.get("options");
		assertNotNull(opts);
		assertEquals(8192, ((Number) opts.get("num_ctx")).intValue());   // 判别向量:采样/运行参数仍进 options
		assertEquals(40, ((Number) opts.get("top_k")).intValue());
		assertEquals(null, opts.get("think"));
		assertEquals(null, opts.get("keep_alive"));
	}

	// [Q-396] 改键自愈的两道闸:① 只对 OpenAI 兼容家族(Anthropic 的 max_tokens 是必填键,改了必再 400
	// 且把原始真因盖掉);② 只认「这个键不支持」类措辞,越界类报错不改键。
	@Test
	public void healUpstreamRequestBodyRenameIsOpenAIOnlyAndNotForRangeErrors() {
		String req = "{\"model\":\"claude-sonnet-4-5\",\"max_tokens\":200000}";
		// Anthropic 越界报错:错误体 type 恒为 invalid_request_error(旧逻辑就是被这个 "invalid" 骗到)
		String anthropicRange = "{\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\","
			+ "\"message\":\"max_tokens: 200000 > 64000, which is the maximum allowed number of output tokens\"}}";
		assertEquals("Anthropic 越界报错绝不改键", null,
			AIAnalysisProxyService.healUpstreamRequestBody(400, anthropicRange, req, "anthropic"));
		// 同一条报错落到 OpenAI 家族也不该改键(是值越界,不是键不支持)
		assertEquals("越界类报错不改键", null,
			AIAnalysisProxyService.healUpstreamRequestBody(400, anthropicRange, "{\"model\":\"gpt-4.1\",\"max_tokens\":200000}", "openai"));
		// 判别向量:同一入口下,OpenAI 家族的「键不支持」照旧改键
		String unsupported = "{\"error\":{\"message\":\"Unsupported parameter: 'max_tokens'\",\"code\":\"unsupported_parameter\"}}";
		String healed = AIAnalysisProxyService.healUpstreamRequestBody(400, unsupported, "{\"model\":\"gpt-5.6-sol\",\"max_tokens\":2048}", "openai");
		assertNotNull("OpenAI 家族键不支持仍要改键", healed);
		assertTrue(healed.contains("max_completion_tokens"));
		// 同一条错误文落到 Anthropic / Gemini / Ollama 一律不改键
		for(String pt : new String[]{"anthropic", "gemini", "ollama"}) {
			assertEquals(pt + " 不改键", null,
				AIAnalysisProxyService.healUpstreamRequestBody(400, unsupported, "{\"model\":\"m\",\"max_tokens\":2048}", pt));
		}
		assertTrue(AIAnalysisProxyService.allowsMaxTokensRename(""));
		assertTrue(AIAnalysisProxyService.allowsMaxTokensRename("deepseek"));
		assertFalse(AIAnalysisProxyService.allowsMaxTokensRename("Anthropic"));
	}

	// 上游只说「max_tokens 不支持」而不点名替代键时，自愈层也应改键（网关文案差异兜底）。
	@Test
	public void healUpstreamRequestBodyRenamesMaxTokensWhenReplacementNotNamed() {
		String req = "{\"model\":\"gpt-5.6-sol\",\"max_tokens\":2048}";
		String err = "{\"error\":{\"message\":\"Unsupported parameter: 'max_tokens'\",\"code\":\"unsupported_parameter\"}}";
		String healed = AIAnalysisProxyService.healUpstreamRequestBody(400, err, req);
		assertNotNull("应产出自愈请求体", healed);
		assertTrue(healed.contains("max_completion_tokens"));
		assertFalse(healed.contains("\"max_tokens\""));
	}

	@Test
	public void buildOpenAIChatBodyAdaptsReasoningModels() {
		List<Map<String, Object>> messages = AIAnalysisProxyService.getMessageList(Arrays.asList(
			buildMap("role", "user", "content", "hi")
		));
		Map<String, Object> params = buildMap("maxTokens", 1024);

		Map<String, Object> reasoning = AIAnalysisProxyService.buildOpenAIChatBody("gpt-5.5", params, messages, false);
		assertFalse(reasoning.containsKey("temperature"));
		assertFalse(reasoning.containsKey("max_tokens"));
		assertEquals(Integer.valueOf(1024), reasoning.get("max_completion_tokens"));

		Map<String, Object> classic = AIAnalysisProxyService.buildOpenAIChatBody("gpt-4.1", params, messages, false);
		assertEquals(0.7d, classic.get("temperature"));
		assertEquals(Integer.valueOf(1024), classic.get("max_tokens"));
		assertFalse(classic.containsKey("max_completion_tokens"));
	}

	@Test
	public void readErrorBodyDecodesAndTruncatesUpstreamError() {
		java.io.InputStream small = new java.io.ByteArrayInputStream(
			"temperature does not support 0.7".getBytes(java.nio.charset.StandardCharsets.UTF_8));
		assertEquals("temperature does not support 0.7", AIAnalysisProxyService.readErrorBody(small));

		// non-InputStream input yields empty (no crash)
		assertEquals("", AIAnalysisProxyService.readErrorBody("not a stream"));
		assertEquals("", AIAnalysisProxyService.readErrorBody(null));

		// A5(#16):放宽截断到 4000 字符(+省略号),让上游完整错误真因透传 —— 2000 字以内不截断
		byte[] mid = new byte[2000];
		java.util.Arrays.fill(mid, (byte) 'x');
		assertEquals(2000, AIAnalysisProxyService.readErrorBody(new java.io.ByteArrayInputStream(mid)).length());
		// 超过 4000 字才截断到 4000 + 省略号
		byte[] big = new byte[5000];
		java.util.Arrays.fill(big, (byte) 'x');
		String truncated = AIAnalysisProxyService.readErrorBody(new java.io.ByteArrayInputStream(big));
		assertEquals(4001, truncated.length());
		assertTrue(truncated.endsWith("…"));
	}

	@Test
	public void buildAuthHeadersOmitsBearerForGeminiAndSupportsOverride() {
		Map<String, String> gemini = AIAnalysisProxyService.buildAuthHeaders("gemini", "AIza-key", buildMap());
		assertFalse(gemini.containsKey("Authorization"));

		Map<String, String> openai = AIAnalysisProxyService.buildAuthHeaders("openai", "sk-key", buildMap());
		assertEquals("Bearer sk-key", openai.get("Authorization"));

		Map<String, Object> overrideParams = buildMap("providerOptions", buildMap("authHeaderName", "x-api-key", "authPrefix", ""));
		Map<String, String> custom = AIAnalysisProxyService.buildAuthHeaders("custom", "raw-key", overrideParams);
		assertEquals("raw-key", custom.get("x-api-key"));
		assertFalse(custom.containsKey("Authorization"));

		Map<String, String> ollama = AIAnalysisProxyService.buildAuthHeaders("ollama", "", buildMap());
		assertFalse(ollama.containsKey("Authorization"));
	}

	@Test
	public void extractOpenAIStreamReasoningPicksReasoningContent() {
		// #16:DeepSeek reasoner 的思维链在 delta.reasoning_content,旧实现会丢弃 → 思考期界面空白被当失败。
		Map<String, Object> rc = buildMap("choices", Arrays.asList(
			buildMap("delta", buildMap("reasoning_content", "正在推理…"))));
		assertEquals("正在推理…", AIAnalysisProxyService.extractOpenAIStreamReasoning(rc));
		// 部分网关把思考放在 delta.reasoning
		Map<String, Object> rr = buildMap("choices", Arrays.asList(
			buildMap("delta", buildMap("reasoning", "思考中"))));
		assertEquals("思考中", AIAnalysisProxyService.extractOpenAIStreamReasoning(rr));
		// 纯 content 帧不应被当作 reasoning;content 仍正常解析
		Map<String, Object> only = buildMap("choices", Arrays.asList(
			buildMap("delta", buildMap("content", "答案"))));
		assertEquals("", AIAnalysisProxyService.extractOpenAIStreamReasoning(only));
		assertEquals("答案", AIAnalysisProxyService.extractOpenAIStreamDelta(only));
	}

	@Test
	public void isReasoningModelMatchesReasonerAndR1AndOpenAISeries() {
		assertTrue(AIAnalysisProxyService.isReasoningModel("deepseek-reasoner"));
		assertTrue(AIAnalysisProxyService.isReasoningModel("openrouter/deepseek/deepseek-r1"));
		assertTrue(AIAnalysisProxyService.isReasoningModel("deepseek-r1:7b"));
		assertTrue(AIAnalysisProxyService.isReasoningModel("o1-mini"));
		assertTrue(AIAnalysisProxyService.isReasoningModel("gpt-5"));
		assertFalse(AIAnalysisProxyService.isReasoningModel("deepseek-chat"));
		assertFalse(AIAnalysisProxyService.isReasoningModel("gpt-4o"));
		assertFalse(AIAnalysisProxyService.isReasoningModel("qwen2.5"));
	}

	@Test
	public void buildOpenAIChatBodyStripsSamplingParamsForReasoner() {
		// #16:deepseek-reasoner 不下发 temperature/top_p/penalties,且用 max_tokens(非 max_completion_tokens)。
		Map<String, Object> params = buildMap(
			"temperature", 0.7,
			"maxTokens", 1024,
			"providerOptions", buildMap("top_p", 0.9, "frequency_penalty", 0.5));
		Map<String, Object> body = AIAnalysisProxyService.buildOpenAIChatBody(
			"deepseek-reasoner", params, new java.util.ArrayList<Map<String, Object>>(), true);
		assertFalse("reasoner 不应带 temperature", body.containsKey("temperature"));
		assertFalse("reasoner 不应带 top_p", body.containsKey("top_p"));
		assertFalse("reasoner 不应带 frequency_penalty", body.containsKey("frequency_penalty"));
		assertTrue(body.containsKey("max_tokens"));
		assertFalse(body.containsKey("max_completion_tokens"));

		// 普通聊天模型 deepseek-chat:照常带 temperature 与 providerOptions 采样参数。
		Map<String, Object> body2 = AIAnalysisProxyService.buildOpenAIChatBody(
			"deepseek-chat", params, new java.util.ArrayList<Map<String, Object>>(), true);
		assertTrue(body2.containsKey("temperature"));
		assertTrue(body2.containsKey("top_p"));
	}

	@Test
	public void buildOpenAIChatBodyUsesMaxCompletionTokensForOpenAIReasoner() {
		Map<String, Object> params = buildMap("maxTokens", 2048);
		Map<String, Object> body = AIAnalysisProxyService.buildOpenAIChatBody(
			"o1-preview", params, new java.util.ArrayList<Map<String, Object>>(), false);
		assertTrue(body.containsKey("max_completion_tokens"));
		assertFalse(body.containsKey("max_tokens"));
		assertFalse(body.containsKey("temperature"));
	}

	@Test
	public void buildAnthropicBodyThinkingComplianceStripsTemperatureAndTopK() {
		// Anthropic extended thinking 开启(预算族 Sonnet 4.5):① 不发 temperature ② 不发 top_k/top_p ③ max_tokens > budget_tokens。
		Map<String, Object> thinking = buildMap("type", "enabled", "budget_tokens", 4096);
		Map<String, Object> params = buildMap(
			"temperature", 0.7,
			"maxTokens", 2048,
			"providerOptions", buildMap("thinking", thinking, "top_k", 40, "top_p", 0.9));
		Map<String, Object> body = AIAnalysisProxyService.buildAnthropicBody(
			"claude-sonnet-4-5", params, new java.util.ArrayList<Map<String, Object>>(), true);
		assertFalse("思考开启不应发 temperature", body.containsKey("temperature"));
		assertFalse("思考开启不应发 top_k", body.containsKey("top_k"));
		assertFalse("思考开启不应发 top_p", body.containsKey("top_p"));
		assertEquals(buildMap("type", "enabled", "budget_tokens", 4096), body.get("thinking"));
		// max_tokens(2048) <= budget(4096) → 自动上调到 budget+1024,保证 max_tokens > budget_tokens。
		assertEquals(Integer.valueOf(4096 + 1024), body.get("max_tokens"));
	}

	@Test
	public void structuredSchemaToolChoiceAutoWhenThinkingActive() {
		// [Q-293/M-108] 结构化(json_schema 非流式)→ 强制 schema 工具;思考生效的型号(Fable 恒开 / 显式 adaptive)tool_choice 必须是 auto,
		// 思考关闭(Haiku 4.5 缺省关 / 显式 disabled)照旧强制 tool。
		Map<String, Object> rf = buildMap("type", "json_schema", "json_schema", buildMap("name", "verdict", "schema", buildMap("type", "object")));
		Map<String, Object> fable = AIAnalysisProxyService.buildAnthropicBody("claude-fable-5-1", buildMap("providerOptions", buildMap("response_format", rf)), java.util.Collections.<Map<String, Object>>emptyList(), false);
		assertEquals("auto", ((Map) fable.get("tool_choice")).get("type"));
		assertNotNull(fable.get("tools"));
		Map<String, Object> haiku = AIAnalysisProxyService.buildAnthropicBody("claude-haiku-4-5-20251001", buildMap("providerOptions", buildMap("response_format", rf)), java.util.Collections.<Map<String, Object>>emptyList(), false);
		assertEquals("tool", ((Map) haiku.get("tool_choice")).get("type"));
		assertEquals("verdict", ((Map) haiku.get("tool_choice")).get("name"));
		Map<String, Object> sonnetOff = AIAnalysisProxyService.buildAnthropicBody("claude-sonnet-5", buildMap("providerOptions", buildMap("response_format", rf, "thinking", buildMap("type", "disabled"))), java.util.Collections.<Map<String, Object>>emptyList(), false);
		assertEquals("tool", ((Map) sonnetOff.get("tool_choice")).get("type"));
	}

	@Test
	public void buildAnthropicBodyWithoutThinkingKeepsTemperature() {
		// 预算族未开思考:照常发 temperature + 原 max_tokens(零回归)。
		Map<String, Object> params = buildMap("temperature", 0.5, "maxTokens", 2048);
		Map<String, Object> body = AIAnalysisProxyService.buildAnthropicBody(
			"claude-sonnet-4-5", params, new java.util.ArrayList<Map<String, Object>>(), false);
		assertTrue(body.containsKey("temperature"));
		assertEquals(0.5d, body.get("temperature"));
		assertEquals(Integer.valueOf(2048), body.get("max_tokens"));
		assertFalse(body.containsKey("thinking"));
		assertFalse(body.containsKey("output_config"));
	}

	@Test
	public void anthropicThinkingModeTable() {
		// [Q-024] 官方每型号表:自适应族 vs 预算族;网关前缀取尾段;未知命名归预算族。
		assertEquals("adaptive", AIAnalysisProxyService.anthropicThinkingMode("claude-opus-4-7"));
		assertEquals("adaptive", AIAnalysisProxyService.anthropicThinkingMode("claude-opus-4-8"));
		assertEquals("adaptive", AIAnalysisProxyService.anthropicThinkingMode("claude-opus-5"));
		assertEquals("adaptive", AIAnalysisProxyService.anthropicThinkingMode("claude-sonnet-5"));
		assertEquals("adaptive", AIAnalysisProxyService.anthropicThinkingMode("claude-fable-5-1"));
		assertEquals("adaptive", AIAnalysisProxyService.anthropicThinkingMode("anthropic/claude-mythos-5"));
		assertEquals("budget", AIAnalysisProxyService.anthropicThinkingMode("claude-opus-4-6"));
		assertEquals("budget", AIAnalysisProxyService.anthropicThinkingMode("claude-sonnet-4-5"));
		assertEquals("budget", AIAnalysisProxyService.anthropicThinkingMode("claude-haiku-4-5-20251001"));
		assertEquals("budget", AIAnalysisProxyService.anthropicThinkingMode("claude-3-5-sonnet-20241022"));
		assertEquals("budget", AIAnalysisProxyService.anthropicThinkingMode("claude-x"));
		assertTrue(AIAnalysisProxyService.anthropicAlwaysThinking("claude-fable-5-1"));
		assertFalse(AIAnalysisProxyService.anthropicAlwaysThinking("claude-opus-5"));
	}

	@Test
	public void anthropicAdaptiveFamilyStripsSamplingEvenWithoutThinking() {
		// [Q-024] Opus 4.7 起 / Sonnet 5 不接受 temperature/top_p/top_k(与思考开关无关),拨了也剥;adaptive 形态 + effort 原样落地。
		Map<String, Object> params = buildMap("temperature", 0.5, "maxTokens", 2048,
			"providerOptions", buildMap("top_k", 40, "top_p", 0.9));
		Map<String, Object> body = AIAnalysisProxyService.buildAnthropicBody(
			"claude-opus-4-8", params, new java.util.ArrayList<Map<String, Object>>(), false);
		assertFalse(body.containsKey("temperature"));
		assertFalse(body.containsKey("top_p"));
		assertFalse(body.containsKey("top_k"));
		assertFalse(body.containsKey("thinking"));
		Map<String, Object> on = buildMap("temperature", 0.5, "maxTokens", 2048,
			"providerOptions", buildMap("thinking", buildMap("type", "adaptive"), "output_config", buildMap("effort", "high")));
		Map<String, Object> b2 = AIAnalysisProxyService.buildAnthropicBody(
			"claude-sonnet-5", on, new java.util.ArrayList<Map<String, Object>>(), true);
		assertEquals(buildMap("type", "adaptive", "display", "summarized"), b2.get("thinking"));
		assertEquals(buildMap("effort", "high"), b2.get("output_config"));
		assertEquals(Integer.valueOf(2048), b2.get("max_tokens"));
		assertFalse(b2.containsKey("temperature"));
		// Sonnet 5 / Opus 5:disabled 透传
		Map<String, Object> off = buildMap("maxTokens", 1024, "providerOptions", buildMap("thinking", buildMap("type", "disabled")));
		assertEquals(buildMap("type", "disabled"), AIAnalysisProxyService.buildAnthropicBody(
			"claude-opus-5", off, new java.util.ArrayList<Map<String, Object>>(), true).get("thinking"));
	}

	@Test
	public void anthropicThinkingDefaultOnTableAndDisplaySummarized() {
		// [Q-047/M-58] 不带 thinking 字段:Sonnet 5 / Opus 5 缺省开;Opus 4.6–4.8、Sonnet 4.6、Haiku 4.5 缺省关;Fable / Mythos 恒开
		assertTrue(AIAnalysisProxyService.anthropicThinkingDefaultOn("claude-sonnet-5"));
		assertTrue(AIAnalysisProxyService.anthropicThinkingDefaultOn("claude-opus-5"));
		assertTrue(AIAnalysisProxyService.anthropicThinkingDefaultOn("claude-fable-5-1"));
		assertFalse(AIAnalysisProxyService.anthropicThinkingDefaultOn("claude-opus-4-8"));
		assertFalse(AIAnalysisProxyService.anthropicThinkingDefaultOn("claude-sonnet-4-6"));
		assertFalse(AIAnalysisProxyService.anthropicThinkingDefaultOn("claude-haiku-4-5"));
		assertFalse(AIAnalysisProxyService.anthropicThinkingDefaultOn(null));
		// 回放判据随之:缺席字段按型号缺省;显式 disabled 才关
		assertTrue(AIToolCallSupport.anthropicThinkingEnabled(null, "claude-sonnet-5"));
		assertTrue(AIToolCallSupport.anthropicThinkingEnabled(buildMap(), "claude-opus-5"));
		assertFalse(AIToolCallSupport.anthropicThinkingEnabled(null, "claude-opus-4-8"));
		assertFalse(AIToolCallSupport.anthropicThinkingEnabled(null, "claude-haiku-4-5"));
		assertFalse(AIToolCallSupport.anthropicThinkingEnabled(buildMap("thinking", buildMap("type", "disabled")), "claude-sonnet-5"));
		assertTrue(AIToolCallSupport.anthropicThinkingEnabled(buildMap("thinking", buildMap("type", "adaptive")), "claude-opus-4-8"));
		// display:自适应族思考开启且未显式指定 → summarized;显式 omitted 保留;disabled 不加;预算族 enabled 不加
		Map<String, Object> on = buildMap("maxTokens", 2048, "providerOptions", buildMap("thinking", buildMap("type", "adaptive")));
		assertEquals(buildMap("type", "adaptive", "display", "summarized"), AIAnalysisProxyService.buildAnthropicBody(
			"claude-sonnet-5", on, new java.util.ArrayList<Map<String, Object>>(), true).get("thinking"));
		Map<String, Object> keep = buildMap("maxTokens", 2048, "providerOptions", buildMap("thinking", buildMap("type", "adaptive", "display", "omitted")));
		assertEquals(buildMap("type", "adaptive", "display", "omitted"), AIAnalysisProxyService.buildAnthropicBody(
			"claude-sonnet-5", keep, new java.util.ArrayList<Map<String, Object>>(), true).get("thinking"));
		Map<String, Object> off = buildMap("maxTokens", 1024, "providerOptions", buildMap("thinking", buildMap("type", "disabled")));
		assertEquals(buildMap("type", "disabled"), AIAnalysisProxyService.buildAnthropicBody(
			"claude-opus-5", off, new java.util.ArrayList<Map<String, Object>>(), true).get("thinking"));
		Map<String, Object> budget = buildMap("maxTokens", 4096, "providerOptions", buildMap("thinking", buildMap("type", "enabled", "budget_tokens", 2048)));
		Map<String, Object> hb = (Map<String, Object>) AIAnalysisProxyService.buildAnthropicBody(
			"claude-haiku-4-5", budget, new java.util.ArrayList<Map<String, Object>>(), true).get("thinking");
		assertEquals("enabled", hb.get("type"));
		assertFalse(hb.containsKey("display"));
		// 不带字段的 Sonnet 5:请求体不注 thinking(缺省即开),回放判据仍视为开启
		Map<String, Object> none = buildMap("maxTokens", 2048, "providerOptions", buildMap());
		assertFalse(AIAnalysisProxyService.buildAnthropicBody(
			"claude-sonnet-5", none, new java.util.ArrayList<Map<String, Object>>(), true).containsKey("thinking"));
	}

	@Test
	public void anthropicLegacyBudgetThinkingConvertsToAdaptiveOnAdaptiveFamily() {
		// 旧档案 enabled+budget 打到自适应族 → 转 adaptive,预算映射 effort(4096→low / 12000→medium / 30000→high),不再抬 max_tokens。
		Map<String, Object> params = buildMap("maxTokens", 2048,
			"providerOptions", buildMap("thinking", buildMap("type", "enabled", "budget_tokens", 4096)));
		Map<String, Object> body = AIAnalysisProxyService.buildAnthropicBody(
			"claude-opus-4-7", params, new java.util.ArrayList<Map<String, Object>>(), true);
		assertEquals(buildMap("type", "adaptive", "display", "summarized"), body.get("thinking"));
		assertEquals(buildMap("effort", "low"), body.get("output_config"));
		assertEquals(Integer.valueOf(2048), body.get("max_tokens"));
		Map<String, Object> mid = buildMap("maxTokens", 2048,
			"providerOptions", buildMap("thinking", buildMap("type", "enabled", "budget_tokens", 30000)));
		assertEquals(buildMap("effort", "high"), AIAnalysisProxyService.buildAnthropicBody(
			"claude-sonnet-5", mid, new java.util.ArrayList<Map<String, Object>>(), true).get("output_config"));
	}

	@Test
	public void anthropicAlwaysThinkingModelNeverSendsDisabled() {
		// [Q-049] Fable / Mythos 思考不可关:disabled → 不发 thinking、effort=low;显式 effort 优先。
		Map<String, Object> params = buildMap("temperature", 0.7, "maxTokens", 2048,
			"providerOptions", buildMap("thinking", buildMap("type", "disabled")));
		Map<String, Object> body = AIAnalysisProxyService.buildAnthropicBody(
			"claude-fable-5-1", params, new java.util.ArrayList<Map<String, Object>>(), true);
		assertFalse(body.containsKey("thinking"));
		assertEquals(buildMap("effort", "low"), body.get("output_config"));
		assertFalse(body.containsKey("temperature"));
		Map<String, Object> explicit = buildMap("maxTokens", 2048,
			"providerOptions", buildMap("thinking", buildMap("type", "disabled"), "output_config", buildMap("effort", "medium")));
		assertEquals(buildMap("effort", "medium"), AIAnalysisProxyService.buildAnthropicBody(
			"claude-mythos-5-1", explicit, new java.util.ArrayList<Map<String, Object>>(), true).get("output_config"));
	}

	@Test
	public void anthropicBudgetCapClampsAndMaxTokensCorrectedAfterPutAll() {
		// [Q-063] 档案 thinking_budget_cap 夹逼预算、本身绝不下发;extraBody.max_tokens 盖回 ≤ budget 时终点再校正;下限 1024。
		Map<String, Object> params = buildMap("maxTokens", 20000,
			"providerOptions", buildMap("thinking", buildMap("type", "enabled", "budget_tokens", 16000), "thinking_budget_cap", 8000,
				"extraBody", buildMap("max_tokens", 4000)));
		Map<String, Object> body = AIAnalysisProxyService.buildAnthropicBody(
			"claude-sonnet-4-5", params, new java.util.ArrayList<Map<String, Object>>(), true);
		assertEquals(buildMap("type", "enabled", "budget_tokens", 8000), body.get("thinking"));
		assertEquals(Integer.valueOf(8000 + 1024), body.get("max_tokens"));
		assertFalse(body.containsKey("thinking_budget_cap"));
		Map<String, Object> tiny = buildMap("maxTokens", 4096,
			"providerOptions", buildMap("thinking", buildMap("type", "enabled", "budget_tokens", 100)));
		assertEquals(buildMap("type", "enabled", "budget_tokens", 1024), AIAnalysisProxyService.buildAnthropicBody(
			"claude-haiku-4-5", tiny, new java.util.ArrayList<Map<String, Object>>(), true).get("thinking"));
		// 预算族收到 adaptive(错配档案)→ 降级 enabled+budget(上限优先),effort 丢弃
		Map<String, Object> mis = buildMap("maxTokens", 2048,
			"providerOptions", buildMap("thinking", buildMap("type", "adaptive"), "output_config", buildMap("effort", "high"), "thinking_budget_cap", 6000));
		Map<String, Object> mb = AIAnalysisProxyService.buildAnthropicBody(
			"claude-haiku-4-5", mis, new java.util.ArrayList<Map<String, Object>>(), true);
		assertEquals(buildMap("type", "enabled", "budget_tokens", 6000), mb.get("thinking"));
		assertFalse(mb.containsKey("output_config"));
		assertEquals(Integer.valueOf(6000 + 1024), mb.get("max_tokens"));
	}

	@Test
	public void anthropicHaiku45TemperatureAndTopPExclusive() {
		// [Q-050] Haiku 4.5 二选一:同发只留温度;只拨 top_p(未拨温度)则尊重 top_p、不补缺省温度。其它预算族两者可同发。
		Map<String, Object> both = buildMap("temperature", 0.6, "maxTokens", 1024, "providerOptions", buildMap("top_p", 0.9));
		Map<String, Object> b = AIAnalysisProxyService.buildAnthropicBody("claude-haiku-4-5-20251001", both, new java.util.ArrayList<Map<String, Object>>(), false);
		assertEquals(0.6d, b.get("temperature"));
		assertFalse(b.containsKey("top_p"));
		Map<String, Object> onlyTopP = buildMap("maxTokens", 1024, "providerOptions", buildMap("top_p", 0.9));
		Map<String, Object> o = AIAnalysisProxyService.buildAnthropicBody("claude-haiku-4-5", onlyTopP, new java.util.ArrayList<Map<String, Object>>(), false);
		assertFalse(o.containsKey("temperature"));
		assertEquals(0.9, o.get("top_p"));
		Map<String, Object> s = AIAnalysisProxyService.buildAnthropicBody("claude-sonnet-4-5", both, new java.util.ArrayList<Map<String, Object>>(), false);
		assertEquals(0.6d, s.get("temperature"));
		assertEquals(0.9, s.get("top_p"));
	}

	@Test
	public void geminiTemperatureFromProviderOptionsAndCamelCaseKeys() {
		// [Q-025] providerOptions.temperature 优先(此前静默丢弃);[Q-031] topP/topK/maxOutputTokens camelCase 进 generationConfig 而非顶层。
		Map<String, Object> params = buildMap("temperature", 0.7, "maxTokens", 1000,
			"providerOptions", buildMap("temperature", 0.2, "topP", 0.8, "topK", 20, "maxOutputTokens", 3000));
		Map<String, Object> body = AIAnalysisProxyService.buildGeminiBody(params, new java.util.ArrayList<Map<String, Object>>());
		Map gen = (Map) body.get("generationConfig");
		assertEquals(0.2d, gen.get("temperature"));
		assertEquals(0.8, gen.get("topP"));
		assertEquals(20, gen.get("topK"));
		assertEquals(Integer.valueOf(3000), gen.get("maxOutputTokens"));
		assertFalse(body.containsKey("topP"));
		assertFalse(body.containsKey("topK"));
		assertFalse(body.containsKey("maxOutputTokens"));
		assertFalse(body.containsKey("temperature"));
		// snake_case 仍优先于 camelCase;无档案温度时用顶层 params 温度;max_tokens(OpenAI 形)也认
		Map<String, Object> p2 = buildMap("temperature", 0.4, "maxTokens", 1000, "providerOptions", buildMap("top_p", 0.5, "topP", 0.9, "max_tokens", 2222));
		Map g2 = (Map) AIAnalysisProxyService.buildGeminiBody(p2, new java.util.ArrayList<Map<String, Object>>()).get("generationConfig");
		assertEquals(0.4d, g2.get("temperature"));
		assertEquals(0.5, g2.get("topP"));
		assertEquals(Integer.valueOf(2222), g2.get("maxOutputTokens"));
	}

	@Test
	public void kimiK2ModelsStripSamplingParams() {
		// Kimi k2 系仅允许 temperature=1(其它值 400),按推理模型口径不发采样参数(LIVE 实测钉死)。
		assertTrue(AIAnalysisProxyService.isReasoningModel("kimi-k2.6"));
		assertTrue(AIAnalysisProxyService.isReasoningModel("kimi-k2.5"));
		assertTrue(AIAnalysisProxyService.isReasoningModel("kimi-k2.7-code"));
		assertFalse(AIAnalysisProxyService.isReasoningModel("moonshot-v1-8k"));
		List<Map<String, Object>> messages = new java.util.ArrayList<Map<String, Object>>();
		Map<String, Object> body = AIAnalysisProxyService.buildOpenAIChatBody(
			"kimi-k2.6", buildMap("temperature", 0.7), messages, false);
		assertFalse(body.containsKey("temperature"));
	}

	@Test
	public void kimiKSeriesCoversFutureGenerations() {
		// Windows #47:k3 实报「invalid temperature: only 1 is allowed」——判定须认「kimi-k+数字」整个代际,
		// 勿再写死 k2 单代。openrouter 前缀写法(moonshotai/kimi-k3)经去前缀后同样命中。
		assertTrue(AIAnalysisProxyService.isReasoningModel("kimi-k3"));
		assertTrue(AIAnalysisProxyService.isReasoningModel("kimi-k3.1-turbo"));
		assertTrue(AIAnalysisProxyService.isReasoningModel("kimi-k4-code"));
		assertTrue(AIAnalysisProxyService.isReasoningModel("moonshotai/kimi-k3"));
		// 非 k+数字 代号不受影响:moonshot-v1/kimi-latest 照常接受采样参数。
		assertFalse(AIAnalysisProxyService.isReasoningModel("kimi-latest"));
		assertFalse(AIAnalysisProxyService.isReasoningModel("moonshot-v1-32k"));
		List<Map<String, Object>> messages = new java.util.ArrayList<Map<String, Object>>();
		Map<String, Object> body = AIAnalysisProxyService.buildOpenAIChatBody(
			"kimi-k3", buildMap("temperature", 0.7), messages, false);
		assertFalse(body.containsKey("temperature"));
		assertTrue(body.containsKey("model"));
	}

	@Test
	public void healUpstreamRequestBodyStripsNamedSamplingParam() {
		// #47 原始错误体逐字回放:400 点名 temperature → 剥参重发(其余键原样保留)。
		String kimiError = "{\"error\":{\"message\":\"invalid temperature: only 1 is allowed for this model\",\"type\":\"invalid_request_error\"}}";
		String healed = AIAnalysisProxyService.healUpstreamRequestBody(400, kimiError,
			"{\"model\":\"kimi-k3\",\"temperature\":0.7,\"stream\":true,\"max_tokens\":2048}");
		assertTrue(healed != null);
		assertFalse(healed.contains("temperature"));
		assertTrue(healed.contains("\"model\""));
		assertTrue(healed.contains("max_tokens"));
		// 只剥被点名的参数:错误文只提 top_p 时 temperature 原样保留。
		String healedTopP = AIAnalysisProxyService.healUpstreamRequestBody(400,
			"{\"error\":{\"message\":\"top_p is not supported\"}}",
			"{\"model\":\"m\",\"temperature\":0.7,\"top_p\":0.9}");
		assertTrue(healedTopP != null);
		assertTrue(healedTopP.contains("temperature"));
		assertFalse(healedTopP.contains("top_p"));
	}

	@Test
	public void healUpstreamRequestBodyHandlesRenameAndNestedContainers() {
		// OpenAI 新推理系:点名 max_completion_tokens → 改键不丢值。
		String renamed = AIAnalysisProxyService.healUpstreamRequestBody(400,
			"{\"error\":{\"message\":\"Use 'max_completion_tokens' instead of 'max_tokens'\"}}",
			"{\"model\":\"m\",\"max_tokens\":4096}");
		assertTrue(renamed != null);
		assertTrue(renamed.contains("max_completion_tokens"));
		// Ollama 原生 options / Gemini generationConfig 内嵌参数同样可剥。
		String nestedOllama = AIAnalysisProxyService.healUpstreamRequestBody(400,
			"{\"error\":\"temperature not supported\"}",
			"{\"model\":\"m\",\"options\":{\"temperature\":0.7,\"num_ctx\":8192}}");
		assertTrue(nestedOllama != null);
		assertFalse(nestedOllama.contains("temperature"));
		assertTrue(nestedOllama.contains("num_ctx"));
		String nestedGemini = AIAnalysisProxyService.healUpstreamRequestBody(400,
			"{\"error\":{\"message\":\"Invalid JSON payload received. Unknown name \\\"temperature\\\"\"}}",
			"{\"contents\":[],\"generationConfig\":{\"temperature\":0.7,\"maxOutputTokens\":1024}}");
		assertTrue(nestedGemini != null);
		assertFalse(nestedGemini.contains("temperature"));
	}

	@Test
	public void nonStreamRetriesOn429ThenSucceedsAndStopsAfterMax() throws Exception {
		// [C8d] 非流式路径:429(带 Retry-After)→ 首字节前退避重试 → 第二次 2xx 成功;持续 429 → 1+maxRetries 次后放弃并带上游真因。
		com.sun.net.httpserver.HttpServer server = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
		final java.util.concurrent.atomic.AtomicInteger once = new java.util.concurrent.atomic.AtomicInteger();
		final java.util.concurrent.atomic.AtomicInteger always = new java.util.concurrent.atomic.AtomicInteger();
		final byte[] limited = "{\"error\":{\"message\":\"rate limited\",\"type\":\"rate_limit_error\"}}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
		final byte[] okBody = "{\"ok\":true}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
		server.createContext("/once", ex -> {
			int n = once.incrementAndGet();
			byte[] body = n == 1 ? limited : okBody;
			if(n == 1) { ex.getResponseHeaders().add("Retry-After", "1"); }
			ex.sendResponseHeaders(n == 1 ? 429 : 200, body.length);
			ex.getResponseBody().write(body); ex.close();
		});
		server.createContext("/always", ex -> {
			always.incrementAndGet();
			ex.getResponseHeaders().add("Retry-After", "1");
			ex.sendResponseHeaders(429, limited.length);
			ex.getResponseBody().write(limited); ex.close();
		});
		server.start();
		try {
			AIAnalysisProxyService svc = new AIAnalysisProxyService();
			java.lang.reflect.Method m = AIAnalysisProxyService.class.getDeclaredMethod("sendUpstreamForText", String.class, String.class, Map.class, String.class, Map.class);
			m.setAccessible(true);
			Map<String, Object> opts = new HashMap<>(); opts.put("maxRetries", 2);
			Map<String, Object> params = new HashMap<>(); params.put("providerOptions", opts);
			Map<String, String> headers = new HashMap<>(); headers.put("Content-Type", "application/json");
			String base = "http://127.0.0.1:" + server.getAddress().getPort();
			String out = (String) m.invoke(svc, "POST", base + "/once", headers, "{}", params);
			assertTrue(out, out.contains("\"ok\":true"));
			assertEquals(2, once.get());
			String msg = "";
			try {
				m.invoke(svc, "POST", base + "/always", headers, "{}", params);
			} catch(java.lang.reflect.InvocationTargetException e) {
				msg = e.getCause() == null ? String.valueOf(e) : String.valueOf(e.getCause().getMessage());
			}
			assertTrue(msg, msg.contains("429") || msg.contains("rate limited"));
			assertEquals(3, always.get());   // 1 + maxRetries=2,不多不少
		} finally {
			server.stop(0);
		}
	}

	@Test
	public void healUpstreamRequestBodyRefusesUnrelatedFailures() {
		// 非 400/422(如 401/429/5xx)绝不自愈;400 但错误文未点名任何可剥参数也不自愈。
		assertEquals(null, AIAnalysisProxyService.healUpstreamRequestBody(401,
			"{\"error\":{\"message\":\"Invalid Authentication temperature\"}}",
			"{\"model\":\"m\",\"temperature\":0.7}"));
		assertEquals(null, AIAnalysisProxyService.healUpstreamRequestBody(400,
			"{\"error\":{\"message\":\"model not found\"}}",
			"{\"model\":\"m\",\"temperature\":0.7}"));
		// 点名了参数但请求体本就没带 → 无可剥,不空转重试。
		assertEquals(null, AIAnalysisProxyService.healUpstreamRequestBody(400,
			"{\"error\":{\"message\":\"invalid temperature\"}}",
			"{\"model\":\"m\",\"stream\":true}"));
		// 非法请求体 JSON → 不自愈。
		assertEquals(null, AIAnalysisProxyService.healUpstreamRequestBody(400,
			"{\"error\":{\"message\":\"invalid temperature\"}}", "not-json"));
	}

	@Test
	public void extractUpstreamErrorMessageSupportsCommonShapes() {
		// OpenAI 兼容(含 Kimi/Moonshot): {"error":{"message":...}}
		assertEquals("Invalid Authentication",
			AIAnalysisProxyService.extractUpstreamErrorMessage(
				"{\"error\":{\"message\":\"Invalid Authentication\",\"type\":\"invalid_authentication_error\"}}"));
		// error 直接是字符串
		assertEquals("url.not_found",
			AIAnalysisProxyService.extractUpstreamErrorMessage("{\"code\":5,\"error\":\"url.not_found\"}"));
		// 顶层 message
		assertEquals("model not found",
			AIAnalysisProxyService.extractUpstreamErrorMessage("{\"message\":\"model not found\"}"));
		// 非 JSON → 空串(调用方带原始截断)
		assertEquals("", AIAnalysisProxyService.extractUpstreamErrorMessage("<html>Bad Gateway</html>"));
		assertEquals("", AIAnalysisProxyService.extractUpstreamErrorMessage(""));
	}

	@Test
	public void formatUpstreamHttpErrorPutsFriendlyMessageFirst() {
		// 人话必须在最前(前端 message 只显示前 200 字符)。
		String msg = AIAnalysisProxyService.formatUpstreamHttpError(400,
			"{\"error\":{\"message\":\"Invalid model: kimi-k2-turbo-preview\"}}");
		assertTrue(msg.startsWith("上游服务返回 HTTP 400：Invalid model: kimi-k2-turbo-preview"));
		// 非 JSON 体:仍可读,带原始截断
		String raw = AIAnalysisProxyService.formatUpstreamHttpError(502, "Bad Gateway");
		assertTrue(raw.startsWith("上游服务返回 HTTP 502"));
		assertTrue(raw.contains("Bad Gateway"));
	}

	// ── [C3] 结构化输出四家翻译:前端只产 OpenAI 形 json_schema;各家 body 构造器各取所需,缺省(无 response_format)路径逐键不变 ──
	private static Map<String, Object> jsonSchemaFormat(){
		Map<String, Object> schema = buildMap("type", "object",
			"properties", buildMap("status", buildMap("type", "string", "enum", Arrays.asList("done", "continue"))),
			"required", Arrays.asList("status"), "additionalProperties", Boolean.FALSE);
		return buildMap("type", "json_schema", "json_schema", buildMap("name", "goal judge", "schema", schema, "strict", Boolean.TRUE));
	}

	@Test
	public void responseFormatSpecNormalizesShapes() {
		Map<String, Object> spec = AIAnalysisProxyService.responseFormatSpec(jsonSchemaFormat());
		assertEquals("json_schema", spec.get("type"));
		assertEquals("goal judge", spec.get("name"));
		assertTrue(spec.get("schema") instanceof Map);
		assertEquals(Boolean.TRUE, spec.get("strict"));
		assertEquals("json_object", AIAnalysisProxyService.responseFormatSpec(buildMap("type", "JSON_OBJECT")).get("type"));
		assertTrue(AIAnalysisProxyService.responseFormatSpec("nope") == null);
		assertTrue(AIAnalysisProxyService.responseFormatSpec(buildMap("x", 1)) == null);
		assertEquals("goal_judge", AIAnalysisProxyService.anthropicToolName("goal judge"));
		assertEquals("horosa_output", AIAnalysisProxyService.anthropicToolName("   "));
	}

	@Test
	public void buildOpenAIChatBodyPassesJsonSchemaThrough() {
		Map<String, Object> params = buildMap("temperature", 0.2, "providerOptions", buildMap("response_format", jsonSchemaFormat()));
		Map<String, Object> body = AIAnalysisProxyService.buildOpenAIChatBody("gpt-4o-mini", params, new java.util.ArrayList<Map<String, Object>>(), false);
		assertTrue(body.get("response_format") instanceof Map);
		assertEquals("json_schema", ((Map) body.get("response_format")).get("type"));
	}

	@Test
	public void buildAnthropicBodyNonStreamJsonSchemaBecomesForcedTool() {
		Map<String, Object> params = buildMap("temperature", 0.2, "maxTokens", 512, "providerOptions", buildMap("response_format", jsonSchemaFormat()));
		Map<String, Object> body = AIAnalysisProxyService.buildAnthropicBody("claude-x", params, new java.util.ArrayList<Map<String, Object>>(), false);
		assertFalse("Anthropic 无 response_format 字段", body.containsKey("response_format"));
		List tools = (List) body.get("tools");
		assertEquals(1, tools.size());
		Map tool = (Map) tools.get(0);
		assertEquals("goal_judge", tool.get("name"));
		assertTrue(tool.get("input_schema") instanceof Map);
		assertEquals(buildMap("type", "tool", "name", "goal_judge"), body.get("tool_choice"));
		// 流式:不翻(丢弃,旧行为)
		Map<String, Object> streamBody = AIAnalysisProxyService.buildAnthropicBody("claude-x", params, new java.util.ArrayList<Map<String, Object>>(), true);
		assertFalse(streamBody.containsKey("tools"));
		assertFalse(streamBody.containsKey("response_format"));
		// json_object:不翻
		Map<String, Object> jo = buildMap("temperature", 0.2, "maxTokens", 512, "providerOptions", buildMap("response_format", buildMap("type", "json_object")));
		assertFalse(AIAnalysisProxyService.buildAnthropicBody("claude-x", jo, new java.util.ArrayList<Map<String, Object>>(), false).containsKey("tools"));
		// 已带真实工具:不加强制工具(真实工具原样)
		Map<String, Object> withTools = buildMap("temperature", 0.2, "maxTokens", 512, "providerOptions", buildMap("response_format", jsonSchemaFormat()),
			"tools", Arrays.asList(buildMap("name", "list_records", "description", "d", "inputSchema", buildMap("type", "object", "properties", buildMap()))));
		Map<String, Object> tb = AIAnalysisProxyService.buildAnthropicBody("claude-x", withTools, new java.util.ArrayList<Map<String, Object>>(), false);
		assertEquals(1, ((List) tb.get("tools")).size());
		assertEquals("list_records", ((Map) ((List) tb.get("tools")).get(0)).get("name"));
		assertFalse(buildMap("type", "tool", "name", "goal_judge").equals(tb.get("tool_choice")));
	}

	@Test
	public void extractAnthropicContentReturnsForcedToolInputAsJson() {
		Map<String, Object> payload = buildMap("stop_reason", "tool_use", "content", Arrays.asList(buildMap("type", "tool_use", "name", "goal_judge", "input", buildMap("status", "done", "reason", "ok"))));
		String content = AIAnalysisProxyService.extractAnthropicContent(payload);
		assertTrue(content.contains("\"status\""));
		assertTrue(content.contains("done"));
		// 有正文文本时以文本为准(旧行为)
		Map<String, Object> mixed = buildMap("content", Arrays.asList(buildMap("type", "text", "text", "hello"), buildMap("type", "tool_use", "name", "x", "input", buildMap("a", 1))));
		assertEquals("hello", AIAnalysisProxyService.extractAnthropicContent(mixed));
	}

	@Test
	public void buildGeminiBodyJsonSchemaSetsResponseSchema() {
		Map<String, Object> params = buildMap("temperature", 0.2, "providerOptions", buildMap("response_format", jsonSchemaFormat()));
		Map<String, Object> body = AIAnalysisProxyService.buildGeminiBody(params, new java.util.ArrayList<Map<String, Object>>());
		Map gen = (Map) body.get("generationConfig");
		assertEquals("application/json", gen.get("responseMimeType"));
		Map schema = (Map) gen.get("responseSchema");
		assertEquals("OBJECT", schema.get("type"));   // [D69] responseSchema 同为 Gemini Schema 枚举:官方大写
		assertFalse("Gemini 不认 additionalProperties", schema.containsKey("additionalProperties"));
		assertTrue(((Map) schema.get("properties")).containsKey("status"));
		// json_object:只有 mime(旧行为)
		Map<String, Object> jo = buildMap("temperature", 0.2, "providerOptions", buildMap("response_format", buildMap("type", "json_object")));
		Map genJo = (Map) AIAnalysisProxyService.buildGeminiBody(jo, new java.util.ArrayList<Map<String, Object>>()).get("generationConfig");
		assertEquals("application/json", genJo.get("responseMimeType"));
		assertFalse(genJo.containsKey("responseSchema"));
	}

	@Test
	public void applyOllamaResponseFormatOnlyTranslatesJsonSchema() {
		Map<String, Object> body = new LinkedHashMap<String, Object>();
		AIAnalysisProxyService.applyOllamaResponseFormat(body, jsonSchemaFormat());
		assertTrue(body.get("format") instanceof Map);
		assertEquals("object", ((Map) body.get("format")).get("type"));
		Map<String, Object> body2 = new LinkedHashMap<String, Object>();
		AIAnalysisProxyService.applyOllamaResponseFormat(body2, buildMap("type", "json_object"));
		assertFalse("json_object 仍按旧行为丢弃", body2.containsKey("format"));
		AIAnalysisProxyService.applyOllamaResponseFormat(body2, null);
		assertTrue(body2.isEmpty());
	}

	@Test
	public void healUpstreamRequestBodyDegradesResponseFormatTwoLevels() {
		// 第一级:json_schema 被点名 → json_object
		String l1 = AIAnalysisProxyService.healUpstreamRequestBody(400,
			"{\"error\":{\"message\":\"Invalid parameter: 'response_format' of type 'json_schema' is not supported\"}}",
			"{\"model\":\"m\",\"response_format\":{\"type\":\"json_schema\",\"json_schema\":{\"name\":\"x\",\"schema\":{\"type\":\"object\"}}},\"max_tokens\":10}");
		assertTrue(l1 != null);
		assertTrue(l1.contains("json_object"));
		assertFalse(l1.contains("json_schema"));
		assertTrue(l1.contains("max_tokens"));
		// 第二级:json_object 再被点名 → 删键
		String l2 = AIAnalysisProxyService.healUpstreamRequestBody(400,
			"{\"error\":{\"message\":\"response_format is not supported\"}}", l1);
		assertTrue(l2 != null);
		assertFalse(l2.contains("response_format"));
		// 未点名:不动
		assertTrue(AIAnalysisProxyService.healUpstreamRequestBody(400, "{\"error\":{\"message\":\"something else\"}}",
			"{\"model\":\"m\",\"response_format\":{\"type\":\"json_object\"}}") == null);
		// Gemini responseSchema 被点名 → 去 schema 留 mime;Ollama format 对象 → "json"
		String g = AIAnalysisProxyService.healUpstreamRequestBody(400,
			"{\"error\":{\"message\":\"Invalid JSON payload received. Unknown name \\\"responseSchema\\\"\"}}",
			"{\"model\":\"m\",\"generationConfig\":{\"responseMimeType\":\"application/json\",\"responseSchema\":{\"type\":\"object\"}}}");
		assertTrue(g != null);
		assertFalse(g.contains("responseSchema"));
		assertTrue(g.contains("responseMimeType"));
		String o = AIAnalysisProxyService.healUpstreamRequestBody(400,
			"{\"error\":\"json_schema format not supported\"}",
			"{\"model\":\"m\",\"format\":{\"type\":\"object\"}}");
		assertTrue(o != null);
		assertTrue(o.contains("\"format\":\"json\""));
	}

	// [L1·阶段 2] 结构化输出降级的**顺序**与**收敛**:两级各占一轮自愈,第 3 轮无可降 → null(不再重发,MAX_PARAM_HEALS=2 才有意义)。
	@Test
	public void healUpstreamRequestBodyDegradesInStrictOrderAndThenStops() {
		String named = "{\"error\":{\"message\":\"Invalid parameter: 'response_format' of type 'json_schema' is not supported\"}}";
		String req = "{\"model\":\"m\",\"messages\":[],\"response_format\":{\"type\":\"json_schema\",\"json_schema\":{\"name\":\"goal judge\",\"schema\":{\"type\":\"object\"},\"strict\":true}},\"max_tokens\":10}";
		// 第 1 轮:只降档,绝不直接删键(删早了就白丢一次「上游其实认 json_object」的机会)
		String l1 = AIAnalysisProxyService.healUpstreamRequestBody(400, named, req);
		assertTrue(l1 != null);
		Map r1 = boundless.utility.JsonUtility.toDictionary(l1);
		assertEquals("json_object", ((Map) r1.get("response_format")).get("type"));
		assertFalse("第 1 轮不得删键", !r1.containsKey("response_format"));
		assertEquals("与结构化输出无关的键一律不动", 10, ((Number) r1.get("max_tokens")).intValue());
		// 第 2 轮:同一条错再点名 → 才删键
		String l2 = AIAnalysisProxyService.healUpstreamRequestBody(400, named, l1);
		assertTrue(l2 != null);
		Map r2 = boundless.utility.JsonUtility.toDictionary(l2);
		assertFalse("第 2 轮删键", r2.containsKey("response_format"));
		assertTrue(r2.containsKey("max_tokens"));
		// 第 3 轮:无可降 → null(自愈外环据此停手,不做第三次重发)
		assertEquals(null, AIAnalysisProxyService.healUpstreamRequestBody(400, named, l2));
		assertEquals(2, AIAnalysisProxyService.MAX_PARAM_HEALS);
		// gemini:去 responseSchema 留 mime,再点名也无可降
		String g1 = AIAnalysisProxyService.healUpstreamRequestBody(400,
			"{\"error\":{\"message\":\"Unknown name \\\"responseSchema\\\"\"}}",
			"{\"generationConfig\":{\"responseMimeType\":\"application/json\",\"responseSchema\":{\"type\":\"object\"}}}");
		assertTrue(g1 != null);
		assertTrue(g1.contains("responseMimeType"));
		assertFalse(g1.contains("responseSchema"));
		assertEquals(null, AIAnalysisProxyService.healUpstreamRequestBody(400, "{\"error\":{\"message\":\"responseSchema unsupported\"}}", g1));
		// ollama:format 对象 → "json",再点名也无可降(不再退成删键)
		String o1 = AIAnalysisProxyService.healUpstreamRequestBody(400,
			"{\"error\":\"json_schema format not supported\"}", "{\"model\":\"m\",\"format\":{\"type\":\"object\"}}");
		assertTrue(o1 != null);
		assertTrue(o1.contains("\"format\":\"json\""));
		assertEquals(null, AIAnalysisProxyService.healUpstreamRequestBody(400, "{\"error\":\"json_schema format not supported\"}", o1));
	}

	// [L1·阶段 2] Anthropic 强制 schema 工具的产出条件:非流式 ∧ json_schema ∧ 没有真实工具;
	// 其余一律 null(= 旧行为「丢弃 response_format」),尤其流式绝不塞工具——流里回 tool_use 拿不到正文。
	@Test
	public void anthropicForcedSchemaToolOnlyForNonStreamWithoutRealTools() {
		Object rf = jsonSchemaFormat();
		Map<String, Object> tool = AIAnalysisProxyService.anthropicForcedSchemaTool(rf, false, null);
		assertTrue(tool != null);
		assertEquals("goal_judge", tool.get("name"));
		assertTrue(tool.get("input_schema") instanceof Map);
		assertEquals(null, AIAnalysisProxyService.anthropicForcedSchemaTool(rf, true, null));
		List<Map<String, Object>> realTools = Arrays.asList(buildMap("name", "list_records", "description", "d", "inputSchema", buildMap("type", "object", "properties", buildMap())));
		assertEquals(null, AIAnalysisProxyService.anthropicForcedSchemaTool(rf, false, realTools));
		assertEquals(null, AIAnalysisProxyService.anthropicForcedSchemaTool(buildMap("type", "json_object"), false, null));
		assertEquals(null, AIAnalysisProxyService.anthropicForcedSchemaTool(null, false, null));
		// json_schema 但没带 schema 体 → 无从强制,回 null
		assertEquals(null, AIAnalysisProxyService.anthropicForcedSchemaTool(buildMap("type", "json_schema", "json_schema", buildMap("name", "x")), false, null));
	}

	private static Map<String, Object> buildMap(Object... args){
		Map<String, Object> map = new LinkedHashMap<String, Object>();
		for(int i=0; i<args.length; i += 2) {
			map.put(String.valueOf(args[i]), args[i + 1]);
		}
		return map;
	}

	// [C1] 非流式 usage 提取:三家 payload 形状各取其位,键统一 input/output_tokens。
	@Test
	public void extractNonStreamUsageCoversProviderShapes() {
		Map<String, Object> openai = buildMap("usage", buildMap("prompt_tokens", 120, "completion_tokens", 45, "total_tokens", 165));
		Map<String, Object> u1 = AIAnalysisProxyService.extractNonStreamUsage("deepseek", openai);
		assertEquals(120L, u1.get("input_tokens"));
		assertEquals(45L, u1.get("output_tokens"));

		// [A1b] DeepSeek 顶层 prompt_cache_hit_tokens → cache_read_input_tokens;标准 prompt_tokens_details.cached_tokens 在场时以它为准
		Map<String, Object> deepseek = AIAnalysisProxyService.extractOpenAIUsage(buildMap("usage", buildMap("prompt_tokens", 120, "completion_tokens", 9, "prompt_cache_hit_tokens", 96, "prompt_cache_miss_tokens", 24)));
		assertEquals(96L, deepseek.get("cache_read_input_tokens"));
		Map<String, Object> both = AIAnalysisProxyService.extractOpenAIUsage(buildMap("usage", buildMap("prompt_tokens", 120, "prompt_cache_hit_tokens", 96, "prompt_tokens_details", buildMap("cached_tokens", 64))));
		assertEquals(64L, both.get("cache_read_input_tokens"));
		Map<String, Object> zero = AIAnalysisProxyService.extractOpenAIUsage(buildMap("usage", buildMap("prompt_tokens", 120, "prompt_cache_hit_tokens", 0)));
		assertEquals(null, zero.get("cache_read_input_tokens"));
		Map<String, Object> anthropic = buildMap("usage", buildMap("input_tokens", 300, "output_tokens", 88, "cache_read_input_tokens", 250));
		Map<String, Object> u2 = AIAnalysisProxyService.extractNonStreamUsage("anthropic", anthropic);
		assertEquals(300L, u2.get("input_tokens"));
		assertEquals(88L, u2.get("output_tokens"));
		assertEquals(250L, u2.get("cache_read_input_tokens"));

		Map<String, Object> gemini = buildMap("usageMetadata", buildMap("promptTokenCount", 77, "candidatesTokenCount", 33, "totalTokenCount", 110));
		Map<String, Object> u3 = AIAnalysisProxyService.extractNonStreamUsage("gemini", gemini);
		assertEquals(77L, u3.get("input_tokens"));
		assertEquals(33L, u3.get("output_tokens"));

		// 无 usage 字段 → null(前端缺省不显,零回归)
		assertTrue(AIAnalysisProxyService.extractNonStreamUsage("deepseek", buildMap("choices", "x")) == null);
	}

	/** [A1 止损] 可观测上游流:记录 close 与消费情况。 */
	private static final class TrackingInputStream extends java.io.ByteArrayInputStream {
		volatile boolean closed = false;

		TrackingInputStream(String text) {
			super(text.getBytes(java.nio.charset.StandardCharsets.UTF_8));
		}

		@Override
		public void close() throws java.io.IOException {
			closed = true;
			super.close();
		}
	}

	// [A1 止损] 通道预关(模拟心跳先判死/用户已停止)→ 首个事件 sendEvent 即抛
	// ClientGoneException 打断读流环;try-with-resources 必须把上游流关掉(计费即止);
	// 后续事件绝不再被消费(旧缺陷:整段吸完照常计费)。
	@Test
	public void clientGoneStopsUpstreamReadAndClosesStream() {
		AIAnalysisProxyService service = new AIAnalysisProxyService();
		AIAnalysisProxyService.SseChannel channel = new AIAnalysisProxyService.SseChannel(
			new org.springframework.web.servlet.mvc.method.annotation.SseEmitter());
		channel.complete();   // closed=true
		TrackingInputStream stream = new TrackingInputStream(
			"data: {\"a\":1}\n\n" +
			"data: {\"a\":2}\n\n" +
			"data: {\"a\":3}\n\n");
		final java.util.concurrent.atomic.AtomicInteger handled = new java.util.concurrent.atomic.AtomicInteger();
		boolean clientGone = false;
		try {
			service.readSseStream(stream, (eventName, dataText) -> {
				handled.incrementAndGet();
				service.sendEvent(channel, "delta", buildMap("delta", dataText));
			});
		} catch (AIAnalysisProxyService.ClientGoneException expected) {
			clientGone = true;
		} catch (Exception other) {
			throw new AssertionError("expected ClientGoneException, got " + other, other);
		}
		assertTrue("must raise ClientGoneException", clientGone);
		assertEquals("读流环必须在首个事件即断,不吸完上游", 1, handled.get());
		assertTrue("上游流必须已关闭(止损计费的根据)", stream.closed);
	}

	// [A1] 正常流不受影响:通道未关时全部事件照常消费与下发,流末正常关闭、零异常。
	@Test
	public void normalStreamDeliversAllEventsUnaffected() throws Exception {
		AIAnalysisProxyService service = new AIAnalysisProxyService();
		AIAnalysisProxyService.SseChannel channel = new AIAnalysisProxyService.SseChannel(
			new org.springframework.web.servlet.mvc.method.annotation.SseEmitter());
		TrackingInputStream stream = new TrackingInputStream(
			"data: {\"a\":1}\n\n" +
			"data: {\"a\":2}\n\n");
		final java.util.List<String> got = new java.util.ArrayList<String>();
		service.readSseStream(stream, (eventName, dataText) -> {
			got.add(dataText);
			service.sendEvent(channel, "delta", buildMap("delta", dataText));
		});
		assertEquals(2, got.size());
		assertTrue(stream.closed);
	}

	// [D67b] 流中错误帧四线形态:OpenAI/Gemini {"error":{message}} · Ollama {"error":"…"} · Anthropic event:error / type:error
	//   → 一律打成 "error" 事件(midStream:true)并返回 true(中继据此跳过 delta/usage 抽取);普通帧返回 false 零事件。
	@Test
	public void midStreamUpstreamErrorFramesAreForwardedAsErrorEvents() {
		final java.util.List<String> captured = new java.util.ArrayList<String>();
		AIAnalysisProxyService svc = new AIAnalysisProxyService() {
			@Override
			void sendEvent(SseChannel channel, String eventName, Map<String, Object> payload) {
				captured.add(eventName + ":" + payload.get("message") + ":" + payload.get("midStream"));
			}
		};
		AIAnalysisProxyService.SseChannel channel = new AIAnalysisProxyService.SseChannel(
			new org.springframework.web.servlet.mvc.method.annotation.SseEmitter());
		assertTrue(svc.emitMidStreamUpstreamError(channel, null, buildMap("error", buildMap("message", "upstream exploded", "code", 500))));
		assertTrue(svc.emitMidStreamUpstreamError(channel, null, buildMap("error", "plain string error")));
		assertTrue(svc.emitMidStreamUpstreamError(channel, "error", buildMap("type", "error", "error", buildMap("type", "overloaded_error", "message", "Overloaded"))));
		assertTrue(svc.emitMidStreamUpstreamError(channel, null, buildMap("type", "error")));
		assertFalse(svc.emitMidStreamUpstreamError(channel, null, buildMap("choices", java.util.Arrays.asList(buildMap("delta", buildMap("content", "正文"))))));
		assertFalse(svc.emitMidStreamUpstreamError(channel, "content_block_delta", buildMap("type", "content_block_delta")));
		assertFalse(svc.emitMidStreamUpstreamError(channel, null, null));
		assertEquals(4, captured.size());
		assertEquals("error:upstream exploded:true", captured.get(0));
		assertEquals("error:plain string error:true", captured.get(1));
		assertEquals("error:Overloaded:true", captured.get(2));
		assertEquals("error:上游流中途返回错误:true", captured.get(3));
	}

	// [D60] Retry-After 两形态:整数秒(≤60 采纳)/ RFC 1123 日期(换算 ≤60 s 采纳);非法/过去/超上限 → 0(走退避)
	@Test
	public void retryAfterHeaderParsesSecondsAndHttpDate() {
		long now = 1_800_000_000_000L;
		assertEquals(5000L, AIAnalysisProxyService.retryAfterMs("5", now));
		assertEquals(0L, AIAnalysisProxyService.retryAfterMs("0", now));
		assertEquals(0L, AIAnalysisProxyService.retryAfterMs("120", now));
		String date = java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME.format(java.time.Instant.ofEpochMilli(now + 10_000L).atZone(java.time.ZoneOffset.UTC));
		long ms = AIAnalysisProxyService.retryAfterMs(date, now);
		assertTrue("date form ≈10s, got " + ms, ms >= 9000L && ms <= 10000L);
		String past = java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME.format(java.time.Instant.ofEpochMilli(now - 10_000L).atZone(java.time.ZoneOffset.UTC));
		assertEquals(0L, AIAnalysisProxyService.retryAfterMs(past, now));
		assertEquals(0L, AIAnalysisProxyService.retryAfterMs("soon", now));
		assertEquals(0L, AIAnalysisProxyService.retryAfterMs(null, now));
	}

	// [D60] 流池饱和即拒:2 核心 + 8 上限 + 16 队列 = 第 25 路 execute 抛 RejectedExecutionException(不在调用线程同步跑)
	@Test
	public void streamWorkerPoolRejectsWhenSaturated() throws Exception {
		java.util.concurrent.Executor pool = AIAnalysisProxyService.streamWorkerPool();
		java.util.concurrent.CountDownLatch gate = new java.util.concurrent.CountDownLatch(1);
		java.util.concurrent.CountDownLatch started = new java.util.concurrent.CountDownLatch(8);
		Runnable block = ()->{ started.countDown(); try { gate.await(10, java.util.concurrent.TimeUnit.SECONDS); } catch(InterruptedException e) { Thread.currentThread().interrupt(); } };
		try {
			for(int i = 0; i < 24; i++) { pool.execute(block); }
			assertTrue(started.await(5, java.util.concurrent.TimeUnit.SECONDS));
			long t0 = System.currentTimeMillis();
			boolean rejected = false;
			try { pool.execute(block); } catch(java.util.concurrent.RejectedExecutionException e) { rejected = true; }
			assertTrue("第 25 路必须被拒", rejected);
			assertTrue("拒绝必须即时(不是在调用线程同步跑)", System.currentTimeMillis() - t0 < 500L);
		} finally {
			gate.countDown();
		}
	}

	@Test
	public void requestTimeoutClampMatchesFrontend() {
		// [Q-411/M-157] 与前端 resolveRequestTimeout 同口径:未设 0;<1000 视为误填秒 → 120000;>600000 封顶
		assertEquals(0, AIAnalysisProxyService.clampRequestTimeoutMs(0));
		assertEquals(0, AIAnalysisProxyService.clampRequestTimeoutMs(-5));
		assertEquals(120000, AIAnalysisProxyService.clampRequestTimeoutMs(500));
		assertEquals(1000, AIAnalysisProxyService.clampRequestTimeoutMs(1000));
		assertEquals(30000, AIAnalysisProxyService.clampRequestTimeoutMs(30000));
		assertEquals(600000, AIAnalysisProxyService.clampRequestTimeoutMs(900000));
	}

	@Test
	public void assertClientAliveThrowsOnceChannelClosed() {
		// [Q-325/M-126] 通道一关(停止 / 心跳写失败),下一个上游事件(哪怕是 ping / 签名增量)就抛 ClientGoneException
		AIAnalysisProxyService.SseChannel ch = new AIAnalysisProxyService.SseChannel(new org.springframework.web.servlet.mvc.method.annotation.SseEmitter());
		AIAnalysisProxyService.assertClientAlive(ch);   // 未关:不抛
		ch.complete();
		assertTrue(ch.isClosed());
		try {
			AIAnalysisProxyService.assertClientAlive(ch);
			fail("closed channel must throw ClientGoneException");
		} catch (AIAnalysisProxyService.ClientGoneException expected) {
			// ok
		}
		AIAnalysisProxyService.assertClientAlive(null);   // 空通道不抛
	}
}
