package spacex.astrostudy.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import boundless.utility.JsonUtility;

/**
 * AI 助手·工具调用(function calling)协议翻译层。
 *
 * 前端只用一套中性形状:
 *   请求 params.tools=[{name,description,inputSchema}], params.toolChoice='auto'|'none'
 *   消息 {role:'assistant',content,toolCalls:[{id,name,args}],providerMeta?} / {role:'tool',toolResults:[{callId,name,content,isError}]}
 * 本类把它翻成四家原生形状(OpenAI 兼容 / Ollama 原生 / Anthropic / Gemini),并把四家流里的工具调用块
 * 累积成统一 SSE 事件:tool_call_start {id,name,index} → tool_call {id,name,index,arguments,parseError?};
 * 流末由 StreamOutcome 回填 done 事件的 finish_reason / tool_call_count / providerMeta。
 * 无 tools 且消息无工具字段时,本类零介入(各家 body 与旧金标逐键相同)。
 */
final class AIToolCallSupport {

	private AIToolCallSupport(){}

	/** 单条待发 SSE 事件。 */
	static final class SseEvent {
		final String name;
		final Map<String, Object> payload;
		SseEvent(String name, Map<String, Object> payload){ this.name = name; this.payload = payload; }
	}

	/** 一次流式请求的收尾摘要(chatStream 据此组 done 事件)。 */
	static final class StreamOutcome {
		int toolCallCount;
		String finishReason;
		Map<String, Object> providerMeta = new LinkedHashMap<String, Object>();
	}

	// ───────────────────────── 基础小件 ─────────────────────────

	static String str(Object o){
		return o == null ? "" : String.valueOf(o);
	}

	static String strVal(Map<?, ?> m, String key){
		return m == null ? "" : str(m.get(key));
	}

	@SuppressWarnings("rawtypes")
	static boolean hasToolCalls(Map<?, ?> msg){
		Object v = msg == null ? null : msg.get("toolCalls");
		return v instanceof List && !((List) v).isEmpty();
	}

	@SuppressWarnings("rawtypes")
	static boolean hasToolResults(Map<?, ?> msg){
		Object v = msg == null ? null : msg.get("toolResults");
		return v instanceof List && !((List) v).isEmpty();
	}

	static boolean hasToolFields(Map<?, ?> msg){
		return hasToolCalls(msg) || hasToolResults(msg);
	}

	/** 归一 toolCalls:每项 {id,name,args(Map)};args 允许对象或 JSON 串;缺 id 补 call_n。 */
	@SuppressWarnings({"rawtypes", "unchecked"})
	static List<Map<String, Object>> normalizeToolCalls(Object raw){
		List<Map<String, Object>> out = new ArrayList<Map<String, Object>>();
		if(!(raw instanceof List)) { return out; }
		int n = 0;
		for(Object item : (List) raw) {
			if(!(item instanceof Map)) { continue; }
			Map m = (Map) item;
			n++;
			Map<String, Object> c = new LinkedHashMap<String, Object>();
			String id = strVal(m, "id").trim();
			c.put("id", id.isEmpty() ? "call_" + n : id);
			c.put("name", strVal(m, "name"));
			Object args = m.get("args");
			if(args instanceof String) {
				Map parsed = null;
				try { parsed = JsonUtility.toDictionary((String) args); } catch(Exception ignore) { parsed = null; }
				args = parsed;
			}
			c.put("args", args instanceof Map ? new LinkedHashMap<String, Object>((Map) args) : new LinkedHashMap<String, Object>());
			out.add(c);
		}
		return out;
	}

	/** 归一 toolResults:每项 {callId,name,content(String),isError(boolean)}。 */
	@SuppressWarnings("rawtypes")
	static List<Map<String, Object>> normalizeToolResults(Object raw){
		List<Map<String, Object>> out = new ArrayList<Map<String, Object>>();
		if(!(raw instanceof List)) { return out; }
		for(Object item : (List) raw) {
			if(!(item instanceof Map)) { continue; }
			Map m = (Map) item;
			Map<String, Object> r = new LinkedHashMap<String, Object>();
			r.put("callId", strVal(m, "callId"));
			r.put("name", strVal(m, "name"));
			Object content = m.get("content");
			r.put("content", content instanceof String ? content : (content == null ? "" : JsonUtility.encode(content)));
			r.put("isError", Boolean.TRUE.equals(m.get("isError")));
			out.add(r);
		}
		return out;
	}

	@SuppressWarnings("rawtypes")
	static List<Map<String, Object>> toolCallsOf(Map<?, ?> msg){
		return normalizeToolCalls(msg == null ? null : msg.get("toolCalls"));
	}

	@SuppressWarnings("rawtypes")
	static List<Map<String, Object>> toolResultsOf(Map<?, ?> msg){
		return normalizeToolResults(msg == null ? null : msg.get("toolResults"));
	}

