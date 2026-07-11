package spacex.astrostudy.service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ProxySelector;
import java.net.Socket;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import boundless.exception.ErrorCodeException;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.interceptor.SseHelper;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

@Service
public class AIAnalysisProxyService {

	private static final String DEFAULT_OPENAI_BASE = "https://api.openai.com/v1";
	private static final String DEFAULT_DEEPSEEK_BASE = "https://api.deepseek.com";
	private static final String DEFAULT_OPENROUTER_BASE = "https://openrouter.ai/api/v1";
	private static final String DEFAULT_OLLAMA_BASE = "http://127.0.0.1:11434/v1";
	private static final String DEFAULT_ANTHROPIC_BASE = "https://api.anthropic.com";
	private static final String DEFAULT_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
	private static final String DEFAULT_MOONSHOT_BASE = "https://api.moonshot.cn/v1";
	private static final String DEFAULT_ZHIPU_BASE = "https://open.bigmodel.cn/api/paas/v4";
	private static final String DEFAULT_SILICONFLOW_BASE = "https://api.siliconflow.cn/v1";
	private static final String DEFAULT_GROQ_BASE = "https://api.groq.com/openai/v1";
	private static final String DEFAULT_XAI_BASE = "https://api.x.ai/v1";
	private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(120);

	// #9:流式 AI 请求经系统代理(配合启动器 -Djava.net.useSystemProxies=true)。
	// JDK HttpClient 不调用 .proxy() 时默认完全不走代理;此处显式取 ProxySelector.getDefault(),
	// 无系统代理时返回 DIRECT、localhost 自动 bypass,行为不变。
	private final HttpClient streamHttpClient = HttpClient.newBuilder()
		.connectTimeout(Duration.ofSeconds(15))
		.proxy(ProxySelector.getDefault())
		.followRedirects(HttpClient.Redirect.NORMAL)
		.build();

	// Issue #8 Fix 2: 长时 SSE 流的心跳调度池。Ollama 慢首 token 时若全程零字节，
	// 客户端/中间件会按空闲超时切断 socket → 后端首次 sendEvent 撞 ClientAbortException。
	// 每 15s 给 emitter 写一个 ": keep-alive" 注释帧，防止空闲断连。15s 安全门槛
	// 低于浏览器/中间件常见空闲阈值（30–60s）。
	private static final long SSE_HEARTBEAT_SECONDS = 15L;
	private static final ScheduledExecutorService SSE_HEARTBEAT_EXECUTOR = Executors.newScheduledThreadPool(2, r -> {
		Thread t = new Thread(r, "ai-analysis-sse-heartbeat");
		t.setDaemon(true);
		return t;
	});

	// 流式请求的工作线程池(有界):替代 controller 每请求 new Thread 的无界直建,
	// burst(脚本/重试风暴)下线程数被钳制;CallerRunsPolicy 超载时退化为同步执行而非丢任务。
	private static final java.util.concurrent.ThreadPoolExecutor STREAM_WORKER_POOL =
		new java.util.concurrent.ThreadPoolExecutor(
			2, 8, 60L, java.util.concurrent.TimeUnit.SECONDS,
			new java.util.concurrent.LinkedBlockingQueue<>(16),
			r -> { Thread t = new Thread(r, "ai-analysis-stream-worker"); t.setDaemon(true); return t; },
			new java.util.concurrent.ThreadPoolExecutor.CallerRunsPolicy());

	public static java.util.concurrent.Executor streamWorkerPool(){
		return STREAM_WORKER_POOL;
	}

	// 优雅停机:Spring 上下文关闭时收掉心跳池与流工作池(daemon 线程不阻塞 JVM,
	// 但显式 shutdown 让停机路径可观测、避免半截任务悬挂)。
	@javax.annotation.PreDestroy
	void shutdownExecutors(){
		SSE_HEARTBEAT_EXECUTOR.shutdownNow();
		STREAM_WORKER_POOL.shutdownNow();
	}

	@FunctionalInterface
	private interface StreamBody {
		void run() throws Exception;
	}

	/**
	 * 修复 #10(A):SseEmitter.send()/complete() 非线程安全。心跳线程(每 15s)与读流线程并发写
	 * 同一 emitter、且心跳失败时自行 complete,会与读流的 send 撞 "ResponseBodyEmitter has already
	 * completed"(见 sendEvent)→ 断流(deepseek-reasoner 长流「几句话之后就停止」)。SseChannel 用
	 * 单锁串行化所有写;complete/completeWithError 幂等;一旦关闭,后续 send 返回 false(不抛、也不再
	 * complete),心跳与读流再不会互相踩。
	 */
	private static final class SseChannel {
		private final SseEmitter emitter;
		private final Object lock = new Object();
		private boolean closed = false;

		SseChannel(SseEmitter emitter) {
			this.emitter = emitter;
		}

		/** 线程安全发送;已关闭返回 false(不抛)。底层发送失败(客户端已断)则标记关闭并上抛,供上层进 catch 记日志。 */
		boolean send(SseEmitter.SseEventBuilder event) throws IOException {
			synchronized (lock) {
				if (closed) {
					return false;
				}
				try {
					emitter.send(event);
					return true;
				} catch (IOException | RuntimeException e) {
					closed = true;
					throw e;
				}
			}
		}

		/** 幂等完成:只会真正 complete 一次,重复调用静默返回。 */
		void complete() {
			synchronized (lock) {
				if (closed) {
					return;
				}
				closed = true;
				try {
					emitter.complete();
				} catch (Exception ignore) {
					// 已完成或客户端已断
				}
			}
		}

		/** 幂等错误完成。 */
		void completeWithError(Throwable e) {
			synchronized (lock) {
				if (closed) {
					return;
				}
				closed = true;
				try {
					emitter.completeWithError(e);
				} catch (Exception ignore) {
					// 已完成或客户端已断
				}
			}
		}
	}

	private void withHeartbeat(SseChannel channel, StreamBody body) throws Exception {
		final AtomicBoolean stopped = new AtomicBoolean(false);
		ScheduledFuture<?> heartbeat = SSE_HEARTBEAT_EXECUTOR.scheduleAtFixedRate(() -> {
			if (stopped.get()) {
				return;
			}
			try {
				// [并发根修] 这里绝不能做「mark 当前线程」(SseHelper 的旧调用):心跳线程无 Request 绑定,
				// 旧实现首个 tick 即 NPE 被吞 → stopped=true → keep-alive 自池化改造以来一直是死的。
				// __sse__ 标志由 servlet 线程在 SseHelper.push() 时对真正的请求对象设置,与心跳无关。
				// 修复 #10(A):经 SseChannel 串行化写;已关闭则返回 false。心跳不再自行 complete,
				// 收尾统一交给 chatStream 主流程,避免心跳 complete 与读流 send 竞态(keep-alive 帧本身不变)。
				if (!channel.send(SseEmitter.event().comment("keep-alive"))) {
					stopped.set(true);
				}
			} catch (Exception e) {
				// 客户端已断。停止后续心跳;读流下次 send 也会返回 false/抛异常 → 进 catch → 记日志。
				stopped.set(true);
			}
		}, SSE_HEARTBEAT_SECONDS, SSE_HEARTBEAT_SECONDS, TimeUnit.SECONDS);

		try {
			body.run();
		} finally {
			stopped.set(true);
			heartbeat.cancel(false);
		}
	}

	public Map<String, Object> listModels(Map<String, Object> params){
		String providerType = normalizedProviderType(params);
		String responseText = "";
		if(isOpenAICompatible(providerType)) {
			String url = joinUrl(resolveBaseUrl(providerType, stringVal(params, "baseUrl")), "/models");
			Map<String, String> headers = buildAuthHeaders(providerType, stringVal(params, "apiKey"), params);
			responseText = sendUpstreamForText("GET", url, headers, null, params);
		}else if("anthropic".equals(providerType)) {
			String url = joinUrl(resolveBaseUrl(providerType, stringVal(params, "baseUrl")), "/v1/models");
			Map<String, String> headers = buildAuthHeaders(providerType, stringVal(params, "apiKey"), params);
			responseText = sendUpstreamForText("GET", url, headers, null, params);
		}else if("gemini".equals(providerType)) {
			String apiKey = stringVal(params, "apiKey");
			String url = joinUrl(resolveBaseUrl(providerType, stringVal(params, "baseUrl")), "/models") + "?key=" + urlEncode(apiKey);
			responseText = sendUpstreamForText("GET", url, null, null, params);
		}else {
			throw new ErrorCodeException(580002, "暂不支持该 providerType");
		}
		Map<String, Object> payload = JsonUtility.toDictionary(responseText);
		Map<String, Object> modelGroups = splitProviderModels(extractModelIds(payload), providerType);
		Map<String, Object> result = new LinkedHashMap<String, Object>();
		result.put("models", modelGroups.get("models"));
		result.put("chatModels", modelGroups.get("chatModels"));
		result.put("embeddingModels", modelGroups.get("embeddingModels"));
		result.put("providerType", providerType);
		result.put("protocolFamily", protocolFamily(providerType));
		return result;
	}

	public Map<String, Object> chat(Map<String, Object> params){
		String providerType = normalizedProviderType(params);
		String model = requireModel(params);
		if(isEmbeddingModel(model, providerType)){
			throw new ErrorCodeException(580014, "所选模型是 Embedding 模型，不能用于对话，请选择聊天模型");
		}
		List<Map<String, Object>> messages = getMessageList(params.get("messages"));
		String responseText = "";
		Map<String, String> headers = buildAuthHeaders(providerType, stringVal(params, "apiKey"), params);
		if(isOpenAICompatible(providerType)) {
			Map<String, Object> requestBody = buildOpenAIChatBody(model, params, messages, false);
			String url = joinUrl(resolveBaseUrl(providerType, stringVal(params, "baseUrl")), "/chat/completions");
			responseText = sendUpstreamForText("POST", url, headers, JsonUtility.encode(requestBody), params);
		}else if("anthropic".equals(providerType)) {
			String url = joinUrl(resolveBaseUrl(providerType, stringVal(params, "baseUrl")), "/v1/messages");
			Map<String, Object> body = buildAnthropicBody(model, params, messages, false);
			responseText = sendUpstreamForText("POST", url, headers, JsonUtility.encode(body), params);
		}else if("gemini".equals(providerType)) {
			String apiKey = stringVal(params, "apiKey");
			String url = joinUrl(resolveBaseUrl(providerType, stringVal(params, "baseUrl")), String.format("/models/%s:generateContent?key=%s", urlEncode(model), urlEncode(apiKey)));
			Map<String, Object> body = buildGeminiBody(params, messages);
			responseText = sendUpstreamForText("POST", url, headers, JsonUtility.encode(body), params);
		}else {
			throw new ErrorCodeException(580013, "暂不支持该 providerType");
		}
		Map<String, Object> payload = JsonUtility.toDictionary(responseText);
		Map<String, Object> result = new LinkedHashMap<String, Object>();
		result.put("content", extractChatContent(providerType, payload));
		result.put("model", model);
		result.put("providerType", providerType);
		return result;
	}

