package spacex.astrostudy.service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

import org.springframework.stereotype.Service;

import boundless.exception.ErrorCodeException;
import boundless.net.http.LoopbackDirectProxySelector;
import boundless.utility.JsonUtility;

/**
 * AI 决策层(TypeSafe System One)· 本地转发(出站④,默认关:前端总开关未开时根本不调)。
 *
 * <p>形态与网页读取 / 联网检索同一套纪律:独立 {@link HttpClient}(不跟随重定向;连接 5 s;走系统代理选择器,回环直连);
 * 出站地址 = (基址去尾斜杠 || 官方地址) + {@code /v1/systemone},每次请求前过 {@link OutboundUrlGuard#validate} 基础档;
 * 头只有 Authorization / Content-Type / Accept(不接受调用方自定义头);体 {@code {state, model, questions}}。
 * 上限:单项序列化 ≤ 512 KB;批量 ≤ 16 项、并发 ≤ 4(有界线程池,finally 必拆);响应读取 ≤ 1 MB。
 * 时限与重试:整次调用一个总时限 timeoutMs(500–30000);只对 429 / 529 / 500 / 502 / 503 / 504 重试;Retry-After 不超过剩余时限;
 * 退避 300 ms·2ⁿ + 抖动;maxRetries 钳 0–2。
 * <b>本服务永不写日志;错误里绝不带上游正文、绝不带 key</b>;失败一律回 {@code {ok:false, status, code}}(不抛),批量单项失败不拖垮整批。
 */
@Service
public class AISystemOneService {

	public static final String DEFAULT_BASE_URL = "https://api.typesafe.ai";
	public static final String ENDPOINT_PATH = "/v1/systemone";
	public static final String DEFAULT_MODEL = "jev-latest";

	public static final String E_HTTP = "E_SYSTEMONE_HTTP";
	public static final String E_TIMEOUT = "E_SYSTEMONE_TIMEOUT";
	public static final String E_NETWORK = "E_SYSTEMONE_NETWORK";
	public static final String E_GUARD = "E_SYSTEMONE_GUARD";
	public static final String E_TOO_LARGE = "E_SYSTEMONE_TOO_LARGE";
	public static final String E_BAD_REQUEST = "E_SYSTEMONE_BAD_REQUEST";

	public static final int ITEM_MAX_BYTES = 512 * 1024;
	public static final int RESPONSE_MAX_BYTES = 1024 * 1024;
	public static final int BATCH_MAX = 16;
	public static final int CONCURRENCY_MAX = 4;
	public static final int TIMEOUT_MIN_MS = 500;
	public static final int TIMEOUT_MAX_MS = 30000;
	public static final int TIMEOUT_DEFAULT_MS = 10000;
	public static final int RETRIES_MAX = 2;
	public static final int BACKOFF_BASE_MS = 300;
	private static final int CONNECT_TIMEOUT_MS = 5000;
	private static final Set<String> QUESTION_TYPES = new HashSet<String>(Arrays.asList("noul", "choice", "score"));
	private static final Set<Integer> RETRIABLE = new HashSet<Integer>(Arrays.asList(
		Integer.valueOf(429), Integer.valueOf(529), Integer.valueOf(500), Integer.valueOf(502), Integer.valueOf(503), Integer.valueOf(504)));

	private final HttpClient client;

	public AISystemOneService() {
		// 路由与 AI 流式请求 / 网页读取 / 联网检索同一口径:外部地址按系统代理走,本机地址直连(全局 LoopbackDirectProxySelector 单源;
		// JDK HttpClient 取默认选择器会在构造那一刻定死 —— 构造早于入口安装就会让本机地址进代理,所以显式取已装好的那一个)
		this(HttpClient.newBuilder()
			.connectTimeout(Duration.ofMillis(CONNECT_TIMEOUT_MS))
			.proxy(LoopbackDirectProxySelector.install())
			.followRedirects(HttpClient.Redirect.NEVER)
			.build());
	}

