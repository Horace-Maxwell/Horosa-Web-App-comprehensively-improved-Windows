package spacex.astrostudy.service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import boundless.exception.ErrorCodeException;
import boundless.utility.JsonUtility;

/**
 * AI 助手·联网检索(出站②;默认关,由页面显式开关 + 用户自填引擎与 Key 才可达)。
 *
 * 形态:前端把「引擎 + Key + 查询」发到本端点,本端点转发给检索引擎并**归一**成同一形状回去:
 *   { engine, query, results:[{ title, url, snippet(≤500,已去 HTML), publishedAt }], fetchedAt }
 * 铁律:①Key 只在本次请求内用,既不落库也不写日志;②错误信息只含 HTTP 状态,永不回显 Key 或上游原文;
 *       ③独立 HttpClient(连接 10s / 单次 15s),**不重试**——检索是可由用户重发的只读动作,自动重试只会翻倍打上游;
 *       ④出站地址逐次过 {@link OutboundUrlGuard}(scheme 白名单 / 元数据与通配地址 / userinfo / 本应用端口 / 长度),
 *         重定向**绝不跟随**(一句 302 就能把外呼引到别处 = SSRF),回体有界读 {@link #MAX_RESPONSE_BYTES};
 *       ⑤传输层失败的文案带根因异常类名(连不上 / 超时 / TLS 分得清),仍不含 Key;本服务永不写日志。
 */
@Service
public class AIWebSearchService {

	public static final int ERR_NOT_CONFIGURED = 580041;
	public static final int ERR_UPSTREAM = 580042;
	public static final int ERR_EMPTY_QUERY = 580043;

	public static final int MAX_RESULTS = 10;
	public static final int SNIPPET_MAX = 500;
	private static final int QUERY_MAX = 300;
	private static final int CONNECT_TIMEOUT_MS = 10000;
	private static final int REQUEST_TIMEOUT_MS = 15000;
	/** 回体读上限:超过即断开读流并报 ERR_UPSTREAM(上游给多少吸多少 = 一次 20MB 回体就 20MB 进堆)。 */
	public static final long MAX_RESPONSE_BYTES = 2L * 1024 * 1024;

	private final HttpClient client;

	public AIWebSearchService() {
		this(HttpClient.newBuilder()
			.connectTimeout(Duration.ofMillis(CONNECT_TIMEOUT_MS))
			.followRedirects(HttpClient.Redirect.NEVER)
			.build());
	}

	/**
	 * [测试缝·I14] 仅供单测注入可控 HttpClient(本机假上游 / 短连接超时)。
	 * <p>无参构造器的策略(连接 10s、followRedirects=NEVER)是生产路径;
	 * Spring 在多构造器且无 @Autowired 时回退到无参构造器,注入口不影响容器装配。
	 */
	AIWebSearchService(HttpClient injected) {
		this.client = injected;
	}

	public Map<String, Object> search(Map<String, Object> params) {
		String engine = str(params, "engine").toLowerCase();
		String query = str(params, "query").trim();
		String apiKey = str(params, "apiKey");
		String baseUrl = str(params, "baseUrl").trim();
		int maxResults = clamp(intVal(params, "maxResults", 5), 1, MAX_RESULTS);
		String freshness = str(params, "freshness").trim();
		String site = str(params, "site").trim();
		if (query.isEmpty()) {
			throw new ErrorCodeException(ERR_EMPTY_QUERY, "检索词为空");
		}
		if (query.length() > QUERY_MAX) {
			query = query.substring(0, QUERY_MAX);
		}
		if (!site.isEmpty()) {
			query = query + " site:" + site;
		}
		if (engine.isEmpty()) {
			engine = "tavily";
		}
		// custom 端点的 Key 可选(有则以 Bearer 带上)——与前端 engineMeta(custom.needsKey=false)同口径;此前后端强制要 Key,自建无鉴权端点配了也用不了
		boolean needsKey = !("searxng".equals(engine) || "custom".equals(engine));
		if (needsKey && apiKey.isEmpty()) {
			throw new ErrorCodeException(ERR_NOT_CONFIGURED, "未配置检索引擎的密钥");
		}
		if (("custom".equals(engine) || "searxng".equals(engine)) && baseUrl.isEmpty()) {
			throw new ErrorCodeException(ERR_NOT_CONFIGURED, "未配置检索服务地址");
		}
		String responseText = dispatch(engine, query, apiKey, baseUrl, maxResults, freshness);
		Map<String, Object> payload = JsonUtility.toDictionary(responseText);
		List<Map<String, Object>> results = normalize(engine, payload, maxResults);
		Map<String, Object> out = new LinkedHashMap<String, Object>();
		out.put("engine", engine);
		out.put("query", query);
		out.put("results", results);
		out.put("fetchedAt", java.time.Instant.now().toString());
		return out;
	}

