package spacex.astrostudy.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.junit.Test;

import boundless.utility.JsonUtility;

/** AI 助手·翻译层压测:随机切片累积精确重组、垃圾帧永不抛、随机历史四家翻译永不抛且可编码、Gemini schema 递归剥键。 */
public class AIToolCallSupportStressTest {

	private static final String[] POOL = { "张三", "Li Si", "\"quoted\"", "back\\slash", "line\nbreak", "😀🧧", "𝒜𝓁𝒾𝒸𝑒", "{\"nested\":[1,2,{\"a\":null}]}", "", " ", "</script>", "x" };

	private static Map<String, Object> map(Object... kv){
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		for(int i = 0; i + 1 < kv.length; i += 2) { m.put(String.valueOf(kv[i]), kv[i + 1]); }
		return m;
	}

	private static Object randomValue(Random rnd, int depth){
		int r = rnd.nextInt(9);
		if(depth > 3 || r < 3) { return POOL[rnd.nextInt(POOL.length)]; }
		if(r == 3) { return rnd.nextInt(1000) - 500; }
		if(r == 4) { return rnd.nextDouble() * 1e6; }
		if(r == 5) { return rnd.nextBoolean(); }
		if(r == 6) { return null; }
		if(r == 7) { List<Object> l = new ArrayList<Object>(); int n = rnd.nextInt(4); for(int i = 0; i < n; i++) { l.add(randomValue(rnd, depth + 1)); } return l; }
		Map<String, Object> m = new LinkedHashMap<String, Object>(); int n = rnd.nextInt(4); for(int i = 0; i < n; i++) { m.put("k" + rnd.nextInt(6), randomValue(rnd, depth + 1)); } return m;
	}

	private static List<String> splitRandom(Random rnd, String s){
		List<String> parts = new ArrayList<String>();
		int i = 0;
		while(i < s.length()) {
			int len = 1 + rnd.nextInt(7);
			int end = Math.min(s.length(), i + len);
			// 不在代理对中间切(SSE 是按字符串帧下发,上游本就不会切半个码点)
			if(end < s.length() && Character.isHighSurrogate(s.charAt(end - 1))) { end++; }
			parts.add(s.substring(i, end));
			i = end;
		}
		return parts;
	}

