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

import org.junit.Test;

import boundless.utility.JsonUtility;

/** AI 助手·工具调用翻译层:四家 body 翻译 / 四家流累积 / 无 tools 零介入(旧金标逐键相同)。 */
public class AIToolCallSupportTest {

	private static Map<String, Object> map(Object... kv){
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		for(int i = 0; i + 1 < kv.length; i += 2) { m.put(String.valueOf(kv[i]), kv[i + 1]); }
		return m;
	}

	private static List<Map<String, Object>> neutralTools(){
		Map<String, Object> schema = map("type", "object", "additionalProperties", Boolean.FALSE,
			"properties", map("name", map("type", "string", "maxLength", 60), "kind", map("type", Arrays.asList("string", "null"), "const", "x")),
			"required", Arrays.asList("name"),
			"allOf", Arrays.asList(map("if", map("x", 1), "then", map("required", Arrays.asList("y")))));
		List<Map<String, Object>> tools = new ArrayList<Map<String, Object>>();
		tools.add(map("name", "create_chart_record", "description", "d", "inputSchema", schema));
		return tools;
	}

	private static List<Map<String, Object>> neutralHistory(){
		List<Map<String, Object>> msgs = new ArrayList<Map<String, Object>>();
		msgs.add(map("role", "system", "content", "S"));
		msgs.add(map("role", "user", "content", "建档"));
		msgs.add(map("role", "assistant", "content", "我来建档", "toolCalls", Arrays.asList(map("id", "call_1", "name", "create_chart_record", "args", map("name", "张三"))),
			"providerMeta", map("reasoningContent", "think…", "anthropicBlocks", Arrays.asList(map("type", "thinking", "thinking", "t", "signature", "sig")), "thoughtSignatures", map("call_1", "ts1"))));
		msgs.add(map("role", "tool", "toolResults", Arrays.asList(map("callId", "call_1", "name", "create_chart_record", "content", "{\"ok\":true}", "isError", Boolean.FALSE))));
		return AIAnalysisProxyService.getMessageList(msgs);
	}

	@Test
	public void getMessageListKeepsToolFieldsAndDropsUnknown() {
		List<Map<String, Object>> out = neutralHistory();
		assertEquals(4, out.size());
		assertTrue(AIToolCallSupport.hasToolCalls(out.get(2)));
		assertTrue(AIToolCallSupport.hasToolResults(out.get(3)));
		assertEquals("张三", ((Map) ((Map) ((List) out.get(2).get("toolCalls")).get(0)).get("args")).get("name"));
		assertEquals("think…", ((Map) out.get(2).get("providerMeta")).get("reasoningContent"));
		// 纯文本消息:只有 role/content(旧形状零变)
		assertEquals(Arrays.asList("role", "content"), new ArrayList<String>(out.get(1).keySet()));
	}

	@Test
	public void openAIBodyTranslatesToolsAndMessages() {
		Map<String, Object> params = map("providerType", "deepseek", "tools", neutralTools(), "toolChoice", "auto");
		Map<String, Object> body = AIAnalysisProxyService.buildOpenAIChatBody("deepseek-chat", params, neutralHistory(), true);
		List tools = (List) body.get("tools");
		assertEquals(1, tools.size());
		Map fn = (Map) ((Map) tools.get(0)).get("function");
		assertEquals("create_chart_record", fn.get("name"));
		assertNotNull(((Map) fn.get("parameters")).get("additionalProperties"));   // OpenAI 保留原 schema
		assertEquals("auto", body.get("tool_choice"));
		List msgs = (List) body.get("messages");
		assertEquals(4, msgs.size());
		Map asst = (Map) msgs.get(2);
		assertEquals("assistant", asst.get("role"));
		List tcs = (List) asst.get("tool_calls");
		assertEquals("call_1", ((Map) tcs.get(0)).get("id"));
		assertEquals("function", ((Map) tcs.get(0)).get("type"));
		assertEquals("{\"name\":\"张三\"}", ((Map) ((Map) tcs.get(0)).get("function")).get("arguments"));
		assertEquals("think…", asst.get("reasoning_content"));   // deepseek 才回填
		Map toolMsg = (Map) msgs.get(3);
		assertEquals("tool", toolMsg.get("role"));
		assertEquals("call_1", toolMsg.get("tool_call_id"));
		assertEquals("{\"ok\":true}", toolMsg.get("content"));
		// 非 deepseek:不回填 reasoning_content
		Map<String, Object> p2 = map("providerType", "openai", "tools", neutralTools());
		Map<String, Object> b2 = AIAnalysisProxyService.buildOpenAIChatBody("gpt-4.1", p2, neutralHistory(), true);
		assertNull(((Map) ((List) b2.get("messages")).get(2)).get("reasoning_content"));
		assertNull(b2.get("tool_choice"));
	}