	private String dispatch(String engine, String query, String apiKey, String baseUrl, int maxResults, String freshness) {
		if ("tavily".equals(engine)) {
			Map<String, Object> body = new LinkedHashMap<String, Object>();
			body.put("api_key", apiKey);
			body.put("query", query);
			body.put("max_results", Integer.valueOf(maxResults));
			body.put("search_depth", "basic");
			if (!freshness.isEmpty()) {
				body.put("days", Integer.valueOf(freshnessDays(freshness)));
			}
			return post(url(baseUrl, "https://api.tavily.com") + "/search", JsonUtility.encode(body), null, null);
		}
		if ("brave".equals(engine)) {
			String u = url(baseUrl, "https://api.search.brave.com") + "/res/v1/web/search?q=" + enc(query) + "&count=" + maxResults;
			return get(u, "X-Subscription-Token", apiKey);
		}
		if ("exa".equals(engine)) {
			Map<String, Object> body = new LinkedHashMap<String, Object>();
			body.put("query", query);
			body.put("numResults", Integer.valueOf(maxResults));
			body.put("contents", singleton("text", Boolean.TRUE));
			return post(url(baseUrl, "https://api.exa.ai") + "/search", JsonUtility.encode(body), "x-api-key", apiKey);
		}
		if ("searxng".equals(engine)) {
			return get(url(baseUrl, "") + "/search?format=json&q=" + enc(query), null, null);
		}
		if ("custom".equals(engine)) {
			Map<String, Object> body = new LinkedHashMap<String, Object>();
			body.put("query", query);
			body.put("maxResults", Integer.valueOf(maxResults));
			return post(url(baseUrl, ""), JsonUtility.encode(body), apiKey.isEmpty() ? null : "Authorization", apiKey.isEmpty() ? null : ("Bearer " + apiKey));
		}
		throw new ErrorCodeException(ERR_NOT_CONFIGURED, "暂不支持该检索引擎");
	}

	/** 五家回体各不相同,一律归一成 {title,url,snippet,publishedAt};缺字段留空串,绝不编造。 */
	@SuppressWarnings("unchecked")
	public List<Map<String, Object>> normalize(String engine, Map<String, Object> payload, int maxResults) {
		List<Map<String, Object>> out = new ArrayList<Map<String, Object>>();
		if (payload == null) {
			return out;
		}
		List<Object> raw = null;
		if ("brave".equals(engine)) {
			Object web = payload.get("web");
			if (web instanceof Map) {
				Object arr = ((Map<String, Object>) web).get("results");
				if (arr instanceof List) {
					raw = (List<Object>) arr;
				}
			}
		} else {
			Object arr = payload.get("results");
			if (arr instanceof List) {
				raw = (List<Object>) arr;
			}
		}
		if (raw == null) {
			return out;
		}
		for (Object item : raw) {
			if (!(item instanceof Map)) {
				continue;
			}
			Map<String, Object> m = (Map<String, Object>) item;
			String title = firstOf(m, "title", "name");
			String link = firstOf(m, "url", "link", "href");
			String snippet = firstOf(m, "content", "description", "snippet", "text");
			String published = firstOf(m, "published_date", "publishedDate", "page_age", "publishedAt");
			if (link.isEmpty()) {
				continue;
			}
			Map<String, Object> one = new LinkedHashMap<String, Object>();
			one.put("title", stripHtml(title));
			one.put("url", link);
			one.put("snippet", clip(stripHtml(snippet), SNIPPET_MAX));
			one.put("publishedAt", published);
			out.add(one);
			if (out.size() >= maxResults) {
				break;
			}
		}
		return out;
	}

	/** 去标签 + 常见实体还原 + 压空白:检索摘要里的 HTML 会污染提示词、也可能夹带形似指令的文字。 */
	public static String stripHtml(String text) {
		if (text == null || text.isEmpty()) {
			return "";
		}
		String s = text.replaceAll("(?is)<script.*?</script>", " ").replaceAll("(?is)<style.*?</style>", " ").replaceAll("(?s)<[^>]+>", " ");
		s = s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'");
		return s.replaceAll("\\s+", " ").trim();
	}

	private static String clip(String s, int max) {
		return s.length() <= max ? s : s.substring(0, max);
	}

	/** 出站地址的唯一收口点:post/get 建请求前都过 {@link OutboundUrlGuard}(拒绝即抛,文案不含地址)。 */
	static String validateOutboundUrl(String url) {
		return OutboundUrlGuard.validate(url);
	}

