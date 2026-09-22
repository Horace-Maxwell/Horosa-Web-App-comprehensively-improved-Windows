package spacex.astrostudy.service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import boundless.exception.ErrorCodeException;

/**
 * AI 助手·网页读取(web_fetch;出站③,默认关)。
 *
 * <p>形态与联网检索同一套纪律:独立 HttpClient(不跟随重定向,逐跳过 {@link OutboundUrlGuard#validateStrict} 严格档,≤ {@link #MAX_HOPS} 跳);
 * 回体有界读 {@link #MAX_RESPONSE_BYTES};只收 text/html · text/plain · application/json · application/xml(含 +xml);
 * HTML 转成纯文本(剥 script/style/noscript、块级换行、实体还原);按 {@code maxChars}(≤ {@link #MAX_CHARS})在段落边界截断。
 * <b>本服务永不写日志</b>(地址与正文不落日志);错误文案只含状态码/根因类名,不回显上游原文。
 */
@Service
public class AIWebFetchService {

	public static final int ERR_FETCH_BLOCKED = 580044;
	public static final int ERR_FETCH_UPSTREAM = 580045;
	public static final int ERR_FETCH_EMPTY = 580046;

	public static final int MAX_CHARS = 20000;
	public static final int DEFAULT_CHARS = 8000;
	public static final int MIN_CHARS = 200;
	public static final int MAX_HOPS = 3;
	public static final long MAX_RESPONSE_BYTES = 2L * 1024 * 1024;
	private static final int CONNECT_TIMEOUT_MS = 10000;
	private static final int REQUEST_TIMEOUT_MS = 20000;
	private static final int TITLE_MAX = 200;

	private final HttpClient client;

	public AIWebFetchService() {
		this(HttpClient.newBuilder()
			.connectTimeout(Duration.ofMillis(CONNECT_TIMEOUT_MS))
			.followRedirects(HttpClient.Redirect.NEVER)
			.build());
	}

	/** [测试缝] 仅供单测注入可控 HttpClient;Spring 走无参构造器。 */
	AIWebFetchService(HttpClient injected) {
		this.client = injected;
	}

	public Map<String, Object> fetch(Map<String, Object> params) {
		String url = str(params, "url").trim();
		int maxChars = clamp(intVal(params, "maxChars", DEFAULT_CHARS), MIN_CHARS, MAX_CHARS);
		if (url.isEmpty()) {
			throw new ErrorCodeException(ERR_FETCH_EMPTY, "网页地址为空");
		}
		Fetched f = fetchFollowing(url, OutboundUrlGuard.allowLoopbackFromEnv());
		String text;
		String title = "";
		String kind = f.contentType;
		if (kind.startsWith("text/html") || kind.startsWith("application/xhtml")) {
			title = extractTitle(f.body);
			text = htmlToText(f.body);
			kind = "text/html";
		} else {
			text = f.body.replace("\r\n", "\n").trim();
		}
		Truncated t = truncateAtParagraph(text, maxChars);
		Map<String, Object> out = new LinkedHashMap<String, Object>();
		out.put("url", f.finalUrl);
		out.put("status", Integer.valueOf(f.status));
		out.put("contentType", kind);
		out.put("title", title);
		out.put("text", t.text);
		out.put("truncated", Boolean.valueOf(t.truncated));
		out.put("totalChars", Integer.valueOf(text.length()));
		out.put("hops", Integer.valueOf(f.hops));
		out.put("fetchedAt", java.time.Instant.now().toString());
		return out;
	}

	static final class Fetched {
		final String finalUrl;
		final int status;
		final String contentType;
		final String body;
		final int hops;

		Fetched(String finalUrl, int status, String contentType, String body, int hops) {
			this.finalUrl = finalUrl;
			this.status = status;
			this.contentType = contentType;
			this.body = body;
			this.hops = hops;
		}
	}