	public void chatStream(Map<String, Object> params, SseEmitter emitter){
		// 修复 #10(A):所有写经线程安全的 SseChannel,心跳与读流不再 race(详见 SseChannel)。
		SseChannel channel = new SseChannel(emitter);
		String providerType = normalizedProviderType(params);
		String model = requireModel(params);
		if(isEmbeddingModel(model, providerType)){
			throw new ErrorCodeException(580014, "所选模型是 Embedding 模型，不能用于对话，请选择聊天模型");
		}
		List<Map<String, Object>> messages = getMessageList(params.get("messages"));
		try{
			if("ollama".equals(providerType)) {
				// Ollama 必须走原生 /api/chat 才能让 num_ctx 等 options 生效(OpenAI 兼容口 /v1/chat/completions
				// 会忽略 num_ctx → 默认 4096 截断,即 Windows #15)。其它 OpenAI 兼容 provider 不变。
				streamOllamaNative(params, model, messages, channel);
			}else if(isOpenAICompatible(providerType)) {
				streamOpenAICompatible(params, model, messages, channel);
			}else if("anthropic".equals(providerType)) {
				streamAnthropic(params, model, messages, channel);
			}else if("gemini".equals(providerType)) {
				streamGemini(params, model, messages, channel);
			}else {
				throw new ErrorCodeException(580013, "暂不支持该 providerType");
			}
			sendEvent(channel, "done", buildMap("providerType", providerType, "model", model));
			channel.complete();   // 幂等:SseChannel 保证只 complete 一次,客户端已断也不抛
		}catch(Exception e){
			// Issue #8 Fix 1: catch 第一件事必须是把"一级"异常写日志。
			// 之前这一步缺失，导致 ClientAbort 二级异常掩盖了 Ollama 上游真实失败，
			// 调试时只能看到 sendEvent 抛 RuntimeException 的镜像 stack，根因黑盒。
			try {
				QueueLog.error(AppLoggers.ErrorLogger, e, String.format(
					"AIAnalysisProxyService.chatStream failed: providerType=%s, model=%s",
					providerType, model));
			}catch(Throwable logEx){
				// 日志层异常永远不能让 catch 自己炸。
			}
			// sendEvent 给前端发"error"事件——若客户端已断,SseChannel.send 返回 false 不抛;根因已记。
			try {
				sendEvent(channel, "error", buildMap(
					"providerType", providerType,
					"model", model,
					"message", safeErrorMessage(e)
				));
			}catch(Exception sendEx){
				// 客户端已断；放弃前端通知。
			}
			// 幂等错误完成(SseChannel 保证只 complete 一次,并清理 SseEmitter 状态)。
			channel.completeWithError(e);
		}
	}

	public Map<String, Object> diagnose(Map<String, Object> params){
		String providerType = normalizedProviderType(params);
		String baseUrl = resolveBaseUrl(providerType, stringVal(params, "baseUrl"));
		Map<String, Object> result = new LinkedHashMap<String, Object>();
		result.put("providerType", providerType);
		result.put("protocolFamily", protocolFamily(providerType));
		result.put("baseUrl", baseUrl);
		result.put("healthy", false);
		result.put("failureReason", "");
		result.put("errorDetail", "");
		result.put("recommendation", "");
		try{
			URI uri = URI.create(baseUrl);
			String host = uri.getHost();
			int port = uri.getPort();
			if(port <= 0){
				port = "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
			}
			result.put("dns", diagnoseDns(host));
			result.put("tcp", diagnoseTcp(host, port));
			Instant httpStart = Instant.now();
			Map<String, Object> models = listModels(params);
			long httpMs = Duration.between(httpStart, Instant.now()).toMillis();
			result.put("http", buildMap(
				"ok", true,
				"latencyMs", httpMs
			));
			result.put("models", models.get("models"));
			result.put("chatModels", models.get("chatModels"));
			result.put("embeddingModels", models.get("embeddingModels"));
			result.put("latencyMs", httpMs);
			result.put("healthy", true);
			result.put("recommendation", "连接正常，可直接用于模型拉取与分析对话。");
		}catch(Exception e){
			String failureReason = classifyFailure(e);
			result.put("http", buildMap(
				"ok", false,
				"message", safeErrorMessage(e)
			));
			result.put("failureReason", failureReason);
			result.put("errorDetail", safeErrorMessage(e));
			result.put("recommendation", buildFailureRecommendation(providerType, failureReason));
		}
		return result;
	}

	public Map<String, Object> embeddings(Map<String, Object> params){
		String providerType = normalizedProviderType(params);
		String model = requireEmbeddingModel(params);
		List<String> inputs = getStringList(params.get("input"));
		if(inputs.isEmpty()){
			throw new ErrorCodeException(580031, "缺少 embedding 输入");
		}
		Map<String, Object> result = new LinkedHashMap<String, Object>();
		result.put("providerType", providerType);
		result.put("model", model);
		// Ollama 嵌入走原生 /api/embed（含 options.num_ctx）—— 修 Windows #15 的「embedding 仍走 OpenAI 兼容口
		// → 忽略 num_ctx → 4096 截断」。须前置于 isOpenAICompatible 分支，因为 ollama 也满足兼容口分类。
		if("ollama".equals(providerType)) {
			result.put("vectors", embeddingsOllamaNative(params, model, inputs));
			return result;
		}
		if(isOpenAICompatible(providerType)) {
			Map<String, Object> body = new LinkedHashMap<String, Object>();
			body.put("model", model);
			body.put("input", inputs);
			String url = joinUrl(resolveBaseUrl(providerType, stringVal(params, "baseUrl")), "/embeddings");
			String rsp = sendUpstreamForText("POST", url, buildAuthHeaders(providerType, stringVal(params, "apiKey"), params), JsonUtility.encode(body), params);
			Map<String, Object> payload = JsonUtility.toDictionary(rsp);
			result.put("vectors", extractEmbeddingVectors(payload));
			return result;
		}
		if("gemini".equals(providerType)) {
			List<List<Double>> vectors = new ArrayList<List<Double>>();
			String baseUrl = resolveBaseUrl(providerType, stringVal(params, "baseUrl"));
			String apiKey = stringVal(params, "apiKey");
			for(String input : inputs) {
				String url = joinUrl(baseUrl, String.format("/models/%s:embedContent?key=%s", urlEncode(model), urlEncode(apiKey)));
				Map<String, Object> body = new LinkedHashMap<String, Object>();
				body.put("content", buildMap("parts", Arrays.asList(buildTextPart(input))));
				String rsp = sendUpstreamForText("POST", url, buildAuthHeaders(providerType, apiKey, params), JsonUtility.encode(body), params);
				Map<String, Object> payload = JsonUtility.toDictionary(rsp);
				vectors.add(extractGeminiEmbedding(payload));
			}
			result.put("vectors", vectors);
			return result;
		}
		throw new ErrorCodeException(580032, "当前 provider 暂不支持 embedding");
	}

	private void streamOpenAICompatible(Map<String, Object> params, String model, List<Map<String, Object>> messages, SseChannel channel) throws Exception{
		withHeartbeat(channel, () -> {
			Map<String, Object> body = buildOpenAIChatBody(model, params, messages, true);
			String url = joinUrl(resolveBaseUrl(normalizedProviderType(params), stringVal(params, "baseUrl")), "/chat/completions");
			HttpRequest request = buildJsonRequest(url, buildAuthHeaders(normalizedProviderType(params), stringVal(params, "apiKey"), params), JsonUtility.encode(body), params);
			HttpResponse<InputStream> response = sendStreamWithRetry(request, params);
			readSseStream(response.body(), (eventName, dataText)->{
				if(StringUtility.isNullOrEmpty(dataText)){
					return;
				}
				if("[DONE]".equalsIgnoreCase(dataText.trim())) {
					return;
				}
				Map<String, Object> payload = JsonUtility.toDictionary(dataText);
				String reasoning = extractOpenAIStreamReasoning(payload);
				if(!StringUtility.isNullOrEmpty(reasoning)) {
					sendEvent(channel, "reasoning", buildMap("reasoning", reasoning));
				}
				String delta = extractOpenAIStreamDelta(payload);
				if(!StringUtility.isNullOrEmpty(delta)) {
					sendEvent(channel, "delta", buildMap("delta", delta));
				}
				// 2A：末帧（或独立 usage 帧）通常带 usage；统一打成 "usage" SSE 事件下发。
				Map<String, Object> usage = extractOpenAIUsage(payload);
				if(usage != null) {
					sendEvent(channel, "usage", usage);
				}
			});
		});
	}

	// Ollama 原生 /api/chat 流式（NDJSON）。让 options.num_ctx 等真正生效（修 Windows #15：OpenAI 兼容口忽略
	// num_ctx → 默认 4096 截断长玄学上下文）。其它 provider 不受影响。
	private void streamOllamaNative(Map<String, Object> params, String model, List<Map<String, Object>> messages, SseChannel channel) throws Exception{
		withHeartbeat(channel, () -> {
			Map<String, Object> body = buildOllamaNativeBody(model, params, messages, true);
			String url = joinUrl(ollamaNativeBase(params), "/api/chat");
			HttpRequest request = buildJsonRequest(url, buildAuthHeaders("ollama", stringVal(params, "apiKey"), params), JsonUtility.encode(body), params);
			HttpResponse<InputStream> response = sendStreamWithRetry(request, params);
			readNdjsonStream(response.body(), (dataText) -> {
				if(StringUtility.isNullOrEmpty(dataText)) { return; }
				Map<String, Object> payload = JsonUtility.toDictionary(dataText);
				Object msg = payload.get("message");
				if(msg instanceof Map) {
					// Ollama thinking 模型(deepseek-r1 等)把思维链放在 message.thinking,单独透出(与 #16 同口径)。
					Object think = ((Map) msg).get("thinking");
					if(think != null && !StringUtility.isNullOrEmpty(think.toString())) {
						sendEvent(channel, "reasoning", buildMap("reasoning", think.toString()));
					}
					Object c = ((Map) msg).get("content");
					if(c != null && !StringUtility.isNullOrEmpty(c.toString())) {
						sendEvent(channel, "delta", buildMap("delta", c.toString()));
					}
				}
				// 2A：done=true 的末帧带 prompt_eval_count + eval_count。
				Map<String, Object> usage = extractOllamaUsage(payload);
				if(usage != null) {
					sendEvent(channel, "usage", usage);
				}
			});
		});
	}