	private String post(String url, String json, String headerName, String headerValue) {
		HttpRequest.Builder b = HttpRequest.newBuilder().uri(URI.create(validateOutboundUrl(url))).timeout(Duration.ofMillis(REQUEST_TIMEOUT_MS))
			.header("Content-Type", "application/json").header("Accept", "application/json")
			.POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8));
		if (headerName != null && headerValue != null) {
			b = b.header(headerName, headerValue);
		}
		return send(b.build());
	}

	private String get(String url, String headerName, String headerValue) {
		HttpRequest.Builder b = HttpRequest.newBuilder().uri(URI.create(validateOutboundUrl(url))).timeout(Duration.ofMillis(REQUEST_TIMEOUT_MS)).header("Accept", "application/json").GET();
		if (headerName != null && headerValue != null) {
			b = b.header(headerName, headerValue);
		}
		return send(b.build());
	}

	/**
	 * 单次外呼,不重试;非 2xx(含不跟随的 3xx)只回状态码——上游原文可能含 Key 回显或长 HTML;
	 * 回体有界读:超过 {@link #MAX_RESPONSE_BYTES} 立刻关流(上游收到 broken pipe)并报 ERR_UPSTREAM;
	 * 传输层异常的文案带根因类名(不含 Key);本服务不写日志。
	 */
	private String send(HttpRequest request) {
		try {
			HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
			int status = response.statusCode();
			try (InputStream in = response.body()) {
				if (status < 200 || status >= 300) {
					throw new ErrorCodeException(ERR_UPSTREAM, "检索服务返回 HTTP " + status);
				}
				ByteArrayOutputStream buf = new ByteArrayOutputStream();
				byte[] chunk = new byte[8192];
				long total = 0;
				int n;
				while ((n = in.read(chunk)) > 0) {
					total += n;
					if (total > MAX_RESPONSE_BYTES) {
						throw new ErrorCodeException(ERR_UPSTREAM, "检索服务回体超过上限(" + (MAX_RESPONSE_BYTES >> 20) + "MiB)");
					}
					buf.write(chunk, 0, n);
				}
				return buf.toString(StandardCharsets.UTF_8.name());
			}
		} catch (ErrorCodeException e) {
			throw e;
		} catch (Exception e) {
			// 本服务永不写日志(Key 与检索词绝不落日志);根因类名只进错误文案,排障看返回体即可
			throw new ErrorCodeException(ERR_UPSTREAM, "检索服务不可达(" + rootCauseName(e) + ")");
		}
	}

	/** 异常链上最深一层的简单类名(HttpConnectTimeoutException / ConnectException / SSLHandshakeException …);永不带消息正文(可能含 Key)。 */
	static String rootCauseName(Throwable e) {
		Throwable t = e;
		int guard = 0;
		while (t.getCause() != null && t.getCause() != t && guard++ < 8) {
			t = t.getCause();
		}
		String outer = e.getClass().getSimpleName();
		String inner = t.getClass().getSimpleName();
		return outer.equals(inner) ? outer : (outer + "/" + inner);
	}

	private static Map<String, Object> singleton(String k, Object v) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		m.put(k, v);
		return m;
	}

	private static String url(String baseUrl, String fallback) {
		String b = baseUrl == null ? "" : baseUrl.trim();
		if (b.isEmpty()) {
			b = fallback;
		}
		while (b.endsWith("/")) {
			b = b.substring(0, b.length() - 1);
		}
		return b;
	}

	private static int freshnessDays(String freshness) {
		String f = freshness.toLowerCase();
		if (f.startsWith("d")) {
			return 1;
		}
		if (f.startsWith("w")) {
			return 7;
		}
		if (f.startsWith("m")) {
			return 30;
		}
		if (f.startsWith("y")) {
			return 365;
		}
		try {
			return Math.max(1, Math.min(365, Integer.parseInt(f)));
		} catch (Exception e) {
			return 7;
		}
	}

	private static String firstOf(Map<String, Object> m, String... keys) {
		for (String k : keys) {
			Object v = m.get(k);
			if (v instanceof String && !((String) v).trim().isEmpty()) {
				return ((String) v).trim();
			}
		}
		return "";
	}

	private static String enc(String s) {
		try {
			return java.net.URLEncoder.encode(s, "UTF-8");
		} catch (Exception e) {
			return s;
		}
	}

	private static String str(Map<String, Object> params, String key) {
		Object v = params == null ? null : params.get(key);
		return v == null ? "" : String.valueOf(v);
	}

	private static int intVal(Map<String, Object> params, String key, int fallback) {
		Object v = params == null ? null : params.get(key);
		if (v instanceof Number) {
			return ((Number) v).intValue();
		}
		try {
			return Integer.parseInt(String.valueOf(v));
		} catch (Exception e) {
			return fallback;
		}
	}

	private static int clamp(int v, int lo, int hi) {
		return v < lo ? lo : (v > hi ? hi : v);
	}
}