	@SuppressWarnings("rawtypes")
	static Map<String, Object> providerMetaOf(Map<?, ?> msg){
		Object pm = msg == null ? null : msg.get("providerMeta");
		return pm instanceof Map ? (Map<String, Object>) pm : new LinkedHashMap<String, Object>();
	}

	static String argsJson(Object args){
		if(args instanceof String) { return (String) args; }
		return JsonUtility.encode(args == null ? new LinkedHashMap<String, Object>() : args);
	}

	/** 中性工具表:每项 {name,description,inputSchema};非法项丢弃。 */
	@SuppressWarnings("rawtypes")
	static List<Map<String, Object>> neutralTools(Object raw){
		List<Map<String, Object>> out = new ArrayList<Map<String, Object>>();
		if(!(raw instanceof List)) { return out; }
		for(Object item : (List) raw) {
			if(!(item instanceof Map)) { continue; }
			Map m = (Map) item;
			String name = strVal(m, "name").trim();
			if(name.isEmpty()) { continue; }
			Map<String, Object> t = new LinkedHashMap<String, Object>();
			t.put("name", name);
			t.put("description", strVal(m, "description"));
			Object schema = m.get("inputSchema");
			t.put("inputSchema", schema instanceof Map ? schema : defaultSchema());
			out.add(t);
		}
		return out;
	}

	private static Map<String, Object> defaultSchema(){
		Map<String, Object> s = new LinkedHashMap<String, Object>();
		s.put("type", "object");
		s.put("properties", new LinkedHashMap<String, Object>());
		return s;
	}

	static String toolChoiceNorm(Object tc){
		String s = str(tc).trim().toLowerCase();
		if("none".equals(s)) { return "none"; }
		if("auto".equals(s)) { return "auto"; }
		return "";
	}

	// ───────────────────────── OpenAI 兼容 / Ollama ─────────────────────────

	static List<Map<String, Object>> toolsForOpenAI(Object raw){
		List<Map<String, Object>> out = new ArrayList<Map<String, Object>>();
		for(Map<String, Object> t : neutralTools(raw)) {
			Map<String, Object> fn = new LinkedHashMap<String, Object>();
			fn.put("name", t.get("name"));
			fn.put("description", t.get("description"));
			fn.put("parameters", t.get("inputSchema"));
			Map<String, Object> item = new LinkedHashMap<String, Object>();
			item.put("type", "function");
			item.put("function", fn);
			out.add(item);
		}
		return out;
	}

	/**
	 * OpenAI 兼容消息:visionMessages 是 toOpenAIVisionMessages 的产物(与 originals 一一同序),
	 * 这里按 originals 的工具字段增补 tool_calls / 展开 role:tool 为 N 条 {role:'tool',tool_call_id,content}。
	 * deepseek=true 时把 providerMeta.reasoningContent 回填 reasoning_content(DeepSeek 工具续写硬要求)。
	 */
	static List<Map<String, Object>> openAIMessages(List<Map<String, Object>> visionMessages, List<Map<String, Object>> originals, boolean deepseek){
		boolean any = false;
		for(Map<String, Object> m : originals) { if(hasToolFields(m)) { any = true; break; } }
		if(!any) { return visionMessages; }
		List<Map<String, Object>> out = new ArrayList<Map<String, Object>>();
		for(int i = 0; i < visionMessages.size(); i++) {
			Map<String, Object> vm = visionMessages.get(i);
			Map<String, Object> om = i < originals.size() ? originals.get(i) : null;
			if(om != null && hasToolResults(om)) {
				for(Map<String, Object> r : toolResultsOf(om)) {
					Map<String, Object> tm = new LinkedHashMap<String, Object>();
					tm.put("role", "tool");
					tm.put("tool_call_id", r.get("callId"));
					tm.put("content", r.get("content"));
					out.add(tm);
				}
				continue;
			}
			if(om != null && hasToolCalls(om)) {
				Map<String, Object> am = new LinkedHashMap<String, Object>(vm);
				am.put("role", "assistant");
				List<Map<String, Object>> tcs = new ArrayList<Map<String, Object>>();
				for(Map<String, Object> c : toolCallsOf(om)) {
					Map<String, Object> fn = new LinkedHashMap<String, Object>();
					fn.put("name", c.get("name"));
					fn.put("arguments", argsJson(c.get("args")));
					Map<String, Object> tc = new LinkedHashMap<String, Object>();
					tc.put("id", c.get("id"));
					tc.put("type", "function");
					tc.put("function", fn);
					tcs.add(tc);
				}
				am.put("tool_calls", tcs);
				if(deepseek) {
					String rc = strVal(providerMetaOf(om), "reasoningContent");
					if(!rc.isEmpty()) { am.put("reasoning_content", rc); }
				}
				out.add(am);
				continue;
			}
			out.add(vm);
		}
		return out;
	}