	// Ollama 原生 body：messages 同 OpenAI({role,content})；num_ctx/num_predict/top_k/top_p/repeat_penalty/temperature
	// 一律嵌入 options:{}（原生口才读 options），keep_alive 留顶层。
	Map<String, Object> buildOllamaNativeBody(String model, Map<String, Object> params, List<Map<String, Object>> messages, boolean stream){
		Map<String, Object> body = new LinkedHashMap<String, Object>();
		body.put("model", model);
		List<Map<String, Object>> norm = new ArrayList<Map<String, Object>>();
		if(messages != null) {
			for(Map<String, Object> m : messages) {
				if(m == null) { continue; }
				Map<String, Object> nm = new LinkedHashMap<String, Object>();
				nm.put("role", stringVal(m, "role"));
				nm.put("content", stringVal(m, "content"));
				// 2B：Ollama 视觉模型（llava 等）的 message.images 是 base64 列表（不带 data:image/...; 前缀）。
				List<String> imgs = imageUrlList(m.get("images"));
				if(!imgs.isEmpty()) {
					List<String> b64 = new ArrayList<String>();
					for(String u : imgs) {
						String s = u.startsWith("data:") ? u.substring(u.indexOf(',') + 1) : u;
						if(!s.isEmpty()) { b64.add(s); }
					}
					if(!b64.isEmpty()) { nm.put("images", b64); }
				}
				norm.add(nm);
			}
		}
		body.put("messages", norm);
		body.put("stream", stream);
		Map<String, Object> opts = new LinkedHashMap<String, Object>();
		opts.put("temperature", numVal(params.get("temperature"), 0.7));
		if(params.get("maxTokens") != null) { opts.put("num_predict", intVal(params.get("maxTokens"), 1024)); }
		Map<String, Object> prov = buildProviderBodyOptions(params);
		// 2B：把 OpenAI 兼容形参 stop 映射到 Ollama options.stop。
		Object stopVal = prov.remove("stop");
		List<String> stops = anthropicStopList(stopVal);
		if(!stops.isEmpty()) { opts.put("stop", stops); }
		// Ollama 不支持 response_format / 惩罚 / 思考档 → 丢弃以避免 400。
		prov.remove("response_format");
		prov.remove("frequency_penalty");
		prov.remove("presence_penalty");
		prov.remove("thinking");
		prov.remove("thinkingConfig");
		for(Map.Entry<String, Object> e : prov.entrySet()) {
			if("keep_alive".equals(e.getKey())) { body.put("keep_alive", e.getValue()); }
			else { opts.put(e.getKey(), e.getValue()); } // num_ctx/num_predict/top_k/top_p/repeat_penalty
		}
		body.put("options", opts);
		return body;
	}

	// Ollama 原生 base：去掉 OpenAI 兼容口的末尾 /v1（DEFAULT_OLLAMA_BASE 带 /v1，原生 /api 路径不带）。
	String ollamaNativeBase(Map<String, Object> params){
		String b = trimTrailingSlash(resolveBaseUrl("ollama", stringVal(params, "baseUrl")));
		if(b.endsWith("/v1")) { b = b.substring(0, b.length() - 3); }
		return trimTrailingSlash(b);
	}

	// Ollama 原生嵌入 /api/embed（批量；新 API，0.2+ 起官方推荐替代旧 /api/embeddings 单 prompt 口）。
	// body = {model, input:[...], options:{num_ctx,...}, keep_alive}，返回 {embeddings:[[...]]}.
	// 让 num_ctx 真正生效（修 Windows #15 的 embedding 子项；其它 provider 不受影响）。
	private List<List<Double>> embeddingsOllamaNative(Map<String, Object> params, String model, List<String> inputs){
		Map<String, Object> body = new LinkedHashMap<String, Object>();
		body.put("model", model);
		body.put("input", inputs);
		Map<String, Object> opts = new LinkedHashMap<String, Object>();
		Map<String, Object> prov = buildProviderBodyOptions(params);
		for(Map.Entry<String, Object> e : prov.entrySet()) {
			if("keep_alive".equals(e.getKey())) { body.put("keep_alive", e.getValue()); }
			else if("temperature".equals(e.getKey()) || "num_predict".equals(e.getKey())) {
				// 嵌入不需要 temperature/num_predict，过滤掉。
			} else { opts.put(e.getKey(), e.getValue()); } // num_ctx/top_k/top_p/repeat_penalty
		}
		if(!opts.isEmpty()) { body.put("options", opts); }
		String url = joinUrl(ollamaNativeBase(params), "/api/embed");
		String rsp = sendUpstreamForText("POST", url, buildAuthHeaders("ollama", stringVal(params, "apiKey"), params), JsonUtility.encode(body), params);
		Map<String, Object> payload = JsonUtility.toDictionary(rsp);
		return extractOllamaEmbedVectors(payload);
	}

	// Ollama /api/embed 响应：{model, embeddings:[[...]]}（数组式;与 OpenAI 的 data:[{embedding:[...]}] 不同）。
	static List<List<Double>> extractOllamaEmbedVectors(Map<String, Object> payload){
		List<List<Double>> result = new ArrayList<List<Double>>();
		if(payload == null) { return result; }
		Object embsObj = payload.get("embeddings");
		if(embsObj instanceof List) {
			for(Object v : (List)embsObj) { result.add(numberList(v)); }
		}
		return result;
	}