	/** 逐跳:每一跳的目标都过严格档;3xx 带 Location 才跟(相对地址按当前跳解析);超过 MAX_HOPS 即报。 */
	Fetched fetchFollowing(String startUrl, boolean allowLoopback) {
		String current = OutboundUrlGuard.validateStrict(startUrl, allowLoopback);
		for (int hop = 0; hop <= MAX_HOPS; hop++) {
			URI target;
			try {
				target = URI.create(current);
			} catch (RuntimeException e) {
				throw new ErrorCodeException(ERR_FETCH_BLOCKED, "网页地址不允许:地址不合法");
			}
			HttpRequest request = HttpRequest.newBuilder().uri(target).timeout(Duration.ofMillis(REQUEST_TIMEOUT_MS))
				.header("Accept", "text/html, text/plain;q=0.9, application/json;q=0.8, application/xml;q=0.7, */*;q=0.1")
				.header("User-Agent", "Horosa-WebFetch/1 (+local desktop assistant)")
				.GET().build();
			HttpResponse<InputStream> response;
			try {
				response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
			} catch (Exception e) {
				throw new ErrorCodeException(ERR_FETCH_UPSTREAM, "网页不可达(" + AIWebSearchService.rootCauseName(e) + ")");
			}
			int status = response.statusCode();
			try (InputStream in = response.body()) {
				if (status >= 300 && status < 400) {
					String loc = response.headers().firstValue("Location").orElse("").trim();
					if (loc.isEmpty()) {
						throw new ErrorCodeException(ERR_FETCH_UPSTREAM, "网页返回 HTTP " + status);
					}
					if (hop >= MAX_HOPS) {
						throw new ErrorCodeException(ERR_FETCH_UPSTREAM, "网页重定向超过 " + MAX_HOPS + " 跳");
					}
					String next;
					try {
						next = URI.create(current).resolve(loc).toString();
					} catch (Exception e) {
						throw new ErrorCodeException(ERR_FETCH_UPSTREAM, "网页重定向地址不合法");
					}
					current = OutboundUrlGuard.validateStrict(next, allowLoopback);
					continue;
				}
				if (status < 200 || status >= 300) {
					throw new ErrorCodeException(ERR_FETCH_UPSTREAM, "网页返回 HTTP " + status);
				}
				String ct = response.headers().firstValue("Content-Type").orElse("").trim().toLowerCase(Locale.ROOT);
				String mime = ct.split(";")[0].trim();
				if (!isSupportedMime(mime)) {
					throw new ErrorCodeException(ERR_FETCH_UPSTREAM, "不支持的内容类型(" + (mime.isEmpty() ? "未知" : mime.replaceAll("[^a-z0-9/+.-]", "")) + ")");
				}
				byte[] bytes = readBounded(in);
				Charset cs = charsetOf(ct, mime, bytes);
				return new Fetched(current, status, mime, new String(bytes, cs), hop);
			} catch (ErrorCodeException e) {
				throw e;
			} catch (Exception e) {
				throw new ErrorCodeException(ERR_FETCH_UPSTREAM, "网页读取失败(" + AIWebSearchService.rootCauseName(e) + ")");
			}
		}
		throw new ErrorCodeException(ERR_FETCH_UPSTREAM, "网页重定向超过 " + MAX_HOPS + " 跳");
	}

	static boolean isSupportedMime(String mime) {
		if (mime == null || mime.isEmpty()) {
			return true;   // 无 Content-Type 的纯文本服务器:按文本处理(再由内容截断兜底)
		}
		return mime.startsWith("text/html") || mime.startsWith("application/xhtml") || mime.startsWith("text/plain") || mime.startsWith("application/json")
			|| mime.startsWith("application/xml") || mime.startsWith("text/xml") || mime.endsWith("+xml") || mime.endsWith("+json") || mime.startsWith("text/markdown");
	}

	private static byte[] readBounded(InputStream in) throws java.io.IOException {
		ByteArrayOutputStream buf = new ByteArrayOutputStream();
		byte[] chunk = new byte[8192];
		long total = 0;
		int n;
		while ((n = in.read(chunk)) > 0) {
			total += n;
			if (total > MAX_RESPONSE_BYTES) {
				throw new ErrorCodeException(ERR_FETCH_UPSTREAM, "网页回体超过上限(" + (MAX_RESPONSE_BYTES >> 20) + "MiB)");
			}
			buf.write(chunk, 0, n);
		}
		return buf.toByteArray();
	}

