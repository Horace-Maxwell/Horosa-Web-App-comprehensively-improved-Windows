package spacex.astrostudy.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
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
				"top_p", 0.8d
			)
		);
		Map<String, Object> bodyOptions = AIAnalysisProxyService.buildProviderBodyOptions(params);
		assertTrue(bodyOptions.containsKey("response_format"));
		assertEquals(0.8d, bodyOptions.get("top_p"));
		assertFalse(bodyOptions.containsKey("extraHeaders"));
		assertFalse(bodyOptions.containsKey("requestTimeoutMs"));
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
		// Anthropic extended thinking 开启:① 不发 temperature ② 不发 top_k/top_p ③ max_tokens > budget_tokens。
		Map<String, Object> thinking = buildMap("type", "enabled", "budget_tokens", 4096);
		Map<String, Object> params = buildMap(
			"temperature", 0.7,
			"maxTokens", 2048,
			"providerOptions", buildMap("thinking", thinking, "top_k", 40, "top_p", 0.9));
		Map<String, Object> body = AIAnalysisProxyService.buildAnthropicBody(
			"claude-opus-4-8", params, new java.util.ArrayList<Map<String, Object>>(), true);
		assertFalse("思考开启不应发 temperature", body.containsKey("temperature"));
		assertFalse("思考开启不应发 top_k", body.containsKey("top_k"));
		assertFalse("思考开启不应发 top_p", body.containsKey("top_p"));
		assertTrue(body.containsKey("thinking"));
		// max_tokens(2048) <= budget(4096) → 自动上调到 budget+1024,保证 max_tokens > budget_tokens。
		assertEquals(Integer.valueOf(4096 + 1024), body.get("max_tokens"));
	}

	@Test
	public void buildAnthropicBodyWithoutThinkingKeepsTemperature() {
		// 未开思考:照常发 temperature + 原 max_tokens(零回归)。
		Map<String, Object> params = buildMap("temperature", 0.5, "maxTokens", 2048);
		Map<String, Object> body = AIAnalysisProxyService.buildAnthropicBody(
			"claude-opus-4-8", params, new java.util.ArrayList<Map<String, Object>>(), false);
		assertTrue(body.containsKey("temperature"));
		assertEquals(0.5d, body.get("temperature"));
		assertEquals(Integer.valueOf(2048), body.get("max_tokens"));
		assertFalse(body.containsKey("thinking"));
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
}