	/** [测试缝] 仅供单测注入可控 HttpClient;Spring 走无参构造器。 */
	AISystemOneService(HttpClient injected) {
		this.client = injected;
	}

	/** 单项或批量入口(控制器直调)。 */
	public Map<String, Object> ask(Map<String, Object> params) {
		Map<String, Object> p = params == null ? new LinkedHashMap<String, Object>() : params;
		Object batch = p.get("batch");
		if (batch instanceof List) {
			return askBatch(p, (List<?>) batch);
		}
		Object request = p.get("request");
		Map<String, Object> item = request instanceof Map ? castMap(request) : null;
		if (item == null) {
			// 兼容平铺形态 {state, questions}
			item = new LinkedHashMap<String, Object>();
			item.put("state", p.get("state"));
			item.put("questions", p.get("questions"));
		}
		return askOne(p, item, deadlineOf(p));
	}

	Map<String, Object> askBatch(Map<String, Object> p, List<?> batch) {
		if (batch.isEmpty()) {
			return fail(0, E_BAD_REQUEST);
		}
		if (batch.size() > BATCH_MAX) {
			return fail(0, E_TOO_LARGE);
		}
		final long deadline = deadlineOf(p);
		int concurrency = clamp(intVal(p.get("concurrency"), CONCURRENCY_MAX), 1, CONCURRENCY_MAX);
		List<Map<String, Object>> results = new ArrayList<Map<String, Object>>();
		ExecutorService pool = Executors.newFixedThreadPool(Math.min(concurrency, batch.size()));
		try {
			List<Future<Map<String, Object>>> futures = new ArrayList<Future<Map<String, Object>>>();
			for (Object raw : batch) {
				final Map<String, Object> item = raw instanceof Map ? castMap(raw) : null;
				futures.add(pool.submit(() -> item == null ? fail(0, E_BAD_REQUEST) : askOne(p, item, deadline)));
			}
			for (Future<Map<String, Object>> f : futures) {
				Map<String, Object> r;
				try {
					long left = Math.max(1L, deadline - System.currentTimeMillis() + 1000L);
					r = f.get(left, TimeUnit.MILLISECONDS);
				} catch (java.util.concurrent.TimeoutException e) {
					f.cancel(true);
					r = fail(0, E_TIMEOUT);
				} catch (Exception e) {
					r = fail(0, E_NETWORK);
				}
				results.add(r);
			}
		} finally {
			pool.shutdownNow();
		}
		boolean any = false;
		String model = "";
		for (Map<String, Object> r : results) {
			if (Boolean.TRUE.equals(r.get("ok"))) {
				any = true;
				Object m = r.get("model");
				if (m != null && !String.valueOf(m).isEmpty()) {
					model = String.valueOf(m);
				}
			}
		}
		Map<String, Object> out = new LinkedHashMap<String, Object>();
		out.put("ok", Boolean.valueOf(any));
		out.put("results", results);
		out.put("model", model);
		return out;
	}