	/** Ollama 原生:assistant.tool_calls=[{function:{name,arguments:<object>}}];结果 {role:'tool',content,tool_name}。 */
	static Map<String, Object> ollamaAssistantToolCalls(Map<String, Object> original){
		List<Map<String, Object>> tcs = new ArrayList<Map<String, Object>>();
		for(Map<String, Object> c : toolCallsOf(original)) {
			Map<String, Object> fn = new LinkedHashMap<String, Object>();
			fn.put("name", c.get("name"));
			fn.put("arguments", c.get("args"));
			Map<String, Object> tc = new LinkedHashMap<String, Object>();
			tc.put("function", fn);
			tcs.add(tc);
		}
		Map<String, Object> out = new LinkedHashMap<String, Object>();
		out.put("tool_calls", tcs);
		return out;
	}

	static List<Map<String, Object>> ollamaToolResultMessages(Map<String, Object> original){
		List<Map<String, Object>> out = new ArrayList<Map<String, Object>>();
		for(Map<String, Object> r : toolResultsOf(original)) {
			Map<String, Object> tm = new LinkedHashMap<String, Object>();
			tm.put("role", "tool");
			tm.put("content", r.get("content"));
			tm.put("tool_name", r.get("name"));
			out.add(tm);
		}
		return out;
	}

	// ───────────────────────── Anthropic ─────────────────────────

	static List<Map<String, Object>> toolsForAnthropic(Object raw){
		List<Map<String, Object>> out = new ArrayList<Map<String, Object>>();
		for(Map<String, Object> t : neutralTools(raw)) {
			Map<String, Object> item = new LinkedHashMap<String, Object>();
			item.put("name", t.get("name"));
			item.put("description", t.get("description"));
			item.put("input_schema", t.get("inputSchema"));
			out.add(item);
		}
		return out;
	}

	static Map<String, Object> toolChoiceForAnthropic(Object tc){
		String s = toolChoiceNorm(tc);
		if(s.isEmpty()) { return null; }
		Map<String, Object> out = new LinkedHashMap<String, Object>();
		out.put("type", s);
		return out;
	}

	@SuppressWarnings("rawtypes")
	static boolean anthropicThinkingEnabled(Map<String, Object> providerOptions){
		return anthropicThinkingEnabled(providerOptions, null);
	}

	/** [Q-024/Q-049] adaptive(Opus 4.7 起 / Sonnet 5 / Fable 系的官方形态)与 enabled 同为「开启」;Fable/Mythos 思考恒开、
	 *  与档案里写不写 thinking 无关 —— 三者的带 tool_use 回合都必须回放签名 thinking 块(上游硬约束)。 */
	@SuppressWarnings("rawtypes")
	static boolean anthropicThinkingEnabled(Map<String, Object> providerOptions, String model){
		if(AIAnalysisProxyService.anthropicAlwaysThinking(model)) { return true; }
		Object th = providerOptions == null ? null : providerOptions.get("thinking");
		// [Q-047/M-58] 不带 thinking 字段 ≠ 关闭:Sonnet 5 / Opus 5 官方缺省即开思考(工具回合会回签名块),此前按「未开启」不回放 →
		//   多轮工具回合丢块。按型号缺省判(Opus 4.6–4.8 / Sonnet 4.6 缺省关;预算族不带即关);显式 disabled 才是关。
		if(!(th instanceof Map)) { return AIAnalysisProxyService.anthropicThinkingDefaultOn(model); }
		String type = str(((Map) th).get("type"));
		return "enabled".equals(type) || "adaptive".equals(type);
	}

	/** assistant 内容块:[thinking/redacted_thinking(思考档开启且有签名块时)] + text(非空) + tool_use。 */
	@SuppressWarnings({"rawtypes", "unchecked"})
	static List<Object> anthropicAssistantBlocks(Map<String, Object> original, String content, boolean thinkingEnabled){
		return anthropicAssistantBlocks(original, content, thinkingEnabled, null);
	}

	/** model 非空且 providerMeta.model 存在但不同 → 不回放 thinking 块(签名与模型绑定,跨模型回放上游报 invalid signature)。 */
	@SuppressWarnings({"rawtypes", "unchecked"})
	static List<Object> anthropicAssistantBlocks(Map<String, Object> original, String content, boolean thinkingEnabled, String model){
		List<Object> blocks = new ArrayList<Object>();
		String metaModel = strVal(providerMetaOf(original), "model");
		boolean sameModel = model == null || model.isEmpty() || metaModel.isEmpty() || metaModel.equals(model);
		if(thinkingEnabled && sameModel) {
			Object tb = providerMetaOf(original).get("anthropicBlocks");
			if(tb instanceof List) {
				for(Object b : (List) tb) {
					if(b instanceof Map) {
						String type = str(((Map) b).get("type"));
						if("thinking".equals(type) || "redacted_thinking".equals(type)) { blocks.add(new LinkedHashMap<String, Object>((Map) b)); }
					}
				}
			}
		}
		if(content != null && !content.trim().isEmpty()) {
			Map<String, Object> text = new LinkedHashMap<String, Object>();
			text.put("type", "text");
			text.put("text", content);
			blocks.add(text);
		}
		for(Map<String, Object> c : toolCallsOf(original)) {
			Map<String, Object> tu = new LinkedHashMap<String, Object>();
			tu.put("type", "tool_use");
			tu.put("id", c.get("id"));
			tu.put("name", c.get("name"));
			tu.put("input", c.get("args"));
			blocks.add(tu);
		}
		return blocks;
	}