	@Test
	public void openAIBodyWithoutToolsIsByteIdenticalToLegacy() {
		List<Map<String, Object>> plain = new ArrayList<Map<String, Object>>();
		plain.add(map("role", "system", "content", "S"));
		plain.add(map("role", "user", "content", "u"));
		Map<String, Object> legacyParams = map("providerType", "openai");
		String a = JsonUtility.encode(AIAnalysisProxyService.buildOpenAIChatBody("gpt-4.1", legacyParams, AIAnalysisProxyService.getMessageList(plain), true));
		String b = JsonUtility.encode(AIAnalysisProxyService.buildOpenAIChatBody("gpt-4.1", map("providerType", "openai", "tools", new ArrayList<Object>()), AIAnalysisProxyService.getMessageList(plain), true));
		assertEquals(a, b);
		assertFalse(a.contains("tool"));
		String c = JsonUtility.encode(AIAnalysisProxyService.buildAnthropicBody("claude", map("providerType", "anthropic"), AIAnalysisProxyService.getMessageList(plain), true));
		assertFalse(c.contains("tool"));
		Map<String, Object> ollama = new AIAnalysisProxyService().buildOllamaNativeBody("llama3", map("providerType", "ollama"), AIAnalysisProxyService.getMessageList(plain), true);
		assertFalse(JsonUtility.encode(ollama).contains("tool"));
	}

	@Test
	public void anthropicBodyTranslatesBlocksAndAllowsEmptyContentToolMessages() {
		Map<String, Object> params = map("providerType", "anthropic", "tools", neutralTools(), "toolChoice", "none",
			"providerOptions", map("thinking", map("type", "enabled", "budget_tokens", 1024)));
		Map<String, Object> body = AIAnalysisProxyService.buildAnthropicBody("claude", params, neutralHistory(), true);
		List tools = (List) body.get("tools");
		assertEquals("create_chart_record", ((Map) tools.get(0)).get("name"));
		assertNotNull(((Map) tools.get(0)).get("input_schema"));
		assertEquals("none", ((Map) body.get("tool_choice")).get("type"));
		List msgs = (List) body.get("messages");
		assertEquals(3, msgs.size());   // system 抽走;assistant(tool_use) + user(tool_result) 都在
		Map asst = (Map) msgs.get(1);
		List blocks = (List) asst.get("content");
		assertEquals("thinking", ((Map) blocks.get(0)).get("type"));   // 思考档开启:签名块回填在最前
		assertEquals("sig", ((Map) blocks.get(0)).get("signature"));
		assertEquals("text", ((Map) blocks.get(1)).get("type"));
		Map tu = (Map) blocks.get(2);
		assertEquals("tool_use", tu.get("type"));
		assertEquals("call_1", tu.get("id"));
		assertEquals("张三", ((Map) tu.get("input")).get("name"));
		Map user = (Map) msgs.get(2);
		assertEquals("user", user.get("role"));
		Map tr = (Map) ((List) user.get("content")).get(0);
		assertEquals("tool_result", tr.get("type"));
		assertEquals("call_1", tr.get("tool_use_id"));
		assertNull(tr.get("is_error"));
		// 思考档关:不回填 thinking 块
		Map<String, Object> p2 = map("providerType", "anthropic", "tools", neutralTools());
		Map<String, Object> b2 = AIAnalysisProxyService.buildAnthropicBody("claude", p2, neutralHistory(), true);
		List blocks2 = (List) ((Map) ((List) b2.get("messages")).get(1)).get("content");
		assertEquals("text", ((Map) blocks2.get(0)).get("type"));
	}

	@Test
	public void geminiSchemaSanitizedAndMessagesTranslated() {
		Map<String, Object> params = map("providerType", "gemini", "tools", neutralTools(), "toolChoice", "auto");
		Map<String, Object> body = AIAnalysisProxyService.buildGeminiBody(params, neutralHistory());
		List tools = (List) body.get("tools");
		Map decl = (Map) ((List) ((Map) tools.get(0)).get("functionDeclarations")).get(0);
		Map schema = (Map) decl.get("parameters");
		assertNull(schema.get("additionalProperties"));
		assertNull(schema.get("allOf"));
		Map kind = (Map) ((Map) schema.get("properties")).get("kind");
		assertEquals("STRING", kind.get("type"));   // [D69] 官方枚举名(此前锁的是小写 = 与 discovery 枚举不合)
		assertEquals(Boolean.TRUE, kind.get("nullable"));
		assertEquals(Arrays.asList("x"), kind.get("enum"));
		assertNull(kind.get("const"));
		assertEquals("AUTO", ((Map) ((Map) body.get("toolConfig")).get("functionCallingConfig")).get("mode"));
		List contents = (List) body.get("contents");
		assertEquals(3, contents.size());
		Map model = (Map) contents.get(1);
		assertEquals("model", model.get("role"));
		List parts = (List) model.get("parts");
		assertEquals("我来建档", ((Map) parts.get(0)).get("text"));
		Map fcPart = (Map) parts.get(1);
		assertEquals("create_chart_record", ((Map) fcPart.get("functionCall")).get("name"));
		assertEquals("ts1", fcPart.get("thoughtSignature"));
		Map user = (Map) contents.get(2);
		assertEquals("user", user.get("role"));
		Map fr = (Map) ((Map) ((List) user.get("parts")).get(0)).get("functionResponse");
		assertEquals("create_chart_record", fr.get("name"));
		assertEquals("{\"ok\":true}", ((Map) fr.get("response")).get("result"));
	}