	/** 单项:校验 → 守卫 → 有总时限的重试环 → 有界读体 → 只回 {ok,status,model,answers,usage}。永不抛。 */
	Map<String, Object> askOne(Map<String, Object> p, Map<String, Object> item, long deadline) {
		String apiKey = str(p, "apiKey").trim();
		if (apiKey.isEmpty()) {
			return fail(0, E_BAD_REQUEST);
		}
		Object state = item.get("state");
		Object questions = item.get("questions");
		if (state == null || !validQuestions(questions)) {
			return fail(0, E_BAD_REQUEST);
		}
		String model = normalizeModel(str(p, "model").isEmpty() ? str(item, "model") : str(p, "model"));
		Map<String, Object> body = new LinkedHashMap<String, Object>();
		body.put("state", state);
		body.put("model", model);
		body.put("questions", questions);
		String json;
		try {
			json = JsonUtility.encode(body);
		} catch (RuntimeException e) {
			return fail(0, E_BAD_REQUEST);
		}
		if (json == null || json.getBytes(StandardCharsets.UTF_8).length > ITEM_MAX_BYTES) {
			return fail(0, E_TOO_LARGE);
		}
		String url;
		try {
			url = OutboundUrlGuard.validate(resolveEndpoint(str(p, "baseUrl")));
		} catch (ErrorCodeException e) {
			return fail(0, E_GUARD);
		} catch (RuntimeException e) {
			return fail(0, E_GUARD);
		}
		int maxRetries = clamp(intVal(p.get("maxRetries"), 1), 0, RETRIES_MAX);
		for (int attempt = 0; ; attempt++) {
			long left = deadline - System.currentTimeMillis();
			if (left <= 0) {
				return fail(0, E_TIMEOUT);
			}
			HttpRequest request = HttpRequest.newBuilder().uri(URI.create(url)).timeout(Duration.ofMillis(left))
				.header("Authorization", "Bearer " + apiKey)
				.header("Content-Type", "application/json")
				.header("Accept", "application/json")
				.POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8)).build();
			HttpResponse<InputStream> response;
			try {
				response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
			} catch (HttpTimeoutException e) {
				return fail(0, E_TIMEOUT);
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
				return fail(0, E_TIMEOUT);
			} catch (Exception e) {
				return fail(0, E_NETWORK);
			}
			int status = response.statusCode();
			try (InputStream in = response.body()) {
				if (status >= 200 && status < 300) {
					byte[] bytes = readBounded(in);
					if (bytes == null) {
						return fail(status, E_TOO_LARGE);
					}
					return success(status, new String(bytes, StandardCharsets.UTF_8));
				}
				drain(in);
				if (attempt < maxRetries && RETRIABLE.contains(Integer.valueOf(status))) {
					long remaining = deadline - System.currentTimeMillis();
					long wait = retryDelayMs(response.headers().firstValue("Retry-After").orElse(null), attempt);
					if (wait >= remaining) {
						return fail(status, E_HTTP);
					}
					sleepQuietly(wait);
					continue;
				}
				return fail(status, E_HTTP);
			} catch (Exception e) {
				return fail(status, E_NETWORK);
			}
		}
	}

	// ---- 形状 ----

	static Map<String, Object> success(int status, String bodyText) {
		Map<String, Object> payload = null;
		try {
			payload = JsonUtility.toDictionary(bodyText);
		} catch (RuntimeException e) {
			payload = null;
		}
		if (payload == null || !(payload.get("answers") instanceof Map)) {
			return fail(status, E_HTTP);
		}
		Map<String, Object> out = new LinkedHashMap<String, Object>();
		out.put("ok", Boolean.TRUE);
		out.put("status", Integer.valueOf(status));
		out.put("model", payload.get("model") == null ? "" : String.valueOf(payload.get("model")));
		out.put("answers", payload.get("answers"));
		out.put("usage", payload.get("usage") instanceof Map ? payload.get("usage") : new LinkedHashMap<String, Object>());
		return out;
	}

	static Map<String, Object> fail(int status, String code) {
		Map<String, Object> out = new LinkedHashMap<String, Object>();
		out.put("ok", Boolean.FALSE);
		out.put("status", Integer.valueOf(status));
		out.put("code", code);
		return out;
	}

	/** 基址去尾斜杠(空 = 官方地址)+ 固定路径;调用方不能改路径后缀。 */
	static String resolveEndpoint(String baseUrl) {
		String base = baseUrl == null ? "" : baseUrl.trim();
		while (base.endsWith("/")) {
			base = base.substring(0, base.length() - 1);
		}
		if (base.isEmpty()) {
			base = DEFAULT_BASE_URL;
		}
		return base + ENDPOINT_PATH;
	}

	static String normalizeModel(String model) {
		String m = model == null ? "" : model.trim().toLowerCase(Locale.ROOT);
		return m.matches("^jev-[a-z0-9.-]+$") ? m : DEFAULT_MODEL;
	}

	/** questions 须为非空映射;每问 type ∈ noul / choice / score 且 instructions 非空;choice 2–255 项;score 2–10 级。 */
	static boolean validQuestions(Object questions) {
		if (!(questions instanceof Map)) {
			return false;
		}
		Map<?, ?> qs = (Map<?, ?>) questions;
		if (qs.isEmpty()) {
			return false;
		}
		for (Map.Entry<?, ?> e : qs.entrySet()) {
			if (e.getKey() == null || String.valueOf(e.getKey()).trim().isEmpty() || !(e.getValue() instanceof Map)) {
				return false;
			}
			Map<?, ?> q = (Map<?, ?>) e.getValue();
			String type = q.get("type") == null ? "" : String.valueOf(q.get("type"));
			Object ins = q.get("instructions");
			if (!QUESTION_TYPES.contains(type) || ins == null || String.valueOf(ins).trim().isEmpty()) {
				return false;
			}
			Object criteria = q.get("criteria");
			if ("choice".equals(type)) {
				if (!(criteria instanceof Map) || ((Map<?, ?>) criteria).size() < 2 || ((Map<?, ?>) criteria).size() > 255) {
					return false;
				}
			} else if ("score".equals(type)) {
				if (!(criteria instanceof List) || ((List<?>) criteria).size() < 2 || ((List<?>) criteria).size() > 10) {
					return false;
				}
			}
		}
		return true;
	}

	static long deadlineOf(Map<String, Object> p) {
		int timeoutMs = clamp(intVal(p.get("timeoutMs"), TIMEOUT_DEFAULT_MS), TIMEOUT_MIN_MS, TIMEOUT_MAX_MS);
		return System.currentTimeMillis() + timeoutMs;
	}

	/** Retry-After(秒或 HTTP 日期)优先;否则 300 ms·2ⁿ + 抖动(≤ 100 ms)。 */
	static long retryDelayMs(String retryAfter, int attempt) {
		if (retryAfter != null) {
			String v = retryAfter.trim();
			try {
				long secs = Long.parseLong(v);
				if (secs >= 0) {
					return secs * 1000L;
				}
			} catch (NumberFormatException notSeconds) {
				try {
					long at = java.time.ZonedDateTime.parse(v, java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME).toInstant().toEpochMilli();
					long ms = at - System.currentTimeMillis();
					if (ms > 0) {
						return ms;
					}
				} catch (RuntimeException ignored) {
					// 非法值回落退避
				}
			}
		}
		return BACKOFF_BASE_MS * (1L << Math.min(attempt, 4)) + ThreadLocalRandom.current().nextInt(0, 101);
	}

	/** 有界读:超过上限回 null(调用方判 TOO_LARGE)。 */
	static byte[] readBounded(InputStream in) throws java.io.IOException {
		ByteArrayOutputStream buf = new ByteArrayOutputStream();
		byte[] chunk = new byte[8192];
		long total = 0;
		int n;
		while ((n = in.read(chunk)) > 0) {
			total += n;
			if (total > RESPONSE_MAX_BYTES) {
				return null;
			}
			buf.write(chunk, 0, n);
		}
		return buf.toByteArray();
	}

	private static void drain(InputStream in) {
		try {
			byte[] chunk = new byte[8192];
			long total = 0;
			while (in.read(chunk) > 0) {
				total += chunk.length;
				if (total > RESPONSE_MAX_BYTES) {
					return;   // 错误体也不无限吸
				}
			}
		} catch (Exception ignored) {
			// 错误体读不完无关判据
		}
	}

	private static void sleepQuietly(long ms) {
		try {
			Thread.sleep(Math.max(0L, ms));
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
		}
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> castMap(Object o) {
		return (Map<String, Object>) o;
	}

	private static String str(Map<String, Object> m, String key) {
		Object v = m == null ? null : m.get(key);
		return v == null ? "" : String.valueOf(v);
	}

	private static int intVal(Object o, int def) {
		if (o == null) {
			return def;
		}
		try {
			return (int) Math.round(Double.parseDouble(String.valueOf(o)));
		} catch (NumberFormatException e) {
			return def;
		}
	}

	private static int clamp(int v, int lo, int hi) {
		return Math.max(lo, Math.min(hi, v));
	}
}