	static List<Object> anthropicToolResultBlocks(Map<String, Object> original){
		List<Object> blocks = new ArrayList<Object>();
		for(Map<String, Object> r : toolResultsOf(original)) {
			Map<String, Object> tr = new LinkedHashMap<String, Object>();
			tr.put("type", "tool_result");
			tr.put("tool_use_id", r.get("callId"));
			tr.put("content", r.get("content"));
			if(Boolean.TRUE.equals(r.get("isError"))) { tr.put("is_error", Boolean.TRUE); }
			blocks.add(tr);
		}
		return blocks;
	}

	// ───────────────────────── Gemini ─────────────────────────

	static List<Map<String, Object>> toolsForGemini(Object raw){
		List<Map<String, Object>> decls = new ArrayList<Map<String, Object>>();
		for(Map<String, Object> t : neutralTools(raw)) {
			Map<String, Object> d = new LinkedHashMap<String, Object>();
			d.put("name", t.get("name"));
			d.put("description", t.get("description"));
			d.put("parameters", sanitizeGeminiSchema(t.get("inputSchema")));
			decls.add(d);
		}
		List<Map<String, Object>> out = new ArrayList<Map<String, Object>>();
		if(!decls.isEmpty()) {
			Map<String, Object> item = new LinkedHashMap<String, Object>();
			item.put("functionDeclarations", decls);
			out.add(item);
		}
		return out;
	}

	static Map<String, Object> toolConfigForGemini(Object tc){
		String s = toolChoiceNorm(tc);
		if(s.isEmpty()) { return null; }
		Map<String, Object> cfg = new LinkedHashMap<String, Object>();
		cfg.put("mode", "none".equals(s) ? "NONE" : "AUTO");
		Map<String, Object> out = new LinkedHashMap<String, Object>();
		out.put("functionCallingConfig", cfg);
		return out;
	}

	private static final List<String> GEMINI_DROP_KEYS = Arrays.asList(
		"$schema", "$id", "$comment", "additionalProperties", "examples", "default", "allOf", "oneOf", "if", "then", "else",
		"minProperties", "maxProperties", "patternProperties", "dependencies", "const", "title");

	/**
	 * Gemini 只收 OpenAPI 子集:剥 $schema/$id/additionalProperties/examples/default/allOf/oneOf/if-then-else/const 等;
	 * type 数组 → 取首个非 null 类型并在含 null 时打 nullable:true;const → enum 单值。递归处理 properties/items/anyOf。
	 */
	private static final int GEMINI_SCHEMA_MAX_DEPTH = 48;

	static Object sanitizeGeminiSchema(Object schema){
		return sanitizeGeminiSchema(schema, 0);
	}

	// [D69] JSON Schema 类型名 → Gemini Type 枚举名(未知值原样保留,让上游按自己的规则报错而不是被我们吞掉)
	static String geminiTypeName(String t){
		String u = t == null ? "" : t.trim().toUpperCase(Locale.ROOT);
		if(u.equals("STRING") || u.equals("NUMBER") || u.equals("INTEGER") || u.equals("BOOLEAN") || u.equals("ARRAY") || u.equals("OBJECT")) { return u; }
		return t;
	}

