package boundless.utility;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 密钥脱敏单源:凡是会写出去的请求记录(交易日志、文档缓存落盘、错误日志里的请求数据 / 请求头 / 网址、
 * 回给页面的错误文字)都经这里脱敏,别处不再自己维护字段表或正则。
 *
 * <p>两层:
 * <ul>
 * <li><b>按字段名</b>({@link #isSensitiveName}):名字去掉非字母数字、转小写后,命中精确表或后缀表,整值换成 {@link #MASK}。
 *     大小写、{@code api_key} / {@code api-key} / {@code x-goog-api-key} 这类写法差异一律归一;嵌套对象、列表逐层走。</li>
 * <li><b>按文字形态</b>({@link #redactText}):任意字符串里的 {@code ?key=…} / {@code &token=…} 查询串、
 *     {@code Bearer …} / {@code Basic …}、{@code x-api-key: …} 请求头行、嵌在文字里的 JSON 片段
 *     {@code "apiKey":"…"}(含转义形 {@code \"apiKey\":\"…\"})、常见供应商密钥形态(sk-… / AIza…),
 *     以及调用方给的本次密钥原文(连同其网址编码形)。</li>
 * </ul>
 *
 * <p>写时复制:没有任何改动的子树原样返回同一对象,有改动才复制那一层 —— 不改调用方手里的活对象(请求上下文里的 Map 仍在用),
 * 也避免整份大记录无谓复制。
 *
 * <p>只用于「写出去的副本」:功能性存储(用户档案里的口令摘要、客户端签名键等)绝不能过这里,否则重启读回的是掩码。
 */
public final class SecretRedactor {
	private SecretRedactor() {}

	/** 掩码(字段整值与文字内联统一用这一个)。 */
	public static final String MASK = "***";

	/** 归一后精确命中即敏感。 */
	private static final Set<String> EXACT_NAMES = Collections.unmodifiableSet(new HashSet<String>(Arrays.asList(
		"key", "apikey", "token", "secret", "password", "passwd", "pwd", "pass", "auth", "bearer",
		"authorization", "cookie", "setcookie", "signature", "sigkey", "signkey", "appkey", "appsecret",
		"privatekey", "secretkey", "accesskey", "credential", "credentials",
		// 整块是请求头 / 加密原文的容器:里面的名字由调用方任意起,整值掩掉
		"extraheaders", "rsaparam"
	)));

	/** 归一后以这些结尾即敏感(accesstoken / refreshtoken / clientsecret / userpassword / xgoogapikey / proxyauthorization …)。 */
	private static final String[] SUFFIX_NAMES = {
		"apikey", "token", "secret", "password", "passwd", "authorization", "privatekey", "secretkey", "accesskey", "credential"
	};

	/** 文字里出现时视为「名=值」的密钥名(查询串 / 表单串 / 请求头行)。 */
	private static final String NAME_ALT = "(?:x-goog-api-key|x-api-key|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|"
		+ "proxy-authorization|authorization|token|secret|password|passwd|pwd|auth|key|signature|sig)";

	/** ?key=… / &token=… / 行首 apiKey=…:前面不能紧贴字母数字(pdTimeKey= 不算)。 */
	private static final Pattern QUERY = Pattern.compile("(?i)(?<![A-Za-z0-9_.-])(" + NAME_ALT + "=)[^&\\s#\"'<>]+");
	/** 请求头行 · 密钥头:x-api-key: … / x-goog-api-key: … / api-key: …(值是单个令牌,掩到空白 / 逗号 / 分号前)。 */
	private static final Pattern HEADER_KEY = Pattern.compile("(?i)(?<![A-Za-z0-9_-])((?:x-goog-api-key|x-api-key|api-key)\\s*:\\s*)(?!\\*\\*\\*)[^\\s,;\"'}]+");
	/**
	 * 请求头行 · 认证头:Authorization: … / Proxy-Authorization: … —— 认证类型(Token / Digest / 自定义 …)连同后面的令牌一起掩
	 * (只掩类型那个词会把密钥本体露在后面);已由 BEARER 掩成「Bearer ***」的保持原样。
	 */
	private static final Pattern HEADER_AUTH = Pattern.compile("(?i)(?<![A-Za-z0-9_-])((?:proxy-authorization|authorization)[ \\t]*:[ \\t]*)(?!(?:bearer|basic)[ \\t]+\\*\\*\\*)(?!\\*\\*\\*)(?:[A-Za-z][A-Za-z0-9_-]*[ \\t]+)?[^\\s,;\"'}]+");
	/** 请求头行 · Cookie / Set-Cookie:多个键值对,冒号后到行尾(遇引号 / 右花括号止)整段掩。 */
	private static final Pattern HEADER_COOKIE = Pattern.compile("(?i)(?<![A-Za-z0-9_-])((?:set-cookie|cookie)[ \\t]*:[ \\t]*)(?!\\*\\*\\*[ \\t]*(?:[\\r\\n\"'}]|$))[^\\r\\n\"'}]+");
	/**
	 * Bearer / Basic 后的令牌:令牌里至少有一个大写字母 / 数字 / 符号(真令牌都有);全小写字母的普通单词不算
	 * (「basic authentication required」不掩)。类型词本身不分大小写,令牌那段的判据区分大小写。
	 */
	private static final Pattern BEARER = Pattern.compile("\\b((?i:bearer|basic))(\\s+)(?=[A-Za-z0-9._~+/=-]*[A-Z0-9._~+/=-])[A-Za-z0-9._~+/=-]{6,}");
	private static final Pattern SHAPES = Pattern.compile("\\b(?:sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,})");
	/** 文字里嵌的 JSON 片段 "name" : "value"(名字再交给 isSensitiveName 判)。 */
	// 值那段用「占有量词 + 展开的转义循环」写:不随字符串长度递归(交替分组的重复在 Java 里逐字符递归,几千字就栈溢出)
	private static final Pattern JSON_PAIR = Pattern.compile("(\"([A-Za-z0-9_.-]{1,64})\"\\s*:\\s*\")([^\"\\\\]*+(?:\\\\.[^\"\\\\]*+)*+)(\")");
	/** 同上的转义形 \"name\" : \"value\"(JSON 串里再嵌 JSON)。 */
	private static final Pattern JSON_PAIR_ESCAPED = Pattern.compile("(\\\\\"([A-Za-z0-9_.-]{1,64})\\\\\"\\s*:\\s*\\\\\")((?:(?!\\\\\").)*)(\\\\\")");

	private static String normalize(String name) {
		if(name == null) {
			return "";
		}
		StringBuilder sb = new StringBuilder(name.length());
		for(int i = 0; i < name.length(); i++) {
			char c = name.charAt(i);
			if((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
				sb.append(c);
			}else if(c >= 'A' && c <= 'Z') {
				sb.append((char) (c + 32));
			}
		}
		return sb.toString();
	}

	/** 字段名 / 参数名 / 请求头名是否敏感(大小写、下划线、连字符不计)。 */
	public static boolean isSensitiveName(String name) {
		return isSensitiveName(name, null);
	}

	/** 同上,另加调用方追加的名字表(如配置项 remvedparams,同样按归一形比较)。 */
	public static boolean isSensitiveName(String name, String[] extraNames) {
		String n = normalize(name);
		if(n.isEmpty()) {
			return false;
		}
		if(EXACT_NAMES.contains(n)) {
			return true;
		}
		for(String s : SUFFIX_NAMES) {
			if(n.endsWith(s)) {
				return true;
			}
		}
		if(extraNames != null) {
			for(String e : extraNames) {
				String en = normalize(e);
				if(!en.isEmpty() && en.equals(n)) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * 文字脱敏:本次密钥原文(≥4 字,连同网址编码形)整串换掉,再按常见形态兜底。null 原样返回。
	 * 正则引擎万一栈溢出(超长的病态输入):整段换成掩码 —— 宁可多掩,也不让调用方(异常处理器 / 落盘 / 日志)跟着抛错。
	 */
	public static String redactText(String text, String... literalSecrets) {
		if(text == null || text.isEmpty()) {
			return text;
		}
		try {
			return redactTextUnsafe(text, literalSecrets);
		}catch(StackOverflowError e) {
			return MASK;
		}
	}

	private static String redactTextUnsafe(String text, String... literalSecrets) {
		String out = text;
		if(literalSecrets != null) {
			for(String sec : literalSecrets) {
				String k = sec == null ? "" : sec.trim();
				if(k.length() >= 4) {
					out = out.replace(k, MASK);
					String enc = urlEncode(k);
					if(!enc.equals(k)) {
						out = out.replace(enc, MASK);
					}
				}
			}
		}
		out = replaceJsonPairs(JSON_PAIR, out);
		out = replaceJsonPairs(JSON_PAIR_ESCAPED, out);
		// Bearer / Basic 先掩令牌本身:「authorization=Bearer x」这类名=值写法,QUERY 只吃到空格前的「Bearer」,令牌会漏在后面
		out = BEARER.matcher(out).replaceAll("$1$2" + Matcher.quoteReplacement(MASK));
		out = QUERY.matcher(out).replaceAll("$1" + Matcher.quoteReplacement(MASK));
		out = HEADER_KEY.matcher(out).replaceAll("$1" + Matcher.quoteReplacement(MASK));
		out = HEADER_AUTH.matcher(out).replaceAll("$1" + Matcher.quoteReplacement(MASK));
		out = HEADER_COOKIE.matcher(out).replaceAll("$1" + Matcher.quoteReplacement(MASK));
		out = SHAPES.matcher(out).replaceAll(Matcher.quoteReplacement(MASK));
		return out;
	}

	private static String replaceJsonPairs(Pattern p, String text) {
		if(text.indexOf('"') < 0) {
			return text;
		}
		Matcher m = p.matcher(text);
		StringBuffer sb = null;
		while(m.find()) {
			if(!isSensitiveName(m.group(2)) || m.group(3).isEmpty() || MASK.equals(m.group(3))) {
				continue;
			}
			if(sb == null) {
				sb = new StringBuffer(text.length());
			}
			m.appendReplacement(sb, Matcher.quoteReplacement(m.group(1) + MASK + m.group(4)));
		}
		if(sb == null) {
			return text;
		}
		m.appendTail(sb);
		return sb.toString();
	}

	/**
	 * 任意值深度脱敏(Map / Collection / 数组逐层;敏感名的值整体换掩码;字符串走 {@link #redactText})。
	 * 写时复制:无改动返回原对象。
	 */
	public static Object redactValue(Object value) {
		return redactValue(value, null);
	}

	public static Object redactValue(Object value, String[] extraNames) {
		if(value == null) {
			return null;
		}
		if(value instanceof CharSequence) {
			String s = value.toString();
			String r = redactText(s);
			return r.equals(s) ? value : r;
		}
		if(value instanceof Map<?, ?>) {
			return redactMapInternal((Map<?, ?>) value, extraNames, null);
		}
		if(value instanceof Collection<?>) {
			Collection<?> c = (Collection<?>) value;
			List<Object> copy = null;
			int i = 0;
			for(Object item : c) {
				Object r = redactValue(item, extraNames);
				if(copy == null && r != item) {
					copy = new ArrayList<Object>(c.size());
					int j = 0;
					for(Object prev : c) {
						if(j++ >= i) {
							break;
						}
						copy.add(prev);
					}
				}
				if(copy != null) {
					copy.add(r);
				}
				i++;
			}
			return copy == null ? value : copy;
		}
		if(value instanceof Object[]) {
			Object[] arr = (Object[]) value;
			Object[] copy = null;
			for(int i = 0; i < arr.length; i++) {
				Object r = redactValue(arr[i], extraNames);
				if(r != arr[i]) {
					if(copy == null) {
						copy = Arrays.copyOf(arr, arr.length, Object[].class);
					}
					copy[i] = r;
				}
			}
			return copy == null ? value : copy;
		}
		return value;
	}

	/** 一条记录(Map)深度脱敏;无改动返回原 Map。 */
	@SuppressWarnings("unchecked")
	public static Map<String, Object> redactRecord(Map<String, Object> record) {
		return record == null ? null : (Map<String, Object>) redactMapInternal(record, null, null);
	}

	/** 同上,另加追加名字表;protectedTopKeys 是顶层不按名字掩的结构字段(如文档缓存的主键字段),其值仍按文字形态脱敏。 */
	@SuppressWarnings("unchecked")
	public static Map<String, Object> redactRecord(Map<String, Object> record, String[] extraNames, String... protectedTopKeys) {
		return record == null ? null : (Map<String, Object>) redactMapInternal(record, extraNames, protectedTopKeys);
	}

	/** 请求头表脱敏(出站请求失败时写进错误文字 / 日志用)。 */
	public static Map<String, String> redactHeaders(Map<String, String> headers) {
		Map<String, String> copy = new LinkedHashMap<String, String>();
		if(headers == null) {
			return copy;
		}
		for(Map.Entry<String, String> e : headers.entrySet()) {
			copy.put(e.getKey(), isSensitiveName(e.getKey()) ? MASK : redactText(e.getValue()));
		}
		return copy;
	}

	private static Object redactMapInternal(Map<?, ?> map, String[] extraNames, String[] protectedTopKeys) {
		Map<String, Object> copy = null;
		int idx = 0;
		for(Map.Entry<?, ?> e : map.entrySet()) {
			String k = e.getKey() == null ? null : e.getKey().toString();
			Object v = e.getValue();
			Object r;
			if(v != null && k != null && !isProtected(k, protectedTopKeys) && isSensitiveName(k, extraNames)) {
				r = MASK.equals(v) ? v : MASK;
			}else {
				r = redactValue(v, extraNames);
			}
			if(copy == null && r != v) {
				copy = new LinkedHashMap<String, Object>();
				int j = 0;
				for(Map.Entry<?, ?> prev : map.entrySet()) {
					if(j++ >= idx) {
						break;
					}
					copy.put(prev.getKey() == null ? null : prev.getKey().toString(), prev.getValue());
				}
			}
			if(copy != null) {
				copy.put(k, r);
			}
			idx++;
		}
		return copy == null ? map : copy;
	}

	private static boolean isProtected(String key, String[] protectedTopKeys) {
		if(protectedTopKeys == null) {
			return false;
		}
		for(String p : protectedTopKeys) {
			if(p != null && p.equals(key)) {
				return true;
			}
		}
		return false;
	}

	private static String urlEncode(String s) {
		try {
			return URLEncoder.encode(s, "UTF-8");
		}catch(UnsupportedEncodingException e) {
			return s;
		}
	}
}