	static Charset charsetOf(String contentType, String mime, byte[] bytes) {
		Matcher m = Pattern.compile("charset=\"?([A-Za-z0-9_.:-]+)").matcher(contentType == null ? "" : contentType);
		if (m.find()) {
			try {
				return Charset.forName(m.group(1));
			} catch (Exception ignored) {
				// 未知字符集回落 UTF-8
			}
		}
		if (mime != null && mime.startsWith("text/html")) {
			String head = new String(bytes, 0, Math.min(bytes.length, 4096), StandardCharsets.ISO_8859_1).toLowerCase(Locale.ROOT);
			Matcher mm = Pattern.compile("charset=\"?'?([a-z0-9_.:-]+)").matcher(head);
			if (mm.find()) {
				try {
					return Charset.forName(mm.group(1));
				} catch (Exception ignored) {
					// 同上
				}
			}
		}
		return StandardCharsets.UTF_8;
	}

	static String extractTitle(String html) {
		if (html == null) {
			return "";
		}
		Matcher m = Pattern.compile("(?is)<title[^>]*>(.*?)</title>").matcher(html);
		if (!m.find()) {
			return "";
		}
		String t = AIWebSearchService.stripHtml(m.group(1));
		return t.length() > TITLE_MAX ? t.substring(0, TITLE_MAX) : t;
	}

	/** HTML → 纯文本:剥 script/style/noscript/template、块级标签换行、其余标签去掉、实体还原、空白归一但保留段落。 */
	public static String htmlToText(String html) {
		if (html == null || html.isEmpty()) {
			return "";
		}
		String s = html.replaceAll("(?is)<(script|style|noscript|template|svg|head)[^>]*>.*?</\\1>", " ");
		s = s.replaceAll("(?is)<!--.*?-->", " ");
		s = s.replaceAll("(?i)<br\\s*/?>", "\n");
		s = s.replaceAll("(?i)</?(p|div|section|article|header|footer|nav|aside|main|li|ul|ol|table|thead|tbody|tr|td|th|h[1-6]|blockquote|pre|dd|dt|dl|figure|figcaption|form|fieldset|hr)[^>]*>", "\n");
		s = s.replaceAll("(?s)<[^>]+>", " ");
		s = s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'").replace("&apos;", "'");
		s = s.replaceAll("&#(\\d+);", " ").replaceAll("&[a-zA-Z]+;", " ");
		s = s.replace("\r", "");
		StringBuilder out = new StringBuilder();
		for (String line : s.split("\n")) {
			String l = line.replaceAll("[ \\t\\x0B\\f\\u00A0]+", " ").trim();
			if (l.isEmpty()) {
				if (out.length() > 0 && out.charAt(out.length() - 1) != '\n') {
					out.append('\n');
				}
				continue;
			}
			out.append(l).append('\n');
		}
		return out.toString().replaceAll("\n{3,}", "\n\n").trim();
	}

	static final class Truncated {
		final String text;
		final boolean truncated;

		Truncated(String text, boolean truncated) {
			this.text = text;
			this.truncated = truncated;
		}
	}

	/** 段落对齐截断:超长时在 maxChars 之前最后一个换行处切(若换行位置 ≥ 60% 处),否则硬切。 */
	static Truncated truncateAtParagraph(String text, int maxChars) {
		String s = text == null ? "" : text;
		if (s.length() <= maxChars) {
			return new Truncated(s, false);
		}
		int cut = s.lastIndexOf('\n', maxChars);
		if (cut < maxChars * 6 / 10) {
			cut = maxChars;
		}
		return new Truncated(s.substring(0, cut).trim(), true);
	}

	private static String str(Map<String, Object> params, String key) {
		Object v = params == null ? null : params.get(key);
		return v == null ? "" : String.valueOf(v);
	}

	private static int intVal(Map<String, Object> params, String key, int fallback) {
		Object v = params == null ? null : params.get(key);
		if (v == null) {
			return fallback;
		}
		try {
			return (int) Math.round(Double.parseDouble(String.valueOf(v)));
		} catch (Exception e) {
			return fallback;
		}
	}

	private static int clamp(int v, int lo, int hi) {
		return Math.max(lo, Math.min(hi, v));
	}
}