	@SuppressWarnings({"rawtypes", "unchecked"})
	static Object sanitizeGeminiSchema(Object schema, int depth){
		// 深度硬顶:递归结构(items/anyOf/properties)来自工具目录,正常深度个位数;超顶按「任意字符串」收口,
		// 绝不让一个病态 schema 把代理线程打成 StackOverflowError(压测实抓)。
		if(depth > GEMINI_SCHEMA_MAX_DEPTH) {
			Map<String, Object> capped = new LinkedHashMap<String, Object>();
			capped.put("type", "STRING");
			return capped;
		}
		if(schema instanceof List) {
			List<Object> out = new ArrayList<Object>();
			for(Object o : (List) schema) { out.add(sanitizeGeminiSchema(o, depth + 1)); }
			return out;
		}
		if(!(schema instanceof Map)) { return schema; }
		Map in = (Map) schema;
		Map<String, Object> out = new LinkedHashMap<String, Object>();
		Object constVal = in.get("const");
		for(Object k : in.keySet()) {
			String key = str(k);
			if(GEMINI_DROP_KEYS.contains(key)) { continue; }
			Object v = in.get(k);
			if("type".equals(key) && v instanceof List) {
				String picked = null;
				boolean nullable = false;
				for(Object t : (List) v) {
					String ts = str(t);
					if("null".equals(ts)) { nullable = true; } else if(picked == null) { picked = ts; }
				}
				if(picked != null) { out.put("type", geminiTypeName(picked)); }
				if(nullable) { out.put("nullable", Boolean.TRUE); }
				continue;
			}
			// [D69] Gemini Schema.type 是枚举 TYPE_UNSPECIFIED/STRING/NUMBER/INTEGER/BOOLEAN/ARRAY/OBJECT(discovery v1beta 只列大写);
			//   工具目录是 JSON Schema 小写 → 一律按官方枚举名下发(官方 schema 校验实抓小写不合枚举)
			if("type".equals(key) && v instanceof String) {
				if("null".equals(v)) { out.put("nullable", Boolean.TRUE); continue; }
				out.put("type", geminiTypeName((String) v));
				continue;
			}
			if("properties".equals(key) && v instanceof Map) {
				Map<String, Object> props = new LinkedHashMap<String, Object>();
				for(Object pk : ((Map) v).keySet()) { props.put(str(pk), sanitizeGeminiSchema(((Map) v).get(pk), depth + 1)); }
				out.put("properties", props);
				continue;
			}
			if("items".equals(key) || "anyOf".equals(key)) {
				out.put(key, sanitizeGeminiSchema(v, depth + 1));
				continue;
			}
			out.put(key, v);
		}
		if(constVal != null && !out.containsKey("enum")) {
			out.put("enum", Arrays.asList(constVal));
			// [D76] 推断出的类型同样走 Gemini 枚举名(D69 大写归一漏了这条支路:const 无 type ⇒ 小写 "number"/"boolean"/"string" 不合枚举)
			if(!out.containsKey("type")) { out.put("type", geminiTypeName(constVal instanceof Number ? "number" : (constVal instanceof Boolean ? "boolean" : "string"))); }
		}
		return out;
	}

	@SuppressWarnings("rawtypes")
	static List<Object> geminiAssistantParts(Map<String, Object> original, String content){
		List<Object> parts = new ArrayList<Object>();
		if(content != null && !content.trim().isEmpty()) {
			Map<String, Object> text = new LinkedHashMap<String, Object>();
			text.put("text", content);
			parts.add(text);
		}
		Map<String, Object> meta = providerMetaOf(original);
		Object sigs = meta.get("thoughtSignatures");
		for(Map<String, Object> c : toolCallsOf(original)) {
			Map<String, Object> fc = new LinkedHashMap<String, Object>();
			fc.put("name", c.get("name"));
			fc.put("args", c.get("args"));
			Map<String, Object> part = new LinkedHashMap<String, Object>();
			part.put("functionCall", fc);
			if(sigs instanceof Map) {
				String sig = str(((Map) sigs).get(c.get("id")));
				if(!sig.isEmpty()) { part.put("thoughtSignature", sig); }
			}
			parts.add(part);
		}
		return parts;
	}

	static List<Object> geminiToolResultParts(Map<String, Object> original){
		List<Object> parts = new ArrayList<Object>();
		for(Map<String, Object> r : toolResultsOf(original)) {
			Map<String, Object> response = new LinkedHashMap<String, Object>();
			response.put("result", r.get("content"));
			if(Boolean.TRUE.equals(r.get("isError"))) { response.put("isError", Boolean.TRUE); }
			Map<String, Object> fr = new LinkedHashMap<String, Object>();
			fr.put("name", r.get("name"));
			fr.put("response", response);
			Map<String, Object> part = new LinkedHashMap<String, Object>();
			part.put("functionResponse", fr);
			parts.add(part);
		}
		return parts;
	}

	// ───────────────────────── 流式累积器 ─────────────────────────

	/**
	 * 四家流的工具调用累积器(每次流式请求一个实例)。
	 * OpenAI 兼容:按 choices[0].delta.tool_calls[].index 拼 function.arguments,首见发 tool_call_start,流末 finish() 发 tool_call;
	 * Ollama 原生:message.tool_calls 整块到达,即刻 start+tool_call(id 合成 call_n);
	 * Anthropic:content_block_start(tool_use) → input_json_delta 拼 → content_block_stop 发 tool_call;thinking/redacted 块收进 providerMeta.anthropicBlocks;
	 * Gemini:parts[].functionCall 整块到达,即刻 start+tool_call;part.thoughtSignature 收进 providerMeta.thoughtSignatures[callId]。
	 */
	static final class ToolCallAccumulator {
		private static final int REASONING_CAP = 65536;
		private final String providerType;
		private final Map<Integer, Pending> pendingByIndex = new LinkedHashMap<Integer, Pending>();
		private final List<Map<String, Object>> anthropicBlocks = new ArrayList<Map<String, Object>>();
		private final Map<Integer, Map<String, Object>> anthropicThinking = new LinkedHashMap<Integer, Map<String, Object>>();
		private final Map<String, String> thoughtSignatures = new LinkedHashMap<String, String>();
		private final StringBuilder reasoning = new StringBuilder();
		private String mappedFinish = null;
		private int emitted = 0;
		private int synthetic = 0;