	@Test
	public void openAIAccumulatorReassemblesFiftyInterleavedCallsExactly() {
		Random rnd = new Random(20260901L);
		int n = 50;
		String[] argsJson = new String[n];
		List<List<String>> frags = new ArrayList<List<String>>();
		for(int i = 0; i < n; i++) {
			Map<String, Object> args = map("name", POOL[rnd.nextInt(POOL.length)], "i", i, "v", randomValue(rnd, 0));
			argsJson[i] = JsonUtility.encode(args);
			frags.add(splitRandom(rnd, argsJson[i]));
		}
		AIToolCallSupport.ToolCallAccumulator acc = new AIToolCallSupport.ToolCallAccumulator("openai");
		int[] cursor = new int[n];
		int starts = 0;
		boolean remaining = true;
		while(remaining) {
			remaining = false;
			int idx = rnd.nextInt(n);
			// 随机挑一个仍有碎片的调用推进一片(模拟乱序交错)
			for(int k = 0; k < n; k++) {
				int j = (idx + k) % n;
				if(cursor[j] < frags.get(j).size()) {
					Map<String, Object> fn = cursor[j] == 0 ? map("name", "tool_" + j, "arguments", frags.get(j).get(cursor[j])) : map("arguments", frags.get(j).get(cursor[j]));
					Map<String, Object> tc = cursor[j] == 0 ? map("index", j, "id", "call_" + j, "type", "function", "function", fn) : map("index", j, "function", fn);
					Map<String, Object> choice = map("delta", map("tool_calls", Arrays.asList(tc)));
					choice.put("finish_reason", null);
					List<AIToolCallSupport.SseEvent> ev = acc.onOpenAIPayload(map("choices", Arrays.asList(choice)));
					for(AIToolCallSupport.SseEvent e : ev) { if("tool_call_start".equals(e.name)) { starts++; } }
					cursor[j]++;
					break;
				}
			}
			for(int j = 0; j < n; j++) { if(cursor[j] < frags.get(j).size()) { remaining = true; break; } }
		}
		acc.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map(), "finish_reason", "tool_calls"))));
		AIToolCallSupport.StreamOutcome outcome = new AIToolCallSupport.StreamOutcome();
		List<AIToolCallSupport.SseEvent> fin = acc.finish(outcome);
		assertEquals(n, starts);
		assertEquals(n, fin.size());
		assertEquals(n, outcome.toolCallCount);
		assertEquals("tool_calls", outcome.finishReason);
		for(AIToolCallSupport.SseEvent e : fin) {
			int j = Integer.parseInt(String.valueOf(e.payload.get("id")).substring(5));
			assertEquals("tool_" + j, e.payload.get("name"));
			assertEquals(argsJson[j], e.payload.get("arguments"));
			assertNull(e.payload.get("parseError"));
		}
	}

	@Test
	public void anthropicAccumulatorReassemblesWithThinkingInterleaved() {
		Random rnd = new Random(7L);
		AIToolCallSupport.ToolCallAccumulator acc = new AIToolCallSupport.ToolCallAccumulator("anthropic");
		int n = 20;
		String[] expected = new String[n];
		for(int i = 0; i < n; i++) {
			int idx = i * 2;
			acc.onAnthropicEvent("content_block_start", map("type", "content_block_start", "index", idx, "content_block", map("type", "thinking")));
			acc.onAnthropicEvent("content_block_delta", map("type", "content_block_delta", "index", idx, "delta", map("type", "thinking_delta", "thinking", "t" + i)));
			acc.onAnthropicEvent("content_block_delta", map("type", "content_block_delta", "index", idx, "delta", map("type", "signature_delta", "signature", "S" + i)));
			acc.onAnthropicEvent("content_block_stop", map("type", "content_block_stop", "index", idx));
			expected[i] = JsonUtility.encode(map("q", POOL[rnd.nextInt(POOL.length)], "v", randomValue(rnd, 0)));
			acc.onAnthropicEvent("content_block_start", map("type", "content_block_start", "index", idx + 1, "content_block", map("type", "tool_use", "id", "toolu_" + i, "name", "list_records", "input", map())));
			for(String p : splitRandom(rnd, expected[i])) {
				acc.onAnthropicEvent("content_block_delta", map("type", "content_block_delta", "index", idx + 1, "delta", map("type", "input_json_delta", "partial_json", p)));
			}
			List<AIToolCallSupport.SseEvent> stop = acc.onAnthropicEvent("content_block_stop", map("type", "content_block_stop", "index", idx + 1));
			assertEquals(1, stop.size());
			assertEquals(expected[i], stop.get(0).payload.get("arguments"));
			assertNull(stop.get(0).payload.get("parseError"));
		}
		acc.onAnthropicEvent("message_delta", map("type", "message_delta", "delta", map("stop_reason", "tool_use")));
		AIToolCallSupport.StreamOutcome outcome = new AIToolCallSupport.StreamOutcome();
		assertTrue(acc.finish(outcome).isEmpty());
		assertEquals(n, outcome.toolCallCount);
		List blocks = (List) outcome.providerMeta.get("anthropicBlocks");
		assertEquals(n, blocks.size());
		assertEquals("S3", ((Map) blocks.get(3)).get("signature"));
	}

	@Test
	public void garbageFramesNeverThrowOnAnyAccumulator() {
		Random rnd = new Random(99L);
		String[] providers = { "openai", "deepseek", "ollama", "anthropic", "gemini" };
		for(int i = 0; i < 3000; i++) {
			Object v = randomValue(rnd, 0);
			@SuppressWarnings("unchecked")
			Map<String, Object> payload = v instanceof Map ? (Map<String, Object>) v : map("choices", v, "message", v, "candidates", v, "delta", v, "content_block", v, "type", v);
			AIToolCallSupport.ToolCallAccumulator acc = new AIToolCallSupport.ToolCallAccumulator(providers[i % providers.length]);
			acc.onOpenAIPayload(payload);
			acc.onOllamaPayload(payload);
			acc.onAnthropicEvent(i % 2 == 0 ? "content_block_start" : "", payload);
			acc.onGeminiPayload(payload);
			AIToolCallSupport.StreamOutcome outcome = new AIToolCallSupport.StreamOutcome();
			List<AIToolCallSupport.SseEvent> fin = acc.finish(outcome);
			assertNotNull(fin);
			assertNotNull(outcome.finishReason);
			for(AIToolCallSupport.SseEvent e : fin) { assertNotNull(JsonUtility.encode(e.payload)); }
		}
	}

	private static List<Map<String, Object>> randomHistory(Random rnd){
		List<Map<String, Object>> msgs = new ArrayList<Map<String, Object>>();
		msgs.add(map("role", "system", "content", "S"));
		int n = 1 + rnd.nextInt(8);
		for(int i = 0; i < n; i++) {
			int r = rnd.nextInt(5);
			if(r == 0) { msgs.add(map("role", "user", "content", POOL[rnd.nextInt(POOL.length)])); }
			else if(r == 1) { msgs.add(map("role", "assistant", "content", POOL[rnd.nextInt(POOL.length)])); }
			else if(r == 2) {
				List<Object> calls = new ArrayList<Object>();
				int k = rnd.nextInt(4);
				for(int j = 0; j < k; j++) { calls.add(map("id", rnd.nextBoolean() ? "call_" + j : "", "name", "t" + j, "args", rnd.nextBoolean() ? randomValue(rnd, 0) : JsonUtility.encode(map("x", j)))); }
				msgs.add(map("role", "assistant", "content", rnd.nextBoolean() ? "" : "text", "toolCalls", calls, "providerMeta", map("reasoningContent", "rc", "anthropicBlocks", Arrays.asList(map("type", "thinking", "thinking", "t", "signature", "s"), map("type", "bogus")), "thoughtSignatures", map("call_0", "ts"))));
			}
			else if(r == 3) {
				List<Object> results = new ArrayList<Object>();
				int k = rnd.nextInt(4);
				for(int j = 0; j < k; j++) { results.add(map("callId", "call_" + j, "name", "t" + j, "content", rnd.nextBoolean() ? POOL[rnd.nextInt(POOL.length)] : randomValue(rnd, 0), "isError", rnd.nextBoolean())); }
				msgs.add(map("role", "tool", "toolResults", results));
			}
			else { msgs.add(map("role", "user", "content", "", "images", Arrays.asList("data:image/png;base64,AAAA"))); }
		}
		return AIAnalysisProxyService.getMessageList(msgs);
	}

	@Test
	public void randomHistoriesTranslateForAllFamiliesWithoutThrowing() {
		Random rnd = new Random(2026L);
		AIAnalysisProxyService svc = new AIAnalysisProxyService();
		for(int i = 0; i < 400; i++) {
			List<Map<String, Object>> history = randomHistory(rnd);
			Object tools = rnd.nextInt(4) == 0 ? new ArrayList<Object>() : Arrays.asList(map("name", "list_records", "description", "d", "inputSchema", randomSchema(rnd, 0)), map("name", "", "description", "ignored"));
			Map<String, Object> params = map("providerType", "deepseek", "tools", tools, "toolChoice", rnd.nextBoolean() ? "auto" : "none",
				"providerOptions", rnd.nextBoolean() ? map("thinking", map("type", "enabled", "budget_tokens", 512)) : map());
			assertNotNull(JsonUtility.encode(AIAnalysisProxyService.buildOpenAIChatBody("deepseek-chat", params, history, true)));
			params.put("providerType", "anthropic");
			assertNotNull(JsonUtility.encode(AIAnalysisProxyService.buildAnthropicBody("claude", params, history, true)));
			params.put("providerType", "gemini");
			assertNotNull(JsonUtility.encode(AIAnalysisProxyService.buildGeminiBody(params, history)));
			params.put("providerType", "ollama");
			assertNotNull(JsonUtility.encode(svc.buildOllamaNativeBody("llama3", params, history, true)));
		}
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> randomSchema(Random rnd, int depth){
		Map<String, Object> s = new LinkedHashMap<String, Object>();
		s.put("type", rnd.nextInt(5) == 0 ? Arrays.asList("string", "null") : (depth > 2 ? "string" : "object"));
		s.put("additionalProperties", Boolean.FALSE);
		s.put("$schema", "x");
		if(rnd.nextBoolean()) { s.put("const", "k"); }
		if(rnd.nextBoolean()) { s.put("allOf", Arrays.asList(map("if", map(), "then", map()))); }
		if(depth <= 2 && rnd.nextBoolean()) {
			Map<String, Object> props = new LinkedHashMap<String, Object>();
			int n = rnd.nextInt(4);
			for(int i = 0; i < n; i++) { props.put("p" + i, randomSchema(rnd, depth + 1)); }
			s.put("properties", props);
			s.put("required", Arrays.asList("p0"));
		}
		if(depth <= 3 && rnd.nextBoolean()) { s.put("items", randomSchema(rnd, depth + 1)); }
		if(depth <= 3 && rnd.nextBoolean()) { s.put("anyOf", Arrays.asList(randomSchema(rnd, depth + 1))); }
		return s;
	}

	/** 病态深度(2000 层 items 链)不得打穿栈:超顶按 string 收口且输出可编码。 */
	@Test
	public void pathologicalDepthIsCappedNotStackOverflow() {
		Map<String, Object> leaf = map("type", "string");
		Object cur = leaf;
		for(int i = 0; i < 2000; i++) { cur = map("type", "array", "items", cur, "additionalProperties", Boolean.FALSE); }
		Object out = AIToolCallSupport.sanitizeGeminiSchema(cur);
		assertNotNull(JsonUtility.encode(out));
		assertNoDroppedKeys(out);
	}

	@SuppressWarnings("rawtypes")
	private static void assertNoDroppedKeys(Object v){
		if(v instanceof Map) {
			for(Object k : ((Map) v).keySet()) {
				String key = String.valueOf(k);
				assertFalse("dropped key leaked: " + key, Arrays.asList("$schema", "additionalProperties", "allOf", "if", "then", "const").contains(key));
				Object t = ((Map) v).get("type");
				assertFalse("type must not be a list", t instanceof List);
				assertNoDroppedKeys(((Map) v).get(k));
			}
		} else if(v instanceof List) {
			for(Object o : (List) v) { assertNoDroppedKeys(o); }
		}
	}

	@Test
	public void geminiSchemaSanitizerIsRecursiveOnRandomSchemas() {
		Random rnd = new Random(31L);
		for(int i = 0; i < 500; i++) {
			Object out = AIToolCallSupport.sanitizeGeminiSchema(randomSchema(rnd, 0));
			assertNoDroppedKeys(out);
			assertNotNull(JsonUtility.encode(out));
		}
	}
}