	@Test
	public void ollamaBodyTranslatesToolCallsWithObjectArguments() {
		Map<String, Object> params = map("providerType", "ollama", "tools", neutralTools());
		Map<String, Object> body = new AIAnalysisProxyService().buildOllamaNativeBody("llama3.1", params, neutralHistory(), true);
		assertEquals(1, ((List) body.get("tools")).size());
		List msgs = (List) body.get("messages");
		assertEquals(4, msgs.size());
		Map asst = (Map) msgs.get(2);
		Map fn = (Map) ((Map) ((List) asst.get("tool_calls")).get(0)).get("function");
		assertEquals("张三", ((Map) fn.get("arguments")).get("name"));   // Ollama 要对象不要串
		Map tool = (Map) msgs.get(3);
		assertEquals("tool", tool.get("role"));
		assertEquals("create_chart_record", tool.get("tool_name"));
	}

	@Test
	public void openAIAccumulatorJoinsArgumentChunksByIndex() {
		AIToolCallSupport.ToolCallAccumulator acc = new AIToolCallSupport.ToolCallAccumulator("deepseek");
		List<AIToolCallSupport.SseEvent> ev1 = acc.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map("reasoning_content", "hmm", "tool_calls", Arrays.asList(map("index", 0, "id", "call_a", "type", "function", "function", map("name", "create_chart_record", "arguments", "{\"na"))))))));
		assertEquals(1, ev1.size());
		assertEquals("tool_call_start", ev1.get(0).name);
		assertEquals("call_a", ev1.get(0).payload.get("id"));
		List<AIToolCallSupport.SseEvent> ev2 = acc.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map("tool_calls", Arrays.asList(map("index", 0, "function", map("arguments", "me\":\"张三\"}")), map("index", 1, "id", "call_b", "function", map("name", "list_records", "arguments", "{}"))))))));
		// 第二帧:index0 的参数片段 → 一条 tool_call_delta(续命);index1 首见 → 一条 tool_call_start
		assertEquals(2, ev2.size());
		assertEquals("tool_call_delta", ev2.get(0).name);
		assertEquals("tool_call_start", ev2.get(1).name);
		assertEquals("call_b", ev2.get(1).payload.get("id"));
		acc.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map(), "finish_reason", "tool_calls"))));
		AIToolCallSupport.StreamOutcome outcome = new AIToolCallSupport.StreamOutcome();
		List<AIToolCallSupport.SseEvent> fin = acc.finish(outcome);
		assertEquals(2, fin.size());
		assertEquals("tool_call", fin.get(0).name);
		assertEquals("{\"name\":\"张三\"}", fin.get(0).payload.get("arguments"));
		assertNull(fin.get(0).payload.get("parseError"));
		assertEquals("{}", fin.get(1).payload.get("arguments"));
		assertEquals(2, outcome.toolCallCount);
		assertEquals("tool_calls", outcome.finishReason);
		assertEquals("hmm", outcome.providerMeta.get("reasoningContent"));
		// 坏 JSON 参数打 parseError 而不是丢帧
		AIToolCallSupport.ToolCallAccumulator bad = new AIToolCallSupport.ToolCallAccumulator("openai");
		bad.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map("tool_calls", Arrays.asList(map("index", 0, "id", "c", "function", map("name", "x", "arguments", "{bad"))))))));
		List<AIToolCallSupport.SseEvent> badFin = bad.finish(new AIToolCallSupport.StreamOutcome());
		assertNotNull(badFin.get(0).payload.get("parseError"));
	}

	@Test
	public void gatewayObjectArgumentsAndBlockStartSeedAreNotDropped() {
		AIToolCallSupport.ToolCallAccumulator acc = new AIToolCallSupport.ToolCallAccumulator("openai");
		acc.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map("tool_calls", Arrays.asList(map("index", 0, "id", "c1", "function", map("name", "list_records", "arguments", map("kind", "chart")))))))));
		List<AIToolCallSupport.SseEvent> fin = acc.finish(new AIToolCallSupport.StreamOutcome());
		assertEquals("{\"kind\":\"chart\"}", fin.get(0).payload.get("arguments"));
		AIToolCallSupport.ToolCallAccumulator a2 = new AIToolCallSupport.ToolCallAccumulator("anthropic");
		a2.onAnthropicEvent("content_block_start", map("type", "content_block_start", "index", 0, "content_block", map("type", "tool_use", "id", "t1", "name", "get_settings", "input", map("facet", "app"))));
		List<AIToolCallSupport.SseEvent> stop = a2.onAnthropicEvent("content_block_stop", map("type", "content_block_stop", "index", 0));
		assertEquals("{\"facet\":\"app\"}", stop.get(0).payload.get("arguments"));
		// 参数分片 → tool_call_delta 续命帧(不含内容)
		AIToolCallSupport.ToolCallAccumulator a3 = new AIToolCallSupport.ToolCallAccumulator("openai");
		a3.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map("tool_calls", Arrays.asList(map("index", 0, "id", "c9", "function", map("name", "x", "arguments", "{\"a"))))))));
		List<AIToolCallSupport.SseEvent> d = a3.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map("tool_calls", Arrays.asList(map("index", 0, "function", map("arguments", "\":1}"))))))));
		assertEquals("tool_call_delta", d.get(0).name);
		assertEquals(4, d.get(0).payload.get("chars"));
		assertNull(d.get(0).payload.get("arguments"));
	}

	@Test
	public void anthropicThinkingBlocksReplayOnlyForSameModel() {
		Map<String, Object> msg = map("role", "assistant", "content", "t", "toolCalls", Arrays.asList(map("id", "c1", "name", "x", "args", map())),
			"providerMeta", map("model", "claude-a", "anthropicBlocks", Arrays.asList(map("type", "thinking", "thinking", "th", "signature", "sig"))));
		List<Object> same = AIToolCallSupport.anthropicAssistantBlocks(msg, "t", true, "claude-a");
		assertEquals("thinking", ((Map) same.get(0)).get("type"));
		List<Object> other = AIToolCallSupport.anthropicAssistantBlocks(msg, "t", true, "claude-b");
		assertEquals("text", ((Map) other.get(0)).get("type"));
		List<Object> legacy = AIToolCallSupport.anthropicAssistantBlocks(msg, "t", true, null);
		assertEquals("thinking", ((Map) legacy.get(0)).get("type"));
	}

	@Test
	public void plainStreamOutcomeIsStopWithZeroCalls() {
		AIToolCallSupport.ToolCallAccumulator acc = new AIToolCallSupport.ToolCallAccumulator("openai");
		acc.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map("content", "hi"), "finish_reason", "stop"))));
		AIToolCallSupport.StreamOutcome outcome = new AIToolCallSupport.StreamOutcome();
		assertTrue(acc.finish(outcome).isEmpty());
		assertEquals(0, outcome.toolCallCount);
		assertEquals("stop", outcome.finishReason);
		assertTrue(outcome.providerMeta.isEmpty());
		AIToolCallSupport.ToolCallAccumulator len = new AIToolCallSupport.ToolCallAccumulator("openai");
		len.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map(), "finish_reason", "length"))));
		AIToolCallSupport.StreamOutcome o2 = new AIToolCallSupport.StreamOutcome();
		len.finish(o2);
		assertEquals("length", o2.finishReason);
	}

	@Test
	public void anthropicAccumulatorEmitsOnBlockStopAndCollectsThinking() {
		AIToolCallSupport.ToolCallAccumulator acc = new AIToolCallSupport.ToolCallAccumulator("anthropic");
		acc.onAnthropicEvent("content_block_start", map("type", "content_block_start", "index", 0, "content_block", map("type", "thinking", "thinking", "")));
		acc.onAnthropicEvent("content_block_delta", map("type", "content_block_delta", "index", 0, "delta", map("type", "thinking_delta", "thinking", "let me")));
		acc.onAnthropicEvent("content_block_delta", map("type", "content_block_delta", "index", 0, "delta", map("type", "signature_delta", "signature", "SIG")));
		acc.onAnthropicEvent("content_block_stop", map("type", "content_block_stop", "index", 0));
		List<AIToolCallSupport.SseEvent> s = acc.onAnthropicEvent("content_block_start", map("type", "content_block_start", "index", 1, "content_block", map("type", "tool_use", "id", "toolu_1", "name", "create_case_record", "input", map())));
		assertEquals("tool_call_start", s.get(0).name);
		acc.onAnthropicEvent("content_block_delta", map("type", "content_block_delta", "index", 1, "delta", map("type", "input_json_delta", "partial_json", "{\"caseType\":")));
		acc.onAnthropicEvent("content_block_delta", map("type", "content_block_delta", "index", 1, "delta", map("type", "input_json_delta", "partial_json", "\"qimen\"}")));
		List<AIToolCallSupport.SseEvent> stop = acc.onAnthropicEvent("content_block_stop", map("type", "content_block_stop", "index", 1));
		assertEquals("tool_call", stop.get(0).name);
		assertEquals("toolu_1", stop.get(0).payload.get("id"));
		assertEquals("{\"caseType\":\"qimen\"}", stop.get(0).payload.get("arguments"));
		acc.onAnthropicEvent("message_delta", map("type", "message_delta", "delta", map("stop_reason", "tool_use")));
		AIToolCallSupport.StreamOutcome outcome = new AIToolCallSupport.StreamOutcome();
		assertTrue(acc.finish(outcome).isEmpty());
		assertEquals("tool_calls", outcome.finishReason);
		List blocks = (List) outcome.providerMeta.get("anthropicBlocks");
		assertEquals(1, blocks.size());
		assertEquals("let me", ((Map) blocks.get(0)).get("thinking"));
		assertEquals("SIG", ((Map) blocks.get(0)).get("signature"));
	}

	@Test
	public void geminiAndOllamaAccumulatorsEmitWholeCalls() {
		AIToolCallSupport.ToolCallAccumulator g = new AIToolCallSupport.ToolCallAccumulator("gemini");
		List<AIToolCallSupport.SseEvent> ev = g.onGeminiPayload(map("candidates", Arrays.asList(map("content", map("parts", Arrays.asList(map("functionCall", map("name", "list_records", "args", map("kind", "chart")), "thoughtSignature", "TS"))), "finishReason", "STOP"))));
		assertEquals(2, ev.size());
		assertEquals("tool_call_start", ev.get(0).name);
		assertEquals("tool_call", ev.get(1).name);
		assertEquals("{\"kind\":\"chart\"}", ev.get(1).payload.get("arguments"));
		AIToolCallSupport.StreamOutcome go = new AIToolCallSupport.StreamOutcome();
		g.finish(go);
		assertEquals("tool_calls", go.finishReason);   // 有调用即 tool_calls,不被 STOP 盖掉
		assertEquals("TS", ((Map) go.providerMeta.get("thoughtSignatures")).get(ev.get(1).payload.get("id")));
		AIToolCallSupport.ToolCallAccumulator o = new AIToolCallSupport.ToolCallAccumulator("ollama");
		List<AIToolCallSupport.SseEvent> oe = o.onOllamaPayload(map("message", map("role", "assistant", "content", "", "tool_calls", Arrays.asList(map("function", map("name", "get_settings", "arguments", map("facet", "app"))))), "done", Boolean.FALSE));
		assertEquals(2, oe.size());
		assertEquals("{\"facet\":\"app\"}", oe.get(1).payload.get("arguments"));
		AIToolCallSupport.StreamOutcome oo = new AIToolCallSupport.StreamOutcome();
		o.finish(oo);
		assertEquals(1, oo.toolCallCount);
	}

	@Test
	public void parseErrorTextStripsExceptionClassAndSourceLocation() {
		String raw = "com.fasterxml.jackson.core.io.JsonEOFException: Unexpected end-of-input within/between Object entries\n at [Source: (String)\"{\"; line: 1, column: 25]";
		assertEquals("Unexpected end-of-input within/between Object entries", AIToolCallSupport.ToolCallAccumulator.cleanParseError(raw));
		assertEquals("Unrecognized token 'x'", AIToolCallSupport.ToolCallAccumulator.cleanParseError("java.lang.RuntimeException: com.fasterxml.jackson.core.JsonParseException: Unrecognized token 'x' at [Source: x; line: 1]"));
		assertEquals("bad json", AIToolCallSupport.ToolCallAccumulator.cleanParseError(null));
		assertEquals("bad json", AIToolCallSupport.ToolCallAccumulator.cleanParseError("  "));
		assertEquals("plain message", AIToolCallSupport.ToolCallAccumulator.cleanParseError("plain message"));
	}

	// [D69] Gemini Schema.type 必须是官方枚举名(大写);嵌套 properties/items/anyOf 同样;type 数组带 null → 挑首个非 null 大写 + nullable
	@Test
	public void geminiSchemaTypesAreUppercasedRecursively() {
		Map<String, Object> inner = new java.util.LinkedHashMap<String, Object>();
		inner.put("type", "string");
		Map<String, Object> arr = new java.util.LinkedHashMap<String, Object>();
		arr.put("type", "array"); arr.put("items", inner);
		Map<String, Object> nul = new java.util.LinkedHashMap<String, Object>();
		nul.put("type", java.util.Arrays.asList("integer", "null"));
		Map<String, Object> props = new java.util.LinkedHashMap<String, Object>();
		props.put("dateStr", inner); props.put("tags", arr); props.put("age", nul);
		Map<String, Object> schema = new java.util.LinkedHashMap<String, Object>();
		schema.put("type", "object"); schema.put("properties", props); schema.put("required", java.util.Arrays.asList("dateStr"));
		@SuppressWarnings("unchecked") Map<String, Object> out = (Map<String, Object>) AIToolCallSupport.sanitizeGeminiSchema(schema);
		assertEquals("OBJECT", out.get("type"));
		@SuppressWarnings("unchecked") Map<String, Object> p2 = (Map<String, Object>) out.get("properties");
		assertEquals("STRING", ((Map) p2.get("dateStr")).get("type"));
		assertEquals("ARRAY", ((Map) p2.get("tags")).get("type"));
		assertEquals("STRING", ((Map) ((Map) p2.get("tags")).get("items")).get("type"));
		assertEquals("INTEGER", ((Map) p2.get("age")).get("type"));
		assertEquals(Boolean.TRUE, ((Map) p2.get("age")).get("nullable"));
		assertEquals("STRING", AIToolCallSupport.geminiTypeName("string"));
		assertEquals("weird", AIToolCallSupport.geminiTypeName("weird"));
	}

	// ───────────── 零测试分支补齐(D75 / D76 / D87) ─────────────

	// [D75] Ollama 原生口没有 tool_choice:收口轮 toolChoice=none ⇒ 不带 tools(否则模型仍可发调用 ⇒ 多一轮 + 轮数上限噪音);非 none / 无 tools 逐字节同今日
	@Test
	public void ollamaBodyOmitsToolsWhenToolChoiceNone() {
		AIAnalysisProxyService svc = new AIAnalysisProxyService();
		Map<String, Object> closing = svc.buildOllamaNativeBody("llama3.1", map("providerType", "ollama", "tools", neutralTools(), "toolChoice", "none"), neutralHistory(), true);
		assertFalse("收口轮不得带 tools", closing.containsKey("tools"));
		assertFalse(JsonUtility.encode(closing).contains("\"tools\""));
		Map<String, Object> open = svc.buildOllamaNativeBody("llama3.1", map("providerType", "ollama", "tools", neutralTools(), "toolChoice", "auto"), neutralHistory(), true);
		assertEquals(1, ((List) open.get("tools")).size());
		Map<String, Object> absent = svc.buildOllamaNativeBody("llama3.1", map("providerType", "ollama", "tools", neutralTools()), neutralHistory(), true);
		assertEquals(1, ((List) absent.get("tools")).size());
		// 除 tools 之外逐键相同(messages 里的 tool_calls / tool 消息照旧回放)
		open.remove("tools");
		assertEquals(JsonUtility.encode(open), JsonUtility.encode(closing));
		// 无 tools + none:与今日无 tools 的请求体逐字节相同
		Map<String, Object> noneNoTools = svc.buildOllamaNativeBody("llama3.1", map("providerType", "ollama", "toolChoice", "none"), neutralHistory(), true);
		Map<String, Object> plain = svc.buildOllamaNativeBody("llama3.1", map("providerType", "ollama"), neutralHistory(), true);
		assertEquals(JsonUtility.encode(plain), JsonUtility.encode(noneNoTools));
	}

	// [D76] const 无 type 的推断类型也走 Gemini 枚举名(D69 大写归一漏了这条支路:此前下发小写 "number"/"boolean"/"string")
	@Test
	public void geminiConstEnumInfersUppercaseType() {
		Map<String, Object> props = map("n", map("const", 5), "b", map("const", Boolean.TRUE), "s", map("const", "x"), "typed", map("type", "string", "const", "y"));
		@SuppressWarnings("unchecked") Map<String, Object> out = (Map<String, Object>) AIToolCallSupport.sanitizeGeminiSchema(map("type", "object", "properties", props));
		@SuppressWarnings("unchecked") Map<String, Object> p = (Map<String, Object>) out.get("properties");
		assertEquals("NUMBER", ((Map) p.get("n")).get("type"));
		assertEquals(Arrays.asList(5), ((Map) p.get("n")).get("enum"));
		assertEquals("BOOLEAN", ((Map) p.get("b")).get("type"));
		assertEquals(Arrays.asList(Boolean.TRUE), ((Map) p.get("b")).get("enum"));
		assertEquals("STRING", ((Map) p.get("s")).get("type"));
		assertEquals("STRING", ((Map) p.get("typed")).get("type"));
		assertEquals(Arrays.asList("y"), ((Map) p.get("typed")).get("enum"));
		for(Object v : p.values()) {
			String t = String.valueOf(((Map) v).get("type"));
			assertEquals(t.toUpperCase(java.util.Locale.ROOT), t);
			assertFalse("const 键不得下发 Gemini", ((Map) v).containsKey("const"));
		}
	}

	// [D87] tool_choice 三家形态:anthropic {type:none|auto} / gemini functionCallingConfig.mode NONE|AUTO / 非法值 ⇒ 不带;收口轮 anthropic/gemini 仍带 tools(只有 Ollama 没有 tool_choice 才不带)
	@Test
	public void anthropicAndGeminiToolChoiceNoneShapes() {
		assertEquals("none", AIToolCallSupport.toolChoiceForAnthropic("none").get("type"));
		assertEquals("auto", AIToolCallSupport.toolChoiceForAnthropic(" AUTO ").get("type"));
		assertNull(AIToolCallSupport.toolChoiceForAnthropic("required"));
		assertNull(AIToolCallSupport.toolChoiceForAnthropic(null));
		assertEquals("NONE", ((Map) AIToolCallSupport.toolConfigForGemini("none").get("functionCallingConfig")).get("mode"));
		assertEquals("AUTO", ((Map) AIToolCallSupport.toolConfigForGemini("auto").get("functionCallingConfig")).get("mode"));
		assertNull(AIToolCallSupport.toolConfigForGemini(""));
		assertNull(AIToolCallSupport.toolConfigForGemini("any"));
		Map<String, Object> ab = AIAnalysisProxyService.buildAnthropicBody("claude", map("providerType", "anthropic", "tools", neutralTools(), "toolChoice", "none"), neutralHistory(), true);
		assertEquals("none", ((Map) ab.get("tool_choice")).get("type"));
		assertEquals(1, ((List) ab.get("tools")).size());
		Map<String, Object> gb = AIAnalysisProxyService.buildGeminiBody(map("providerType", "gemini", "tools", neutralTools(), "toolChoice", "none"), neutralHistory());
		assertEquals("NONE", ((Map) ((Map) gb.get("toolConfig")).get("functionCallingConfig")).get("mode"));
		assertEquals(1, ((List) gb.get("tools")).size());
		Map<String, Object> gbAuto = AIAnalysisProxyService.buildGeminiBody(map("providerType", "gemini", "tools", neutralTools()), neutralHistory());
		assertNull("未给 toolChoice 不带 toolConfig", gbAuto.get("toolConfig"));
	}

	// [D87] OpenAI 兼容口:tool_choice 只在带 tools 时出现;无 tools 即使 toolChoice=none 也不出现(否则上游 400);非法值不带
	@Test
	public void openAIToolChoiceKeyPresentOnlyWhenTools() {
		Map<String, Object> with = AIAnalysisProxyService.buildOpenAIChatBody("gpt-4.1", map("providerType", "openai", "tools", neutralTools(), "toolChoice", "none"), neutralHistory(), true);
		assertEquals("none", with.get("tool_choice"));
		assertEquals(1, ((List) with.get("tools")).size());
		Map<String, Object> without = AIAnalysisProxyService.buildOpenAIChatBody("gpt-4.1", map("providerType", "openai", "toolChoice", "none"), neutralHistory(), true);
		assertFalse(without.containsKey("tool_choice"));
		assertFalse(without.containsKey("tools"));
		Map<String, Object> weird = AIAnalysisProxyService.buildOpenAIChatBody("gpt-4.1", map("providerType", "openai", "tools", neutralTools(), "toolChoice", "required"), neutralHistory(), true);
		assertFalse("非法 toolChoice 不带键(让上游按缺省 auto)", weird.containsKey("tool_choice"));
		assertEquals(1, ((List) weird.get("tools")).size());
	}

	// [D87] 参数流式期间零正文帧:每片参数发 tool_call_delta 续命(只含 id/index/chars,不含半截 JSON);空片不发;拼装结果完整
	@Test
	public void toolCallDeltaKeepAliveEmittedWhileArgumentsStream() {
		AIToolCallSupport.ToolCallAccumulator acc = new AIToolCallSupport.ToolCallAccumulator("openai");
		String head = "{\"na";
		List<AIToolCallSupport.SseEvent> first = acc.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map("tool_calls", Arrays.asList(map("index", 0, "id", "call_k", "type", "function", "function", map("name", "create_chart_record", "arguments", head))))))));
		assertEquals(1, first.size());
		assertEquals("tool_call_start", first.get(0).name);
		int chars = 0;
		String[] pieces = { "me\":\"张", "三\",\"gen", "der\":\"男\"}" };
		for(String piece : pieces) {
			List<AIToolCallSupport.SseEvent> ev = acc.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map("tool_calls", Arrays.asList(map("index", 0, "function", map("arguments", piece))))))));
			assertEquals(1, ev.size());
			assertEquals("tool_call_delta", ev.get(0).name);
			assertEquals("call_k", ev.get(0).payload.get("id"));
			assertEquals(Integer.valueOf(0), ev.get(0).payload.get("index"));
			assertEquals(Integer.valueOf(piece.length()), ev.get(0).payload.get("chars"));
			assertFalse("续命帧不得携带半截 JSON", ev.get(0).payload.containsKey("arguments"));
			chars += piece.length();
		}
		acc.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map(), "finish_reason", "tool_calls"))));
		AIToolCallSupport.StreamOutcome outcome = new AIToolCallSupport.StreamOutcome();
		List<AIToolCallSupport.SseEvent> fin = acc.finish(outcome);
		assertEquals(1, fin.size());
		assertEquals("tool_call", fin.get(0).name);
		assertEquals("{\"name\":\"张三\",\"gender\":\"男\"}", fin.get(0).payload.get("arguments"));
		assertEquals(head.length() + chars, ((String) fin.get(0).payload.get("arguments")).length());
		assertEquals(1, outcome.toolCallCount);
		// 空参数片(arguments:"")不发续命帧(零进展)
		AIToolCallSupport.ToolCallAccumulator acc2 = new AIToolCallSupport.ToolCallAccumulator("openai");
		acc2.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map("tool_calls", Arrays.asList(map("index", 0, "id", "c2", "function", map("name", "x", "arguments", ""))))))));
		List<AIToolCallSupport.SseEvent> none = acc2.onOpenAIPayload(map("choices", Arrays.asList(map("delta", map("tool_calls", Arrays.asList(map("index", 0, "function", map("arguments", ""))))))));
		assertTrue(none.isEmpty());
	}

	// [D87] Anthropic redacted_thinking 块(无明文、只有 data)收进 providerMeta.anthropicBlocks,与 thinking 块保持顺序;同模型回放原样进 assistant 内容块
	@Test
	public void redactedThinkingBlocksCollected() {
		AIToolCallSupport.ToolCallAccumulator acc = new AIToolCallSupport.ToolCallAccumulator("anthropic");
		acc.onAnthropicEvent("content_block_start", map("type", "content_block_start", "index", 0, "content_block", map("type", "redacted_thinking", "data", "RED-1")));
		acc.onAnthropicEvent("content_block_stop", map("type", "content_block_stop", "index", 0));
		acc.onAnthropicEvent("content_block_start", map("type", "content_block_start", "index", 1, "content_block", map("type", "thinking", "thinking", "")));
		acc.onAnthropicEvent("content_block_delta", map("type", "content_block_delta", "index", 1, "delta", map("type", "thinking_delta", "thinking", "plan")));
		acc.onAnthropicEvent("content_block_delta", map("type", "content_block_delta", "index", 1, "delta", map("type", "signature_delta", "signature", "S2")));
		acc.onAnthropicEvent("content_block_stop", map("type", "content_block_stop", "index", 1));
		acc.onAnthropicEvent("content_block_start", map("type", "content_block_start", "index", 2, "content_block", map("type", "text", "text", "")));
		acc.onAnthropicEvent("message_delta", map("type", "message_delta", "delta", map("stop_reason", "end_turn")));
		AIToolCallSupport.StreamOutcome outcome = new AIToolCallSupport.StreamOutcome();
		assertTrue(acc.finish(outcome).isEmpty());
		assertEquals("stop", outcome.finishReason);
		List blocks = (List) outcome.providerMeta.get("anthropicBlocks");
		assertEquals(2, blocks.size());
		assertEquals("redacted_thinking", ((Map) blocks.get(0)).get("type"));
		assertEquals("RED-1", ((Map) blocks.get(0)).get("data"));
		assertFalse(((Map) blocks.get(0)).containsKey("thinking"));
		assertEquals("thinking", ((Map) blocks.get(1)).get("type"));
		assertEquals("plan", ((Map) blocks.get(1)).get("thinking"));
		assertEquals("S2", ((Map) blocks.get(1)).get("signature"));
		Map<String, Object> original = map("providerMeta", map("anthropicBlocks", blocks, "model", "claude-x"), "toolCalls", new ArrayList<Object>());
		List<Object> replay = AIToolCallSupport.anthropicAssistantBlocks(original, "正文", true, "claude-x");
		assertEquals(3, replay.size());
		assertEquals("redacted_thinking", ((Map) replay.get(0)).get("type"));
		assertEquals("RED-1", ((Map) replay.get(0)).get("data"));
		assertEquals("thinking", ((Map) replay.get(1)).get("type"));
		assertEquals("text", ((Map) replay.get(2)).get("type"));
		// 跨模型 / 思考档关:两类块都不回放
		assertEquals(1, AIToolCallSupport.anthropicAssistantBlocks(original, "正文", true, "claude-y").size());
		assertEquals(1, AIToolCallSupport.anthropicAssistantBlocks(original, "正文", false, "claude-x").size());
	}

	// [D87] normalizeToolCalls:args 坏 JSON ⇒ {}(不抛、不丢项);缺 id 补 call_n;非 Map 项跳过;args 对象拷贝
	@Test
	public void normalizeToolCallsBadJsonBecomesEmptyObject() {
		List<Object> raw = new ArrayList<Object>();
		raw.add(map("id", "c1", "name", "create_chart_record", "args", "{not json"));
		raw.add("garbage");
		raw.add(map("name", "list_records", "args", map("limit", 5)));
		raw.add(map("id", "  ", "name", "get_current_context", "args", "{\"k\":1}"));
		List<Map<String, Object>> out = AIToolCallSupport.normalizeToolCalls(raw);
		assertEquals(3, out.size());
		assertEquals("c1", out.get(0).get("id"));
		assertEquals("create_chart_record", out.get(0).get("name"));
		assertTrue(((Map) out.get(0).get("args")).isEmpty());
		assertEquals("call_2", out.get(1).get("id"));   // 序号只数 Map 项(非 Map 项跳过不占号)
		assertEquals(5, ((Map) out.get(1).get("args")).get("limit"));
		assertEquals("call_3", out.get(2).get("id"));
		assertEquals(1, ((Map) out.get(2).get("args")).get("k"));
		assertTrue(AIToolCallSupport.normalizeToolCalls(null).isEmpty());
		assertTrue(AIToolCallSupport.normalizeToolCalls("x").isEmpty());
	}

	@Test
	public void anthropicThinkingEnabledTreatsAdaptiveAndAlwaysThinkingModels() {
		// [Q-024/Q-049] adaptive 与 enabled 同为开启;Fable/Mythos 恒开(与档案无关);disabled 为关。
		// [Q-047/M-58] 缺省(不带字段)按型号官方缺省:Sonnet 5 / Opus 5 缺省开(工具回合会回签名块,必须回放);Opus 4.6–4.8 / 预算族缺省关。
		Map<String, Object> adaptive = new LinkedHashMap<String, Object>();
		Map<String, Object> th = new LinkedHashMap<String, Object>();
		th.put("type", "adaptive");
		adaptive.put("thinking", th);
		assertTrue(AIToolCallSupport.anthropicThinkingEnabled(adaptive));
		assertTrue(AIToolCallSupport.anthropicThinkingEnabled(adaptive, "claude-sonnet-5"));
		assertTrue(AIToolCallSupport.anthropicThinkingEnabled(new LinkedHashMap<String, Object>(), "claude-fable-5-1"));
		assertTrue(AIToolCallSupport.anthropicThinkingEnabled(new LinkedHashMap<String, Object>(), "claude-opus-5"));
		assertFalse(AIToolCallSupport.anthropicThinkingEnabled(new LinkedHashMap<String, Object>(), "claude-opus-4-8"));
		assertFalse(AIToolCallSupport.anthropicThinkingEnabled(new LinkedHashMap<String, Object>(), "claude-haiku-4-5"));
		Map<String, Object> off = new LinkedHashMap<String, Object>();
		Map<String, Object> td = new LinkedHashMap<String, Object>();
		td.put("type", "disabled");
		off.put("thinking", td);
		assertFalse(AIToolCallSupport.anthropicThinkingEnabled(off, "claude-sonnet-5"));
		assertTrue(AIToolCallSupport.anthropicThinkingEnabled(off, "claude-mythos-5"));
	}
}