		private static final class Pending {
			String id;
			String name;
			int index;
			final StringBuilder args = new StringBuilder();
			boolean started;
		}

		ToolCallAccumulator(String providerType){
			this.providerType = providerType == null ? "" : providerType.trim().toLowerCase();
		}

		int emittedCount(){ return emitted; }

		private String nextSyntheticId(){
			synthetic++;
			return "call_" + synthetic;
		}

		private static Map<String, Object> startPayload(String id, String name, int index){
			Map<String, Object> p = new LinkedHashMap<String, Object>();
			p.put("id", id);
			p.put("name", name);
			p.put("index", index);
			return p;
		}

		@SuppressWarnings("rawtypes")
		private Map<String, Object> callPayload(String id, String name, int index, String argumentsText){
			Map<String, Object> p = startPayload(id, name, index);
			String a = argumentsText == null || argumentsText.trim().isEmpty() ? "{}" : argumentsText.trim();
			p.put("arguments", a);
			try {
				Map parsed = JsonUtility.toDictionary(a);
				if(parsed == null) { p.put("parseError", "arguments is not a JSON object"); }
			} catch(Exception e) {
				p.put("parseError", cleanParseError(e.getMessage()));
			}
			emitted++;
			return p;
		}

		/** 解析错误文案给用户/模型看:剥掉 Jackson 异常类名前缀与 "at [Source: …]" 定位尾巴(动作条曾直接显示 com.fasterxml… 全名)。 */
		static String cleanParseError(String raw){
			String s = raw == null ? "" : raw.trim();
			if(s.isEmpty()) { return "bad json"; }
			// 可能层层包裹:「com.x.y.SomeException: com.x.z.Other: 正文」
			while(true) {
				java.util.regex.Matcher m = java.util.regex.Pattern.compile("^(?:[A-Za-z_$][\\w$]*\\.)+[A-Za-z_$][\\w$]*(?:Exception|Error)(?::\\s*|\\s*$)").matcher(s);
				if(!m.find()) { break; }
				s = s.substring(m.end()).trim();
			}
			int at = s.indexOf("\n at [Source");
			if(at < 0) { at = s.indexOf(" at [Source"); }
			if(at > 0) { s = s.substring(0, at).trim(); }
			return s.isEmpty() ? "bad json" : s;
		}

		private static String mapFinish(String raw){
			String s = raw == null ? "" : raw.trim().toLowerCase();
			if(s.isEmpty()) { return null; }
			if("tool_calls".equals(s) || "tool_use".equals(s) || "function_call".equals(s)) { return "tool_calls"; }
			if("length".equals(s) || "max_tokens".equals(s)) { return "length"; }
			if("stop".equals(s) || "end_turn".equals(s) || "stop_sequence".equals(s)) { return "stop"; }
			return s;
		}

		/** OpenAI 兼容 SSE 帧。 */
		@SuppressWarnings("rawtypes")
		List<SseEvent> onOpenAIPayload(Map<String, Object> payload){
			List<SseEvent> out = new ArrayList<SseEvent>();
			if(payload == null) { return out; }
			Object choicesObj = payload.get("choices");
			if(!(choicesObj instanceof List) || ((List) choicesObj).isEmpty()) { return out; }
			Object first = ((List) choicesObj).get(0);
			if(!(first instanceof Map)) { return out; }
			Map choice = (Map) first;
			String fr = str(choice.get("finish_reason"));
			if(!fr.isEmpty() && !"null".equals(fr)) { mappedFinish = mapFinish(fr); }
			Object deltaObj = choice.get("delta");
			if(!(deltaObj instanceof Map)) { return out; }
			Map delta = (Map) deltaObj;
			Object rc = delta.get("reasoning_content");
			if(rc == null) { rc = delta.get("reasoning"); }
			if(rc instanceof String && reasoning.length() < REASONING_CAP) { reasoning.append((String) rc); }
			Object tcs = delta.get("tool_calls");
			if(!(tcs instanceof List)) { return out; }
			int fallbackIndex = 0;
			for(Object item : (List) tcs) {
				if(!(item instanceof Map)) { continue; }
				Map tc = (Map) item;
				Object idxObj = tc.get("index");
				int index = idxObj instanceof Number ? ((Number) idxObj).intValue() : fallbackIndex;
				fallbackIndex = index + 1;
				Pending p = pendingByIndex.get(index);
				if(p == null) {
					p = new Pending();
					p.index = index;
					pendingByIndex.put(index, p);
				}
				String id = strVal(tc, "id");
				if(!id.isEmpty()) { p.id = id; }
				Object fnObj = tc.get("function");
				int appended = 0;
				if(fnObj instanceof Map) {
					Map fn = (Map) fnObj;
					String name = strVal(fn, "name");
					if(!name.isEmpty() && (p.name == null || p.name.isEmpty())) { p.name = name; }
					Object args = fn.get("arguments");
					// 部分中转网关把 arguments 直接给对象(非串):整块序列化收下,不能静默丢成 {}
					if(args instanceof String) { p.args.append((String) args); appended = ((String) args).length(); }
					else if(args instanceof Map || args instanceof List) { String enc = JsonUtility.encode(args); p.args.append(enc); appended = enc.length(); }
				}
				if(!p.started && p.id != null && p.name != null && !p.name.isEmpty()) {
					p.started = true;
					out.add(new SseEvent("tool_call_start", startPayload(p.id, p.name, p.index)));
				} else if(appended > 0) {
					// 参数流式期间零正文帧,前端空闲看门狗只认真产出 → 每片发轻量 delta 续命(不含内容,防半截 JSON 外泄)
					Map<String, Object> d = new LinkedHashMap<String, Object>();
					d.put("id", p.id == null ? "" : p.id);
					d.put("index", p.index);
					d.put("chars", appended);
					out.add(new SseEvent("tool_call_delta", d));
				}
			}
			return out;
		}