	// NDJSON 流：每行一个 JSON 对象（Ollama 原生流式），逐行回调。
	// try-with-resources:客户端中途断开时 handler 上抛 IOException,底层 socket 流必须随之关闭,
	// 否则每次「停止生成/断网」泄漏一个 fd,长跑后 too many open files。
	private void readNdjsonStream(InputStream stream, NdjsonLineHandler handler) throws IOException{
		try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
			String line;
			while((line = reader.readLine()) != null) {
				String t = line.trim();
				if(!t.isEmpty()) { handler.onLine(t); }
			}
		}
	}

	@FunctionalInterface
	private interface NdjsonLineHandler { void onLine(String line); }

	private void streamAnthropic(Map<String, Object> params, String model, List<Map<String, Object>> messages, SseChannel channel) throws Exception{
		withHeartbeat(channel, () -> {
			Map<String, Object> body = buildAnthropicBody(model, params, messages, true);
			String url = joinUrl(resolveBaseUrl("anthropic", stringVal(params, "baseUrl")), "/v1/messages");
			HttpRequest request = buildJsonRequest(url, buildAuthHeaders("anthropic", stringVal(params, "apiKey"), params), JsonUtility.encode(body), params);
			HttpResponse<InputStream> response = sendStreamWithRetry(request, params);
			readSseStream(response.body(), (eventName, dataText)->{
				if(StringUtility.isNullOrEmpty(dataText)){
					return;
				}
				Map<String, Object> payload = JsonUtility.toDictionary(dataText);
				// #54-G：先抽思考增量(thinking_delta)走 reasoning 通道，再抽正文 delta；二者互斥(同一 delta 只命中其一)。
				String reasoning = extractAnthropicStreamThinking(eventName, payload);
				if(!StringUtility.isNullOrEmpty(reasoning)) {
					sendEvent(channel, "reasoning", buildMap("reasoning", reasoning));
				}
				String delta = extractAnthropicStreamDelta(eventName, payload);
				if(!StringUtility.isNullOrEmpty(delta)) {
					sendEvent(channel, "delta", buildMap("delta", delta));
				}
				// 2A：Anthropic 在 message_start.message.usage 给输入 token；message_delta.usage 累加输出。
				Map<String, Object> usage = extractAnthropicUsage(eventName, payload);
				if(usage != null) {
					sendEvent(channel, "usage", usage);
				}
			});
		});
	}

	private void streamGemini(Map<String, Object> params, String model, List<Map<String, Object>> messages, SseChannel channel) throws Exception{
		withHeartbeat(channel, () -> {
			String apiKey = stringVal(params, "apiKey");
			String url = joinUrl(resolveBaseUrl("gemini", stringVal(params, "baseUrl")), String.format("/models/%s:streamGenerateContent?alt=sse&key=%s", urlEncode(model), urlEncode(apiKey)));
			Map<String, Object> body = buildGeminiBody(params, messages);
			HttpRequest request = buildJsonRequest(url, buildAuthHeaders("gemini", apiKey, params), JsonUtility.encode(body), params);
			HttpResponse<InputStream> response = sendStreamWithRetry(request, params);
			readSseStream(response.body(), (eventName, dataText)->{
				if(StringUtility.isNullOrEmpty(dataText)){
					return;
				}
				Map<String, Object> payload = JsonUtility.toDictionary(dataText);
				// #54-G：先抽思考增量(part.thought==true)走 reasoning 通道，再抽正文 delta(已剔除思考 part)。
				String reasoning = extractGeminiThinking(payload);
				if(!StringUtility.isNullOrEmpty(reasoning)) {
					sendEvent(channel, "reasoning", buildMap("reasoning", reasoning));
				}
				String delta = extractGeminiContent(payload);
				if(!StringUtility.isNullOrEmpty(delta)) {
					sendEvent(channel, "delta", buildMap("delta", delta));
				}
				// 2A：Gemini 在末尾的 chunk 通常会带 usageMetadata。
				Map<String, Object> usage = extractGeminiUsage(payload);
				if(usage != null) {
					sendEvent(channel, "usage", usage);
				}
			});
		});
	}

	static String protocolFamily(String providerType){
		String normalized = providerType == null ? "" : providerType.trim().toLowerCase();
		if("anthropic".equals(normalized)) {
			return "anthropic";
		}
		if("gemini".equals(normalized)) {
			return "gemini";
		}
		if("ollama".equals(normalized)) {
			return "ollama";
		}
		return "openai-compatible";
	}

	static boolean isOpenAICompatible(String providerType) {
		String family = protocolFamily(providerType);
		return "openai-compatible".equals(family) || "ollama".equals(family);
	}

	static String resolveBaseUrl(String providerType, String baseUrl){
		if(!StringUtility.isNullOrEmpty(baseUrl)) {
			return trimTrailingSlash(baseUrl.trim());
		}
		if("deepseek".equals(providerType)) {
			return DEFAULT_DEEPSEEK_BASE;
		}
		if("openrouter".equals(providerType)) {
			return DEFAULT_OPENROUTER_BASE;
		}
		if("ollama".equals(providerType)) {
			return DEFAULT_OLLAMA_BASE;
		}
		if("anthropic".equals(providerType)) {
			return DEFAULT_ANTHROPIC_BASE;
		}
		if("gemini".equals(providerType)) {
			return DEFAULT_GEMINI_BASE;
		}
		if("moonshot".equals(providerType)) {
			return DEFAULT_MOONSHOT_BASE;
		}
		if("zhipu".equals(providerType)) {
			return DEFAULT_ZHIPU_BASE;
		}
		if("siliconflow".equals(providerType)) {
			return DEFAULT_SILICONFLOW_BASE;
		}
		if("groq".equals(providerType)) {
			return DEFAULT_GROQ_BASE;
		}
		if("xai".equals(providerType)) {
			return DEFAULT_XAI_BASE;
		}
		return DEFAULT_OPENAI_BASE;
	}

	static String trimTrailingSlash(String text){
		String val = text == null ? "" : text.trim();
		while(val.endsWith("/")) {
			val = val.substring(0, val.length() - 1);
		}
		return val;
	}

	static String joinUrl(String baseUrl, String path){
		String base = trimTrailingSlash(baseUrl);
		String suffix = path == null ? "" : path.trim();
		if(suffix.startsWith("http://") || suffix.startsWith("https://")) {
			return suffix;
		}
		if(!suffix.startsWith("/")) {
			suffix = "/" + suffix;
		}
		return base + suffix;
	}

	static Map<String, String> buildAuthHeaders(String providerType, String apiKey){
		return buildAuthHeaders(providerType, apiKey, null);
	}

	static Map<String, String> buildAuthHeaders(String providerType, String apiKey, Map<String, Object> params){
		Map<String, String> headers = new HashMap<String, String>();
		headers.put("Content-Type", "application/json; charset=UTF-8");
		String key = apiKey == null ? "" : apiKey.trim();
		if("anthropic".equals(providerType)) {
			headers.put("x-api-key", key);
			String apiVersion = stringFromAny(providerOptionsMap(params).get("apiVersion"));
			headers.put("anthropic-version", StringUtility.isNullOrEmpty(apiVersion) ? "2023-06-01" : apiVersion);
		}else if(!StringUtility.isNullOrEmpty(key) && !"ollama".equals(providerType) && !"gemini".equals(providerType)) {
			// Gemini 走 URL ?key=,不能再加 Authorization,否则原生接口报 ACCESS_TOKEN_TYPE_UNSUPPORTED。
			// 其它默认 Authorization: Bearer;允许 custom 用 providerOptions.authHeaderName/authPrefix 覆盖,
			// 以兼容要求非 Bearer 方案的官方原生 key(authPrefix 设为 "" 即发原始 key)。
			String authHeaderName = stringFromAny(providerOptionsMap(params).get("authHeaderName"));
			if(StringUtility.isNullOrEmpty(authHeaderName)) {
				authHeaderName = "Authorization";
			}
			Object prefixObj = providerOptionsMap(params).get("authPrefix");
			String authPrefix;
			if(prefixObj == null) {
				authPrefix = "Authorization".equalsIgnoreCase(authHeaderName) ? "Bearer " : "";
			}else {
				authPrefix = stringFromAny(prefixObj);
			}
			headers.put(authHeaderName, authPrefix + key);
		}
		if("openrouter".equals(providerType)) {
			headers.put("HTTP-Referer", "https://www.horosa.com");
			headers.put("X-Title", "Horosa AI Analysis");
		}
		Map<String, Object> extraHeaders = mapVal(providerOptionsMap(params).get("extraHeaders"));
		for(Map.Entry<String, Object> entry : extraHeaders.entrySet()) {
			String headerName = entry.getKey();
			String headerValue = stringFromAny(entry.getValue());
			if(!StringUtility.isNullOrEmpty(headerName) && !StringUtility.isNullOrEmpty(headerValue)) {
				headers.put(headerName, headerValue);
			}
		}
		return headers;
	}

	static List<String> extractModelIds(Map<String, Object> payload){
		List<String> result = new ArrayList<String>();
		if(payload == null) {
			return result;
		}
		Object data = payload.get("data");
		appendModelIds(result, data);
		appendModelIds(result, payload.get("models"));
		if(result.isEmpty() && payload.get("model") instanceof String) {
			result.add((String)payload.get("model"));
		}
		return uniqueStrings(result);
	}

	static Map<String, Object> splitProviderModels(List<String> models, String providerType){
		List<String> allModels = uniqueStrings(models == null ? new ArrayList<String>() : models);
		List<String> embeddingModels = new ArrayList<String>();
		List<String> chatModels = new ArrayList<String>();
		for(String model : allModels) {
			if(isEmbeddingModel(model, providerType)) {
				embeddingModels.add(model);
			}else{
				chatModels.add(model);
			}
		}
		Map<String, Object> result = new LinkedHashMap<String, Object>();
		result.put("models", allModels);
		result.put("chatModels", chatModels);
		result.put("embeddingModels", embeddingModels);
		return result;
	}

	private static boolean isEmbeddingModel(String model, String providerType){
		String normalized = model == null ? "" : model.trim().toLowerCase();
		if(StringUtility.isNullOrEmpty(normalized)) {
			return false;
		}
		if(normalized.contains("embedding")
			|| normalized.contains("embed")
			|| normalized.contains("bge")
			|| normalized.contains("bce")) {
			return true;
		}
		if("gemini".equals(providerType) && normalized.startsWith("text-embedding")) {
			return true;
		}
		return "openai".equals(providerType) && normalized.startsWith("text-embedding");
	}

	private static void appendModelIds(List<String> target, Object obj){
		if(!(obj instanceof List)) {
			return;
		}
		for(Object item : (List)obj) {
			if(item instanceof Map) {
				Map map = (Map)item;
				String id = stringFromAny(map.get("id"));
				if(StringUtility.isNullOrEmpty(id)) {
					id = stringFromAny(map.get("name"));
				}
				if(StringUtility.isNullOrEmpty(id)) {
					id = stringFromAny(map.get("model"));
				}
				if(!StringUtility.isNullOrEmpty(id)) {
					target.add(id);
				}
			}else if(item instanceof String) {
				target.add((String)item);
			}
		}
	}

	static String extractChatContent(String providerType, Map<String, Object> payload){
		if(payload == null) {
			return "";
		}
		if("anthropic".equals(providerType)) {
			return extractAnthropicContent(payload);
		}
		if("gemini".equals(providerType)) {
			return extractGeminiContent(payload);
		}
		return extractOpenAIContent(payload);
	}

	static List<Map<String, Object>> getMessageList(Object obj){
		List<Map<String, Object>> result = new ArrayList<Map<String, Object>>();
		if(!(obj instanceof List)) {
			return result;
		}
		for(Object item : (List)obj) {
			if(item instanceof Map) {
				Map map = (Map)item;
				Map<String, Object> next = new LinkedHashMap<String, Object>();
				next.put("role", stringFromAny(map.get("role")));
				next.put("content", stringFromAny(map.get("content")));
				// 2F：保留图片（多媒体输入）→ 由各家 body 构造多模态内容；纯文本消息无 images 字段、行为不变。
				List<String> imgs = imageUrlList(map.get("images"));
				if(!imgs.isEmpty()) { next.put("images", imgs); }
				result.add(next);
			}
		}
		return result;
	}

	// 2F：解析消息里的图片地址列表（dataURL 或 http(s)）；非法/空 → 空列表（纯文本路径不受影响）。
	@SuppressWarnings("rawtypes")
	static List<String> imageUrlList(Object obj){
		List<String> out = new ArrayList<String>();
		if(!(obj instanceof List)) {
			return out;
		}
		for(Object item : (List)obj) {
			String url = stringFromAny(item).trim();
			if(url.startsWith("data:image/") || url.startsWith("http://") || url.startsWith("https://")) {
				out.add(url);
			}
		}
		return out;
	}

	// 2F：把含图片的消息转成 OpenAI 视觉多模态 content 数组；无图片的消息保持 {role,content} 原样（零回归）。
	@SuppressWarnings("rawtypes")
	static List<Map<String, Object>> toOpenAIVisionMessages(List<Map<String, Object>> messages){
		List<Map<String, Object>> out = new ArrayList<Map<String, Object>>();
		for(Map<String, Object> one : messages) {
			Object imagesObj = one.get("images");
			if(!(imagesObj instanceof List) || ((List)imagesObj).isEmpty()) {
				Map<String, Object> copy = new LinkedHashMap<String, Object>();
				copy.put("role", one.get("role"));
				copy.put("content", one.get("content"));
				out.add(copy);
				continue;
			}
			List<Map<String, Object>> parts = new ArrayList<Map<String, Object>>();
			String text = stringVal(one, "content");
			if(!StringUtility.isNullOrEmpty(text)) {
				Map<String, Object> tp = new LinkedHashMap<String, Object>();
				tp.put("type", "text");
				tp.put("text", text);
				parts.add(tp);
			}
			for(Object u : (List)imagesObj) {
				Map<String, Object> ip = new LinkedHashMap<String, Object>();
				ip.put("type", "image_url");
				Map<String, Object> iu = new LinkedHashMap<String, Object>();
				iu.put("url", stringFromAny(u));
				ip.put("image_url", iu);
				parts.add(ip);
			}
			Map<String, Object> msg = new LinkedHashMap<String, Object>();
			msg.put("role", one.get("role"));
			msg.put("content", parts);
			out.add(msg);
		}
		return out;
	}

	// 2F：Anthropic 图片块（dataURL→base64 source；http(s)→url source）；无法解析 → null（跳过）。
	static Map<String, Object> anthropicImageBlock(String url){
		if(url == null) {
			return null;
		}
		String u = url.trim();
		Map<String, Object> block = new LinkedHashMap<String, Object>();
		block.put("type", "image");
		Map<String, Object> source = new LinkedHashMap<String, Object>();
		if(u.startsWith("data:")) {
			int comma = u.indexOf(',');
			int semi = u.indexOf(';');
			if(comma < 0 || semi < 6) {
				return null;
			}
			source.put("type", "base64");
			source.put("media_type", u.substring(5, semi));
			source.put("data", u.substring(comma + 1));
		} else if(u.startsWith("http://") || u.startsWith("https://")) {
			source.put("type", "url");
			source.put("url", u);
		} else {
			return null;
		}
		block.put("source", source);
		return block;
	}

	static String extractOpenAIContent(Map<String, Object> payload){
		Object choicesObj = payload.get("choices");
		if(!(choicesObj instanceof List) || ((List)choicesObj).isEmpty()) {
			return "";
		}
		Object first = ((List)choicesObj).get(0);
		if(!(first instanceof Map)) {
			return "";
		}
		Map choice = (Map)first;
		Object message = choice.get("message");
		if(message instanceof Map) {
			Object content = ((Map)message).get("content");
			if(content instanceof String) {
				return (String)content;
			}
			if(content instanceof List) {
				return joinTextParts((List)content);
			}
		}
		Object text = choice.get("text");
		return text instanceof String ? (String)text : "";
	}

	static String extractAnthropicContent(Map<String, Object> payload){
		Object contentObj = payload.get("content");
		if(!(contentObj instanceof List)) {
			return "";
		}
		return joinTextParts((List)contentObj);
	}

	static String extractGeminiContent(Map<String, Object> payload){
		// #54-G：Gemini 思考模型把思维链放在 part.thought==true 的 part(其 text 是思考、非正文)；
		// 正文只取非思考 part(thought 缺省/为 false)，思考增量由 extractGeminiThinking 走 reasoning 通道。
		return joinGeminiParts(geminiParts(payload), false);
	}

	// #54-G：抽 Gemini 思考增量(part.thought==true 的 text)→ 与 OpenAI/DeepSeek/Anthropic 同口径走 reasoning 通道。
	// thinkingConfig.includeThoughts=true 时上游才回 thought part；否则恒空，零回归(普通响应无 thought 字段)。
	static String extractGeminiThinking(Map<String, Object> payload){
		return joinGeminiParts(geminiParts(payload), true);
	}

	// 取 candidates[0].content.parts(缺则空列表)。
	private static List geminiParts(Map<String, Object> payload){
		if(payload == null) {
			return java.util.Collections.emptyList();
		}
		Object candidatesObj = payload.get("candidates");
		if(!(candidatesObj instanceof List) || ((List)candidatesObj).isEmpty()) {
			return java.util.Collections.emptyList();
		}
		Object first = ((List)candidatesObj).get(0);
		if(!(first instanceof Map)) {
			return java.util.Collections.emptyList();
		}
		Object content = ((Map)first).get("content");
		if(!(content instanceof Map)) {
			return java.util.Collections.emptyList();
		}
		Object parts = ((Map)content).get("parts");
		return (parts instanceof List) ? (List)parts : java.util.Collections.emptyList();
	}

	// 按 thought 标志筛 parts 再拼接：wantThought=true 取思考 part；false 取正文 part(thought 缺省/为 false、
	// 以及纯字符串 part 均视作正文，沿用 joinTextParts 既有行为)。筛后复用 joinTextParts 抽 text/output_text 并 \n 拼接。
	private static String joinGeminiParts(List parts, boolean wantThought){
		List<Object> picked = new ArrayList<Object>();
		for(Object item : parts) {
			boolean isThought = (item instanceof Map) && Boolean.TRUE.equals(((Map)item).get("thought"));
			if(isThought == wantThought) {
				picked.add(item);
			}
		}
		return joinTextParts(picked);
	}

	static String extractOpenAIStreamDelta(Map<String, Object> payload){
		if(payload == null) {
			return "";
		}
		Object choicesObj = payload.get("choices");
		if(!(choicesObj instanceof List) || ((List)choicesObj).isEmpty()) {
			return "";
		}
		Object first = ((List)choicesObj).get(0);
		if(!(first instanceof Map)) {
			return "";
		}
		Map choice = (Map)first;
		Object deltaObj = choice.get("delta");
		if(deltaObj instanceof Map) {
			Object content = ((Map)deltaObj).get("content");
			if(content instanceof String) {
				return (String)content;
			}
			if(content instanceof List) {
				return joinTextParts((List)content);
			}
		}
		Object messageObj = choice.get("message");
		if(messageObj instanceof Map) {
			Object content = ((Map)messageObj).get("content");
			if(content instanceof String) {
				return (String)content;
			}
			if(content instanceof List) {
				return joinTextParts((List)content);
			}
		}
		return "";
	}

	// DeepSeek reasoner(R1)等推理模型把思维链放在 delta.reasoning_content(部分网关用 reasoning);旧实现只取
	// content → 思考阶段(可达 10s+)前端零输出、被当成「卡死/失败」(Windows #16)。这里单独取出思考增量,流持续有数据。
	static String extractOpenAIStreamReasoning(Map<String, Object> payload){
		if(payload == null) {
			return "";
		}
		Object choicesObj = payload.get("choices");
		if(!(choicesObj instanceof List) || ((List)choicesObj).isEmpty()) {
			return "";
		}
		Object first = ((List)choicesObj).get(0);
		if(!(first instanceof Map)) {
			return "";
		}
		Map choice = (Map)first;
		Object deltaObj = choice.get("delta");
		if(deltaObj instanceof Map) {
			Object r = ((Map)deltaObj).get("reasoning_content");
			if(!(r instanceof String) || ((String)r).isEmpty()) {
				r = ((Map)deltaObj).get("reasoning");
			}
			if(r instanceof String) {
				return (String)r;
			}
		}
		Object messageObj = choice.get("message");
		if(messageObj instanceof Map) {
			Object r = ((Map)messageObj).get("reasoning_content");
			if(r instanceof String) {
				return (String)r;
			}
		}
		return "";
	}

	static String extractAnthropicStreamDelta(String eventName, Map<String, Object> payload){
		if(payload == null) {
			return "";
		}
		String type = stringVal(payload, "type");
		if(StringUtility.isNullOrEmpty(type)) {
			type = eventName;
		}
		if("content_block_delta".equals(type)) {
			Object delta = payload.get("delta");
			if(delta instanceof Map) {
				// extended thinking 的思考块走 thinking_delta(delta.thinking)，不是正文 text → 此处只取正文，
				// 思考增量由 extractAnthropicStreamThinking 单独抽出走 reasoning 通道(与 OpenAI/DeepSeek 同口径)。
				String dt = stringFromAny(((Map)delta).get("type"));
				if("thinking_delta".equals(dt)) {
					return "";
				}
				return stringFromAny(((Map)delta).get("text"));
			}
		}
		return "";
	}

	// #54-G：Anthropic extended thinking 的思维链在 content_block_delta.delta.type=='thinking_delta' 的 delta.thinking，
	// 旧实现只取 delta.text → 思考期前端零输出(明明预算照发、更慢更贵却看不到思考过程)。这里单独抽出思考增量，
	// 走与 OpenAI/DeepSeek/Ollama 相同的 "reasoning" SSE 通道(前端既有「思考过程」渲染 + 看门狗续命)。
	static String extractAnthropicStreamThinking(String eventName, Map<String, Object> payload){
		if(payload == null) {
			return "";
		}
		String type = stringVal(payload, "type");
		if(StringUtility.isNullOrEmpty(type)) {
			type = eventName;
		}
		if("content_block_delta".equals(type)) {
			Object delta = payload.get("delta");
			if(delta instanceof Map) {
				Map deltaMap = (Map)delta;
				if("thinking_delta".equals(stringFromAny(deltaMap.get("type")))) {
					return stringFromAny(deltaMap.get("thinking"));
				}
			}
		}
		return "";
	}

	static List<List<Double>> extractEmbeddingVectors(Map<String, Object> payload){
		List<List<Double>> result = new ArrayList<List<Double>>();
		if(payload == null) {
			return result;
		}
		Object dataObj = payload.get("data");
		if(!(dataObj instanceof List)) {
			return result;
		}
		for(Object item : (List)dataObj) {
			if(!(item instanceof Map)) {
				continue;
			}
			Object embObj = ((Map)item).get("embedding");
			result.add(numberList(embObj));
		}
		return result;
	}

	static List<Double> extractGeminiEmbedding(Map<String, Object> payload){
		if(payload == null) {
			return new ArrayList<Double>();
		}
		Object embObj = payload.get("embedding");
		if(embObj instanceof Map) {
			return numberList(((Map)embObj).get("values"));
		}
		return new ArrayList<Double>();
	}

	private static String joinTextParts(List list){
		List<String> parts = new ArrayList<String>();
		for(Object item : list) {
			if(item instanceof String) {
				parts.add((String)item);
				continue;
			}
			if(item instanceof Map) {
				Map map = (Map)item;
				String text = stringFromAny(map.get("text"));
				if(StringUtility.isNullOrEmpty(text)) {
					text = stringFromAny(map.get("output_text"));
				}
				if(!StringUtility.isNullOrEmpty(text)) {
					parts.add(text);
				}
			}
		}
		return String.join("\n", parts).trim();
	}

	// OpenAI 的 gpt-5.x / o-系列推理模型只接受默认 temperature(=1)，且用 max_completion_tokens 取代 max_tokens；
	// 命中前缀即按推理模型口径构造请求体。去掉 provider 前缀以兼容 openrouter 的 "openai/gpt-5" 写法。
	static boolean isOpenAIReasoningModel(String model){
		if(model == null) {
			return false;
		}
		String m = model.trim().toLowerCase();
		int slash = m.lastIndexOf('/');
		if(slash >= 0) {
			m = m.substring(slash + 1);
		}
		return m.startsWith("gpt-5") || m.startsWith("gpt5")
			|| m.startsWith("gpt-6") || m.startsWith("gpt6")
			|| m.startsWith("gpt-7") || m.startsWith("gpt7")
			|| m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4")
			|| m.startsWith("o5") || m.startsWith("o6") || m.startsWith("o7");
	}

	// 广义「推理模型」:除 OpenAI o/gpt-5 系外,还含 DeepSeek reasoner / *-r1 / 通用 reasoning|thinking 命名,
	// 与前端 aiAnalysisProviders.isReasoningModel 保持一致(原注释声称同步、实则后端漏了 deepseek-reasoner → 误发 temperature)。
	// 这类模型自带思考、对采样参数「轻则忽略、重则 400」,故统一不下发采样参数(见 stripReasoningUnsupportedParams)。
	// 注意:它比 isOpenAIReasoningModel 更广;后者仅决定 max_completion_tokens vs max_tokens(DeepSeek reasoner 仍用 max_tokens)。
	private static final java.util.regex.Pattern REASONING_R1_PATTERN = java.util.regex.Pattern.compile("(^|[^a-z0-9])r1([^a-z0-9]|$)");
	static boolean isReasoningModel(String model){
		if(model == null) {
			return false;
		}
		if(isOpenAIReasoningModel(model)) {
			return true;
		}
		String m = model.trim().toLowerCase();
		int slash = m.lastIndexOf('/');
		if(slash >= 0) {
			m = m.substring(slash + 1);
		}
		if(m.contains("reasoner") || m.contains("reasoning") || m.contains("thinking")) {
			return true;
		}
		// Kimi k2 系(kimi-k2.5/k2.6/k2.7-code 等):官方仅允许 temperature=1,发其它值直接
		// 400「invalid temperature: only 1 is allowed for this model」(LIVE 实测,即「测试连接失败 400」
		// 的最终真因)。按推理模型口径剥离采样参数,用模型默认值。moonshot-v1-* 不受影响。
		if(m.startsWith("kimi-k2")) {
			return true;
		}
		return REASONING_R1_PATTERN.matcher(m).find();
	}

	// DeepSeek 官方:reasoner 收到 temperature/top_p/presence_penalty/frequency_penalty「不报错但无效」,
	// 收到 logprobs/top_logprobs「直接 400」;且 R1 多家网关实测对 temperature 也会 400。最稳:推理模型一律剥离这些采样参数。
	private static final Set<String> REASONING_UNSUPPORTED_PARAMS = new LinkedHashSet<String>(Arrays.asList(
		"temperature", "top_p", "presence_penalty", "frequency_penalty", "logprobs", "top_logprobs"));
	static Map<String, Object> stripReasoningUnsupportedParams(Map<String, Object> body){
		Map<String, Object> out = new LinkedHashMap<String, Object>();
		for(Map.Entry<String, Object> e : body.entrySet()) {
			if(REASONING_UNSUPPORTED_PARAMS.contains(e.getKey())) {
				continue;
			}
			out.put(e.getKey(), e.getValue());
		}
		return out;
	}

	static Map<String, Object> buildOpenAIChatBody(String model, Map<String, Object> params, List<Map<String, Object>> messages, boolean stream){
		Map<String, Object> requestBody = new LinkedHashMap<String, Object>();
		requestBody.put("model", model);
		requestBody.put("messages", toOpenAIVisionMessages(messages)); // 2F：含图片消息转多模态 content；纯文本原样
		boolean openAIReasoning = isOpenAIReasoningModel(model); // 仅 OpenAI o/gpt-5 系:用 max_completion_tokens
		boolean reasoning = isReasoningModel(model);             // 广义推理模型(含 deepseek-reasoner/*-r1):不下发采样参数
		if(!reasoning) {
			requestBody.put("temperature", numVal(params.get("temperature"), 0.7));
		}
		requestBody.put("stream", stream);
		// 2A：流式请求开 stream_options.include_usage，OpenAI 系会在末帧把 usage 一起带回；非 OpenAI 兼容端口收到不识别字段一般忽略。
		if(stream) {
			Map<String, Object> streamOptions = new LinkedHashMap<String, Object>();
			streamOptions.put("include_usage", true);
			requestBody.put("stream_options", streamOptions);
		}
		int maxTokens = intVal(params.get("maxTokens"), 0);
		if(maxTokens > 0) {
			requestBody.put(openAIReasoning ? "max_completion_tokens" : "max_tokens", maxTokens);
		}
		Map<String, Object> prov = buildProviderBodyOptions(params);
		if(reasoning) {
			prov = stripReasoningUnsupportedParams(prov); // 防 reasoner 因 top_p/logprobs 等采样参数 400(#16)
		}
		requestBody.putAll(prov);
		return requestBody;
	}

	// 2A：从 OpenAI 兼容响应 payload 抽 usage（聊天的 usage 通常出现在 stream 末帧 / 非 stream 顶层）。
	@SuppressWarnings("rawtypes")
	static Map<String, Object> extractOpenAIUsage(Map<String, Object> payload){
		if(payload == null) { return null; }
		Object u = payload.get("usage");
		if(!(u instanceof Map)) { return null; }
		Map mu = (Map) u;
		Map<String, Object> out = new LinkedHashMap<String, Object>();
		long inT = numLong(mu.get("prompt_tokens"));
		long outT = numLong(mu.get("completion_tokens"));
		long total = numLong(mu.get("total_tokens"));
		if(inT > 0) { out.put("input_tokens", inT); }
		if(outT > 0) { out.put("output_tokens", outT); }
		if(total > 0) { out.put("total_tokens", total); }
		if(out.isEmpty()) { return null; }
		return out;
	}

	static long numLong(Object v){
		if(v == null) { return 0L; }
		if(v instanceof Number) { return ((Number)v).longValue(); }
		try { return Long.parseLong(String.valueOf(v).trim()); } catch(Exception ignore) { return 0L; }
	}

	// 2A：Anthropic 流。message_start.message.usage 给输入；message_delta.usage 累加输出（output_tokens）。
	@SuppressWarnings("rawtypes")
	static Map<String, Object> extractAnthropicUsage(String eventName, Map<String, Object> payload){
		if(payload == null) { return null; }
		Object usageObj = null;
		if("message_start".equals(eventName)) {
			Object msg = payload.get("message");
			if(msg instanceof Map) { usageObj = ((Map)msg).get("usage"); }
		} else if("message_delta".equals(eventName) || "message_stop".equals(eventName)) {
			usageObj = payload.get("usage");
		}
		if(!(usageObj instanceof Map)) { return null; }
		Map mu = (Map) usageObj;
		Map<String, Object> out = new LinkedHashMap<String, Object>();
		long inT = numLong(mu.get("input_tokens"));
		long outT = numLong(mu.get("output_tokens"));
		if(inT > 0) { out.put("input_tokens", inT); }
		if(outT > 0) { out.put("output_tokens", outT); }
		if(out.isEmpty()) { return null; }
		if(out.containsKey("input_tokens") && out.containsKey("output_tokens")) {
			out.put("total_tokens", inT + outT);
		}
		return out;
	}

	// 2A：Gemini 流。末 chunk 通常带 usageMetadata: {promptTokenCount, candidatesTokenCount, totalTokenCount}.
	@SuppressWarnings("rawtypes")
	static Map<String, Object> extractGeminiUsage(Map<String, Object> payload){
		if(payload == null) { return null; }
		Object u = payload.get("usageMetadata");
		if(!(u instanceof Map)) { return null; }
		Map mu = (Map) u;
		Map<String, Object> out = new LinkedHashMap<String, Object>();
		long inT = numLong(mu.get("promptTokenCount"));
		long outT = numLong(mu.get("candidatesTokenCount"));
		long total = numLong(mu.get("totalTokenCount"));
		if(inT > 0) { out.put("input_tokens", inT); }
		if(outT > 0) { out.put("output_tokens", outT); }
		if(total > 0) { out.put("total_tokens", total); }
		if(out.isEmpty()) { return null; }
		return out;
	}

	// 2A：Ollama 原生。done=true 的末帧带 prompt_eval_count + eval_count.
	@SuppressWarnings("rawtypes")
	static Map<String, Object> extractOllamaUsage(Map<String, Object> payload){
		if(payload == null) { return null; }
		long inT = numLong(payload.get("prompt_eval_count"));
		long outT = numLong(payload.get("eval_count"));
		if(inT <= 0 && outT <= 0) { return null; }
		Map<String, Object> out = new LinkedHashMap<String, Object>();
		if(inT > 0) { out.put("input_tokens", inT); }
		if(outT > 0) { out.put("output_tokens", outT); }
		out.put("total_tokens", inT + outT);
		return out;
	}

	static Map<String, Object> buildAnthropicBody(String model, Map<String, Object> params, List<Map<String, Object>> messages, boolean stream){
		Map<String, Object> body = new LinkedHashMap<String, Object>();
		body.put("model", model);
		int maxTokens = intVal(params.get("maxTokens"), 2048);
		body.put("stream", stream);
		List<Map<String, Object>> normalized = new ArrayList<Map<String, Object>>();
		List<String> systemParts = new ArrayList<String>();
		for(Map<String, Object> one : messages) {
			String role = stringVal(one, "role");
			String content = stringVal(one, "content");
			List<String> imgs = imageUrlList(one.get("images")); // 2F：多媒体输入
			if(StringUtility.isNullOrEmpty(content) && imgs.isEmpty()) {
				continue;
			}
			if("system".equals(role)) {
				systemParts.add(content);
				continue;
			}
			Map<String, Object> item = new LinkedHashMap<String, Object>();
			item.put("role", "assistant".equals(role) ? "assistant" : "user");
			// v2.2.1 (Mac #9):Anthropic /v1/messages 的 content 块必须带 type:"text",
			// 否则上游报 "messages.content: missing field `type`"(503)。
			// 旧代码复用了 Gemini 用的 buildTextPart(只有 text 字段)→ Anthropic 对话与测试连接全失败。
			List<Object> blocks = new ArrayList<Object>();
			if(!StringUtility.isNullOrEmpty(content)) {
				blocks.add(buildAnthropicTextPart(content));
			}
			for(String u : imgs) { // 2F：附图块（base64/url source）
				Map<String, Object> ib = anthropicImageBlock(u);
				if(ib != null) { blocks.add(ib); }
			}
			if(blocks.isEmpty()) {
				blocks.add(buildAnthropicTextPart(content));
			}
			item.put("content", blocks);
			normalized.add(item);
		}
		if(!systemParts.isEmpty()) {
			body.put("system", String.join("\n\n", systemParts));
		}
		Map<String, Object> aprov = buildProviderBodyOptions(params);
		// 2B/2G/2H：Anthropic 显式映射停止序列、思考档。
		Object stopVal = aprov.remove("stop");
		List<String> stopList = anthropicStopList(stopVal);
		Object stopSeqVal = aprov.remove("stop_sequences");
		List<String> existingStopSeqs = anthropicStopList(stopSeqVal);
		if(!existingStopSeqs.isEmpty()) { stopList.addAll(existingStopSeqs); }
		if(!stopList.isEmpty()) { body.put("stop_sequences", stopList); }
		// 🔴 Anthropic extended thinking 有硬约束(不合规即 400)：① temperature 只能为 1 或不发；
		//    ② 不兼容 top_p / top_k 修改；③ max_tokens 必须 > thinking.budget_tokens。
		//    历史 bug：buildAnthropicBody 无条件发 temperature(默认 0.7) 并透传 top_k → 用户一旦开「思考档」,
		//    聊天/测试连接必 400（"temperature ... only ... when thinking is enabled"）。本修复让思考档真正可用、零报错。
		Object thinkingObj = aprov.remove("thinking");
		boolean thinkingEnabled = false;
		if(thinkingObj instanceof Map) {
			Map<?, ?> th = (Map<?, ?>) thinkingObj;
			if("enabled".equals(stringFromAny(th.get("type")))) {
				thinkingEnabled = true;
				int budget = intVal(th.get("budget_tokens"), 0);
				if(budget > 0 && maxTokens <= budget) {
					maxTokens = budget + 1024; // 保证 max_tokens > budget_tokens
				}
			}
			body.put("thinking", thinkingObj);
		}
		body.put("max_tokens", maxTokens);
		if(thinkingEnabled) {
			// 思考开启：不发 temperature（默认即 1）、剔除 top_p / top_k（均与思考不兼容）。
			aprov.remove("temperature");
			aprov.remove("top_p");
			aprov.remove("top_k");
		} else {
			body.put("temperature", numVal(params.get("temperature"), 0.7));
		}
		// 频率/存在惩罚、response_format 都不是 Anthropic 字段，直接丢弃避免 400。
		aprov.remove("frequency_penalty");
		aprov.remove("presence_penalty");
		aprov.remove("response_format");
		body.putAll(aprov);
		body.put("messages", normalized);
		return body;
	}

	// 2B/2G：把 stop 字段（字符串/列表）归一化为 Anthropic/Gemini 的 stop_sequences 列表。
	@SuppressWarnings("rawtypes")
	static List<String> anthropicStopList(Object stopVal){
		List<String> out = new ArrayList<String>();
		if(stopVal instanceof List) {
			for(Object o : (List)stopVal) {
				String t = String.valueOf(o == null ? "" : o).trim();
				if(!t.isEmpty()) { out.add(t); }
			}
		} else if(stopVal != null) {
			String t = String.valueOf(stopVal).trim();
			if(!t.isEmpty()) { out.add(t); }
		}
		return out;
	}

	@SuppressWarnings({"rawtypes","unchecked"})
	private static Map<String, Object> buildGeminiBody(Map<String, Object> params, List<Map<String, Object>> messages){
		Map<String, Object> body = new LinkedHashMap<String, Object>();
		List<Map<String, Object>> normalized = new ArrayList<Map<String, Object>>();
		List<String> systemParts = new ArrayList<String>();
		for(Map<String, Object> one : messages) {
			String role = stringVal(one, "role");
			String content = stringVal(one, "content");
			List<String> imgs = imageUrlList(one.get("images")); // 2B：多媒体输入
			if(StringUtility.isNullOrEmpty(content) && imgs.isEmpty()) {
				continue;
			}
			if("system".equals(role)) {
				systemParts.add(content);
				continue;
			}
			Map<String, Object> item = new LinkedHashMap<String, Object>();
			item.put("role", "assistant".equals(role) ? "model" : "user");
			List<Object> parts = new ArrayList<Object>();
			if(!StringUtility.isNullOrEmpty(content)) {
				parts.add(buildTextPart(content));
			}
			for(String u : imgs) {
				Map<String, Object> p = geminiImagePart(u);
				if(p != null) { parts.add(p); }
			}
			if(parts.isEmpty()) {
				parts.add(buildTextPart(content));
			}
			item.put("parts", parts);
			normalized.add(item);
		}
		body.put("contents", normalized);
		if(!systemParts.isEmpty()) {
			Map<String, Object> instruction = new LinkedHashMap<String, Object>();
			instruction.put("parts", Arrays.asList(buildTextPart(String.join("\n\n", systemParts))));
			body.put("systemInstruction", instruction);
		}
		// 2B/2G/2H：把扁平的 providerOptions 拍进 Gemini 的 generationConfig（OpenAI 形参数自动映射）。
		Map<String, Object> gprov = buildProviderBodyOptions(params);
		Map<String, Object> genCfgIn = gprov.get("generationConfig") instanceof Map ? (Map<String, Object>) gprov.remove("generationConfig") : null;
		Map<String, Object> generationConfig = new LinkedHashMap<String, Object>();
		// 温度参数
		Object t = numVal(params.get("temperature"), 0.7);
		generationConfig.put("temperature", t);
		Object tp = gprov.remove("top_p");
		if(tp != null) { generationConfig.put("topP", tp); }
		Object tk = gprov.remove("top_k");
		if(tk != null) { generationConfig.put("topK", tk); }
		int gMax = intVal(params.get("maxTokens"), 0);
		if(gMax > 0) { generationConfig.put("maxOutputTokens", gMax); }
		// stop → stopSequences
		List<String> stops = anthropicStopList(gprov.remove("stop"));
		List<String> existingStops = anthropicStopList(gprov.remove("stopSequences"));
		if(!existingStops.isEmpty()) { stops.addAll(existingStops); }
		if(!stops.isEmpty()) { generationConfig.put("stopSequences", stops); }
		// response_format → responseMimeType
		Object rf = gprov.remove("response_format");
		if(rf instanceof Map) {
			String typ = String.valueOf(((Map)rf).get("type")).toLowerCase();
			if("json_object".equals(typ) || "json".equals(typ)) {
				generationConfig.put("responseMimeType", "application/json");
			}
		}
		// thinkingConfig（直接放入 generationConfig）
		Object thinkingCfg = gprov.remove("thinkingConfig");
		if(thinkingCfg instanceof Map) { generationConfig.put("thinkingConfig", thinkingCfg); }
		else {
			Object th = gprov.remove("thinking");
			if(th instanceof Map) { generationConfig.put("thinkingConfig", th); }
		}
		// 让 frontend 已有的 generationConfig 覆盖（最高优先）。
		if(genCfgIn != null) { generationConfig.putAll(genCfgIn); }
		// 频率/存在惩罚：Gemini 无对应字段，丢弃。
		gprov.remove("frequency_penalty");
		gprov.remove("presence_penalty");
		body.put("generationConfig", generationConfig);
		// 防漏(#23)：归属 generationConfig 的采样键绝不能留在请求顶层，否则 Gemini 报 400。
		// 对照 buildAnthropicBody 的 aprov.remove("temperature")，此处同样剔除后再 putAll。
		gprov.remove("temperature");
		gprov.remove("max_tokens");
		gprov.remove("maxTokens");
		gprov.remove("maxOutputTokens");
		gprov.remove("n");
		gprov.remove("logprobs");
		gprov.remove("top_logprobs");
		body.putAll(gprov);
		return body;
	}

	// 2B：Gemini 视觉 part：dataURL → inlineData; http(s) URL → fileData。失败 → null。
	static Map<String, Object> geminiImagePart(String url){
		if(url == null) { return null; }
		String u = url.trim();
		if(u.startsWith("data:")) {
			int comma = u.indexOf(',');
			int semi = u.indexOf(';');
			if(comma < 0 || semi < 6) { return null; }
			Map<String, Object> inline = new LinkedHashMap<String, Object>();
			inline.put("mimeType", u.substring(5, semi));
			inline.put("data", u.substring(comma + 1));
			Map<String, Object> part = new LinkedHashMap<String, Object>();
			part.put("inlineData", inline);
			return part;
		} else if(u.startsWith("http://") || u.startsWith("https://")) {
			Map<String, Object> fileData = new LinkedHashMap<String, Object>();
			fileData.put("mimeType", "image/png"); // 占位；具体 mime 由 Gemini 端探测
			fileData.put("fileUri", u);
			Map<String, Object> part = new LinkedHashMap<String, Object>();
			part.put("fileData", fileData);
			return part;
		}
		return null;
	}

	private static Map<String, Object> buildTextPart(String content){
		Map<String, Object> part = new LinkedHashMap<String, Object>();
		part.put("text", content);
		return part;
	}

	// v2.2.1 (Mac #9):Anthropic content block 需要 type:"text"(Gemini 的 parts 不需要,故单独一个)。
	private static Map<String, Object> buildAnthropicTextPart(String content){
		Map<String, Object> part = new LinkedHashMap<String, Object>();
		part.put("type", "text");
		part.put("text", content);
		return part;
	}

	private HttpRequest buildJsonRequest(String url, Map<String, String> headers, String json, Map<String, Object> params){
		int timeoutMs = intVal(providerOptionsMap(params).get("requestTimeoutMs"), 0);
		HttpRequest.Builder builder = HttpRequest.newBuilder()
			.uri(URI.create(url))
			.POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8));
		// streaming exchanges: only cap when the user set an explicit timeout; otherwise let slow local LLMs run (connectTimeout still guards connect)
		if(timeoutMs > 0){
			builder.timeout(Duration.ofMillis(timeoutMs));
		}
		headers.forEach(builder::header);
		return builder.build();
	}

	// 非流式外呼统一走 JDK HttpClient(与流式同一 streamHttpClient,代理行为一致):
	// ① 请求头完全自控——老路径(框架 HTTP 工具)会向上游 AI 服务注入内部头(LocalIp)并对 GET 也发
	//    Content-Type,头面不干净;② 非 2xx 时直接拿到上游错误体,提取 error.message 拼成人话,
	//    不再抛「Failed : HTTP error code …request-header:{…}」这类用户不可读 dump(Kimi 测试连接 400 的
	//    报错体验即此问题)。GET 不发 Content-Type(无 body,语义正确)。
	private String sendUpstreamForText(String method, String url, Map<String, String> headers, String json, Map<String, Object> params) {
		int timeoutMs = intVal(providerOptionsMap(params).get("requestTimeoutMs"), 0);
		HttpRequest.Builder builder = HttpRequest.newBuilder()
			.uri(URI.create(url))
			.timeout(Duration.ofMillis(timeoutMs > 0 ? timeoutMs : 60000));
		boolean isPost = "POST".equalsIgnoreCase(method);
		if(isPost) {
			builder.POST(HttpRequest.BodyPublishers.ofString(json == null ? "" : json, StandardCharsets.UTF_8));
		}else {
			builder.GET();
		}
		if(headers != null) {
			for(Map.Entry<String, String> entry : headers.entrySet()) {
				if(!isPost && "Content-Type".equalsIgnoreCase(entry.getKey())) {
					continue;
				}
				builder.header(entry.getKey(), entry.getValue());
			}
		}
		try{
			HttpResponse<String> response = streamHttpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
			int status = response.statusCode();
			String bodyText = response.body() == null ? "" : response.body();
			if(status < 200 || status >= 300) {
				throw new ErrorCodeException(580021, formatUpstreamHttpError(status, bodyText));
			}
			return bodyText;
		}catch(ErrorCodeException e){
			throw e;
		}catch(Exception e){
			throw new ErrorCodeException(580022, "上游 provider 请求异常：" + safeErrorMessage(e));
		}
	}

	// 非 2xx 错误的人话格式：先放提取出的上游 error.message(各家 OpenAI 兼容口/Anthropic/Gemini 通用形态),
	// 原始体截断后置(诊断用)。前端 message 只显示前 200 字符 → 人话必须在最前。
	static String formatUpstreamHttpError(int status, String bodyText){
		String friendly = extractUpstreamErrorMessage(bodyText);
		String raw = bodyText == null ? "" : bodyText.trim();
		if(raw.length() > 600) {
			raw = raw.substring(0, 600) + "…";
		}
		StringBuilder sb = new StringBuilder();
		sb.append("上游服务返回 HTTP ").append(status);
		if(!StringUtility.isNullOrEmpty(friendly)) {
			sb.append("：").append(friendly);
		}
		if(!StringUtility.isNullOrEmpty(raw) && !raw.equals(friendly)) {
			sb.append("（原始响应：").append(raw).append("）");
		}
		return sb.toString();
	}

	// 从上游错误体提取人话:OpenAI 兼容 {"error":{"message":…}} / Anthropic/Gemini 同形 /
	// 部分国产口 {"message":…} 或 {"error":"…"} 或 {"msg":…}。解析失败返回空串。
	@SuppressWarnings("rawtypes")
	static String extractUpstreamErrorMessage(String bodyText){
		if(StringUtility.isNullOrEmpty(bodyText)) {
			return "";
		}
		try{
			Map<String, Object> payload = JsonUtility.toDictionary(bodyText.trim());
			if(payload == null) {
				return "";
			}
			Object error = payload.get("error");
			if(error instanceof Map) {
				Object message = ((Map)error).get("message");
				if(message instanceof String && !StringUtility.isNullOrEmpty((String)message)) {
					return (String)message;
				}
			}
			if(error instanceof String && !StringUtility.isNullOrEmpty((String)error)) {
				return (String)error;
			}
			Object message = payload.get("message");
			if(message instanceof String && !StringUtility.isNullOrEmpty((String)message)) {
				return (String)message;
			}
			Object msg = payload.get("msg");
			if(msg instanceof String && !StringUtility.isNullOrEmpty((String)msg)) {
				return (String)msg;
			}
		}catch(Exception e){
			// 非 JSON 错误体:返回空串,由调用方带原始截断
		}
		return "";
	}

	private static Map<String, Object> providerOptionsMap(Map<String, Object> params){
		Object providerOptions = params == null ? null : params.get("providerOptions");
		if(providerOptions instanceof Map) {
			return (Map<String, Object>)providerOptions;
		}
		return new LinkedHashMap<String, Object>();
	}

	private static Map<String, Object> mapVal(Object value){
		if(value instanceof Map) {
			return (Map<String, Object>)value;
		}
		return new LinkedHashMap<String, Object>();
	}

	static Map<String, Object> buildProviderBodyOptions(Map<String, Object> params){
		Map<String, Object> options = providerOptionsMap(params);
		Map<String, Object> result = new LinkedHashMap<String, Object>();
		Map<String, Object> extraBody = mapVal(options.get("extraBody"));
		result.putAll(extraBody);
		for(Map.Entry<String, Object> entry : options.entrySet()) {
			String key = entry.getKey();
			if("extraHeaders".equals(key)
				|| "extraBody".equals(key)
				|| "apiVersion".equals(key)
				|| "requestTimeoutMs".equals(key)
				|| "embeddingModel".equals(key)
				|| "authHeaderName".equals(key)
				|| "authPrefix".equals(key)) {
				continue;
			}
			result.put(key, entry.getValue());
		}
		return result;
	}

	// A4(#16 等):流式上游请求的「首字节前」瞬态退避重试。只在拿到响应头之前(连接失败 / 429 / 5xx)重试,
	// 一旦返回 2xx 就交给调用方读流 → 绝不会在已开始吐 token 之后重试(防重复计费、防重复内容)。尊重 Retry-After。
	private static final int DEFAULT_STREAM_RETRIES = 2;
	private HttpResponse<InputStream> sendStreamWithRetry(HttpRequest request, Map<String, Object> params) throws Exception {
		int extra = intVal(providerOptionsMap(params).get("maxRetries"), DEFAULT_STREAM_RETRIES);
		if(extra < 0) { extra = 0; }
		if(extra > 5) { extra = 5; }
		int maxAttempts = 1 + extra;
		Exception lastError = null;
		for(int attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				HttpResponse<InputStream> response = streamHttpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
				int status = response.statusCode();
				if(status >= 200 && status < 300) {
					return response; // 已拿到 2xx 响应头 → 交调用方读流,此后不再重试
				}
				if(attempt < maxAttempts && isRetriableStatus(status)) {
					long wait = retryDelayMs(response, attempt);
					try { InputStream b = response.body(); if(b != null) { b.close(); } } catch(Exception ignore) {}
					AppLoggers.ErrorLogger.warn("ai.stream.retry status=" + status + " attempt=" + attempt + " waitMs=" + wait);
					sleepQuietly(wait);
					continue;
				}
				ensureSuccess(response); // 非可重试 / 次数耗尽 → 抛出含上游真因的错误
				return response;
			} catch(IOException e) {
				lastError = e; // 连接/传输层失败发生在首字节前 → 可重试
				if(attempt < maxAttempts) {
					long wait = backoffMs(attempt);
					AppLoggers.ErrorLogger.warn("ai.stream.retry io=" + e.getClass().getSimpleName() + " attempt=" + attempt + " waitMs=" + wait);
					sleepQuietly(wait);
					continue;
				}
				throw e;
			}
		}
		if(lastError != null) { throw lastError; }
		throw new ErrorCodeException(580021, "上游 provider 请求失败");
	}

	private static boolean isRetriableStatus(int status){
		return status == 429 || status == 500 || status == 502 || status == 503 || status == 504 || status == 529;
	}

	private long retryDelayMs(HttpResponse<?> response, int attempt){
		try {
			java.util.Optional<String> ra = response.headers().firstValue("retry-after");
			if(ra.isPresent()) {
				long sec = Long.parseLong(ra.get().trim());
				if(sec > 0 && sec <= 60) {
					return sec * 1000L;
				}
			}
		} catch(Exception ignore) {}
		return backoffMs(attempt);
	}

	private long backoffMs(int attempt){
		long base = 600L * (1L << Math.min(attempt - 1, 4)); // 600,1200,2400,4800,9600
		base = Math.min(base, 8000L);
		long jitter = java.util.concurrent.ThreadLocalRandom.current().nextLong(0L, 400L);
		return base + jitter;
	}

	private static void sleepQuietly(long ms){
		try {
			Thread.sleep(ms);
		} catch(InterruptedException e) {
			Thread.currentThread().interrupt();
		}
	}

	private void ensureSuccess(HttpResponse<?> response){
		int status = response.statusCode();
		if(status >= 200 && status < 300) {
			return;
		}
		String detail = readErrorBody(response.body());
		// 与非流式路径同口径:先人话(上游 error.message)后原始截断,用户可读。
		throw new ErrorCodeException(580021, formatUpstreamHttpError(status, detail));
	}

	// 仅在非 2xx 分支消费流式响应体，截断后并入错误信息，让上游真因(如 temperature/参数不支持)透传到 error 事件。
	static String readErrorBody(Object body){
		if(!(body instanceof InputStream)) {
			return "";
		}
		try(InputStream in = (InputStream) body){
			byte[] buf = in.readNBytes(16384);
			String text = new String(buf, StandardCharsets.UTF_8).trim();
			if(text.length() > 4000) {
				text = text.substring(0, 4000) + "…";
			}
			return text;
		}catch(Exception e){
			return "";
		}
	}

	// try-with-resources:同 readNdjsonStream —— 中途断流(用户停止/网络抖动)时关闭底层 socket,防 fd 泄漏。
	private void readSseStream(InputStream stream, SseLineHandler handler) throws IOException{
		try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
			String line;
			String eventName = "";
			StringBuilder dataBuilder = new StringBuilder();
			while((line = reader.readLine()) != null) {
				if(line.isEmpty()) {
					if(dataBuilder.length() > 0) {
						handler.onEvent(eventName, dataBuilder.toString().trim());
						dataBuilder.setLength(0);
						eventName = "";
					}
					continue;
				}
				if(line.startsWith("event:")) {
					eventName = line.substring(6).trim();
					continue;
				}
				if(line.startsWith("data:")) {
					if(dataBuilder.length() > 0) {
						dataBuilder.append('\n');
					}
					dataBuilder.append(line.substring(5).trim());
				}
			}
			if(dataBuilder.length() > 0) {
				handler.onEvent(eventName, dataBuilder.toString().trim());
			}
		}
	}

	private void sendEvent(SseChannel channel, String eventName, Map<String, Object> payload){
		try{
			// [并发根修] 每 token 在池化 worker 线程写请求属性(旧「mark 当前线程」调用)是并发空响应/NPE 主凶:
			// 客户端中断后 Tomcat 回收该 Request 分配给下一个请求,worker 仍在向"别人的请求"写 __sse__,
			// 穿插的 JSON 请求被误判为 event-stream → 一字节正文不写;撞上 recycle() 清属性则 NPE。
			// __sse__ 已由 servlet 线程在 SseHelper.push() 设置;afterCompletion 另有 SseEmitter 返回类型兜底。
			channel.send(SseEmitter.event()
				.name(eventName)
				.data(JsonUtility.encode(payload)));
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}

	private Map<String, Object> diagnoseDns(String host){
		Instant st = Instant.now();
		try{
			InetAddress[] addresses = InetAddress.getAllByName(host);
			long latencyMs = Duration.between(st, Instant.now()).toMillis();
			List<String> ips = new ArrayList<String>();
			for(InetAddress address : addresses) {
				ips.add(address.getHostAddress());
			}
			return buildMap(
				"ok", true,
				"latencyMs", latencyMs,
				"addresses", ips
			);
		}catch(Exception e){
			return buildMap(
				"ok", false,
				"message", safeErrorMessage(e)
			);
		}
	}

	private Map<String, Object> diagnoseTcp(String host, int port){
		Instant st = Instant.now();
		try(Socket socket = new Socket()) {
			socket.connect(new InetSocketAddress(host, port), 6000);
			long latencyMs = Duration.between(st, Instant.now()).toMillis();
			return buildMap(
				"ok", true,
				"latencyMs", latencyMs,
				"host", host,
				"port", port
			);
		}catch(Exception e){
			return buildMap(
				"ok", false,
				"host", host,
				"port", port,
				"message", safeErrorMessage(e)
			);
		}
	}

	private String normalizedProviderType(Map<String, Object> params){
		String providerType = stringVal(params, "providerType");
		if(StringUtility.isNullOrEmpty(providerType)) {
			throw new ErrorCodeException(580001, "缺少 providerType");
		}
		return providerType.trim().toLowerCase();
	}

	private String requireModel(Map<String, Object> params){
		String model = stringVal(params, "model");
		if(StringUtility.isNullOrEmpty(model)) {
			throw new ErrorCodeException(580012, "缺少 model");
		}
		return model;
	}

	private String requireEmbeddingModel(Map<String, Object> params){
		String model = stringVal(params, "embeddingModel");
		if(StringUtility.isNullOrEmpty(model)) {
			model = stringVal(params, "model");
		}
		if(StringUtility.isNullOrEmpty(model)) {
			throw new ErrorCodeException(580030, "缺少 embeddingModel");
		}
		return model;
	}

	private static List<String> getStringList(Object obj){
		List<String> result = new ArrayList<String>();
		if(obj instanceof List) {
			for(Object one : (List)obj) {
				String text = stringFromAny(one);
				if(!StringUtility.isNullOrEmpty(text)) {
					result.add(text);
				}
			}
		}else {
			String text = stringFromAny(obj);
			if(!StringUtility.isNullOrEmpty(text)) {
				result.add(text);
			}
		}
		return result;
	}

	private static List<Double> numberList(Object obj){
		List<Double> result = new ArrayList<Double>();
		if(!(obj instanceof List)) {
			return result;
		}
		for(Object item : (List)obj) {
			try{
				result.add(Double.parseDouble(String.valueOf(item)));
			}catch(Exception e){
			}
		}
		return result;
	}

	private static List<String> uniqueStrings(List<String> list){
		Set<String> result = new LinkedHashSet<String>();
		for(String item : list) {
			String text = item == null ? "" : item.trim();
			if(!StringUtility.isNullOrEmpty(text)) {
				result.add(text);
			}
		}
		return new ArrayList<String>(result);
	}

	private static String classifyFailure(Exception e){
		String text = safeErrorMessage(e).toLowerCase();
		if(text.contains("unknownhost") || text.contains("name or service not known")) {
			return "dns";
		}
		if(text.contains("connect") || text.contains("timeout") || text.contains("timed out")) {
			return "network";
		}
		if(text.contains("401") || text.contains("403") || text.contains("unauthorized")) {
			return "auth";
		}
		return "http";
	}

	private static String buildFailureRecommendation(String providerType, String failureReason){
		if("dns".equals(failureReason)) {
			return "请检查 Base URL 是否正确，以及当前网络的 DNS 解析是否正常。";
		}
		if("network".equals(failureReason)) {
			if("ollama".equals(providerType)) {
				return "请确认 Ollama 本地服务已启动，并且地址与端口填写正确。";
			}
			return "请检查网络连通性、代理设置和服务端口是否可访问。";
		}
		if("auth".equals(failureReason)) {
			return "请检查 API Key、请求头和供应商类型是否匹配。";
		}
		if("gemini".equals(providerType)) {
			return "请确认 Gemini API Key 可用，并检查是否启用了对应模型权限。";
		}
		return "请检查 Base URL、模型权限和供应商预设是否匹配。";
	}

	private static String urlEncode(String text){
		return URLEncoder.encode(text == null ? "" : text, StandardCharsets.UTF_8);
	}

	private static String safeErrorMessage(Exception e){
		if(e == null){
			return "未知错误";
		}
		String text = e.getMessage();
		return StringUtility.isNullOrEmpty(text) ? e.getClass().getSimpleName() : text;
	}

	private static Map<String, Object> buildMap(Object... args){
		Map<String, Object> map = new LinkedHashMap<String, Object>();
		for(int i=0; i<args.length; i += 2) {
			map.put(String.valueOf(args[i]), args[i + 1]);
		}
		return map;
	}

	private static String stringVal(Map<String, Object> map, String key){
		if(map == null || key == null) {
			return "";
		}
		return stringFromAny(map.get(key));
	}

	private static String stringFromAny(Object obj){
		return obj == null ? "" : String.valueOf(obj).trim();
	}

	private static double numVal(Object obj, double defVal){
		try {
			return obj == null ? defVal : Double.parseDouble(String.valueOf(obj));
		}catch(Exception e) {
			return defVal;
		}
	}

	private static int intVal(Object obj, int defVal){
		try {
			return obj == null ? defVal : Integer.parseInt(String.valueOf(obj));
		}catch(Exception e) {
			return defVal;
		}
	}

	private interface SseLineHandler {
		void onEvent(String eventName, String dataText) throws IOException;
	}
}