		/** Ollama 原生 NDJSON 帧。 */
		@SuppressWarnings("rawtypes")
		List<SseEvent> onOllamaPayload(Map<String, Object> payload){
			List<SseEvent> out = new ArrayList<SseEvent>();
			if(payload == null) { return out; }
			String dr = str(payload.get("done_reason"));
			if(!dr.isEmpty()) { mappedFinish = mapFinish(dr); }
			Object msg = payload.get("message");
			if(!(msg instanceof Map)) { return out; }
			Object tcs = ((Map) msg).get("tool_calls");
			if(!(tcs instanceof List)) { return out; }
			for(Object item : (List) tcs) {
				if(!(item instanceof Map)) { continue; }
				Object fnObj = ((Map) item).get("function");
				if(!(fnObj instanceof Map)) { continue; }
				Map fn = (Map) fnObj;
				String name = strVal(fn, "name");
				if(name.isEmpty()) { continue; }
				String id = nextSyntheticId();
				int index = emitted;
				out.add(new SseEvent("tool_call_start", startPayload(id, name, index)));
				out.add(new SseEvent("tool_call", callPayload(id, name, index, argsJson(fn.get("arguments")))));
			}
			return out;
		}

		/** Anthropic SSE 帧(eventName 为 SSE event 名,payload.type 优先)。 */
		@SuppressWarnings("rawtypes")
		List<SseEvent> onAnthropicEvent(String eventName, Map<String, Object> payload){
			List<SseEvent> out = new ArrayList<SseEvent>();
			if(payload == null) { return out; }
			String type = strVal(payload, "type");
			if(type.isEmpty()) { type = eventName == null ? "" : eventName; }
			Object idxObj = payload.get("index");
			int index = idxObj instanceof Number ? ((Number) idxObj).intValue() : 0;
			if("content_block_start".equals(type)) {
				Object cb = payload.get("content_block");
				if(cb instanceof Map) {
					String bt = strVal((Map) cb, "type");
					if("tool_use".equals(bt)) {
						Pending p = new Pending();
						p.index = index;
						p.id = strVal((Map) cb, "id");
						if(p.id.isEmpty()) { p.id = nextSyntheticId(); }
						p.name = strVal((Map) cb, "name");
						p.started = true;
						// 非流式转流式的代理会把完整 input 放在 block_start 里而不再发 delta:以它作种子
						Object seed = ((Map) cb).get("input");
						if(seed instanceof Map && !((Map) seed).isEmpty()) { p.args.append(JsonUtility.encode(seed)); }
						pendingByIndex.put(index, p);
						out.add(new SseEvent("tool_call_start", startPayload(p.id, p.name, p.index)));
					} else if("thinking".equals(bt)) {
						Map<String, Object> blk = new LinkedHashMap<String, Object>();
						blk.put("type", "thinking");
						blk.put("thinking", new StringBuilder());
						blk.put("signature", "");
						anthropicThinking.put(index, blk);
					} else if("redacted_thinking".equals(bt)) {
						Map<String, Object> blk = new LinkedHashMap<String, Object>();
						blk.put("type", "redacted_thinking");
						blk.put("data", str(((Map) cb).get("data")));
						anthropicBlocks.add(blk);
					}
				}
			} else if("content_block_delta".equals(type)) {
				Object d = payload.get("delta");
				if(d instanceof Map) {
					String dt = strVal((Map) d, "type");
					if("input_json_delta".equals(dt)) {
						Pending p = pendingByIndex.get(index);
						if(p != null) {
							String piece = str(((Map) d).get("partial_json"));
							p.args.append(piece);
							Map<String, Object> dl = new LinkedHashMap<String, Object>();
							dl.put("id", p.id); dl.put("index", p.index); dl.put("chars", piece.length());
							out.add(new SseEvent("tool_call_delta", dl));
						}
					} else if("thinking_delta".equals(dt)) {
						Map<String, Object> blk = anthropicThinking.get(index);
						if(blk != null) { ((StringBuilder) blk.get("thinking")).append(str(((Map) d).get("thinking"))); }
					} else if("signature_delta".equals(dt)) {
						Map<String, Object> blk = anthropicThinking.get(index);
						if(blk != null) { blk.put("signature", str(blk.get("signature")) + str(((Map) d).get("signature"))); }
					}
				}
			} else if("content_block_stop".equals(type)) {
				Pending p = pendingByIndex.remove(index);
				if(p != null) {
					out.add(new SseEvent("tool_call", callPayload(p.id, p.name, p.index, p.args.toString())));
				}
				Map<String, Object> blk = anthropicThinking.remove(index);
				if(blk != null) {
					Map<String, Object> done = new LinkedHashMap<String, Object>();
					done.put("type", "thinking");
					done.put("thinking", blk.get("thinking").toString());
					done.put("signature", str(blk.get("signature")));
					anthropicBlocks.add(done);
				}
			} else if("message_delta".equals(type)) {
				Object d = payload.get("delta");
				if(d instanceof Map) {
					String sr = strVal((Map) d, "stop_reason");
					if(!sr.isEmpty()) { mappedFinish = mapFinish(sr); }
				}
			}
			return out;
		}

		/** Gemini SSE 帧。 */
		@SuppressWarnings("rawtypes")
		List<SseEvent> onGeminiPayload(Map<String, Object> payload){
			List<SseEvent> out = new ArrayList<SseEvent>();
			if(payload == null) { return out; }
			Object candidatesObj = payload.get("candidates");
			if(!(candidatesObj instanceof List) || ((List) candidatesObj).isEmpty()) { return out; }
			Object first = ((List) candidatesObj).get(0);
			if(!(first instanceof Map)) { return out; }
			String fr = strVal((Map) first, "finishReason");
			if(!fr.isEmpty()) { mappedFinish = mapFinish(fr); }
			Object content = ((Map) first).get("content");
			if(!(content instanceof Map)) { return out; }
			Object parts = ((Map) content).get("parts");
			if(!(parts instanceof List)) { return out; }
			for(Object part : (List) parts) {
				if(!(part instanceof Map)) { continue; }
				Object fc = ((Map) part).get("functionCall");
				if(!(fc instanceof Map)) { continue; }
				String name = strVal((Map) fc, "name");
				if(name.isEmpty()) { continue; }
				String id = nextSyntheticId();
				int index = emitted;
				String sig = strVal((Map) part, "thoughtSignature");
				if(!sig.isEmpty()) { thoughtSignatures.put(id, sig); }
				out.add(new SseEvent("tool_call_start", startPayload(id, name, index)));
				out.add(new SseEvent("tool_call", callPayload(id, name, index, argsJson(((Map) fc).get("args")))));
			}
			return out;
		}

		/** 流末:冲刷 OpenAI 型待发调用,回填 outcome。 */
		List<SseEvent> finish(StreamOutcome outcome){
			List<SseEvent> out = new ArrayList<SseEvent>();
			for(Pending p : pendingByIndex.values()) {
				if(p.name == null || p.name.isEmpty()) { continue; }
				if(p.id == null || p.id.isEmpty()) { p.id = nextSyntheticId(); }
				if(!p.started) { out.add(new SseEvent("tool_call_start", startPayload(p.id, p.name, p.index))); }
				out.add(new SseEvent("tool_call", callPayload(p.id, p.name, p.index, p.args.toString())));
			}
			pendingByIndex.clear();
			if(outcome != null) {
				outcome.toolCallCount = emitted;
				outcome.finishReason = emitted > 0 ? "tool_calls" : (mappedFinish == null ? "stop" : mappedFinish);
				if(!anthropicBlocks.isEmpty()) { outcome.providerMeta.put("anthropicBlocks", new ArrayList<Map<String, Object>>(anthropicBlocks)); }
				if(!thoughtSignatures.isEmpty()) { outcome.providerMeta.put("thoughtSignatures", new LinkedHashMap<String, String>(thoughtSignatures)); }
				if(emitted > 0 && "deepseek".equals(providerType) && reasoning.length() > 0) { outcome.providerMeta.put("reasoningContent", reasoning.toString()); }
			}
			return out;
		}
	}
}
