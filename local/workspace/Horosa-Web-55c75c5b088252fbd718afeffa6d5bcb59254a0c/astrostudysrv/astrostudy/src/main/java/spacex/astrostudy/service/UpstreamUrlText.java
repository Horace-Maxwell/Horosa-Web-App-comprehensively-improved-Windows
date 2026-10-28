package spacex.astrostudy.service;

import java.util.regex.Pattern;

/**
 * 外呼地址的文字清理与报错定位(单源):AI 接口地址(Base URL)与联网检索的自定义服务地址共用。
 *
 * <p>从中文文档复制来的地址常带看不见的字符 —— 任意位置的零宽 / 方向控制字符、首尾的 Unicode 空白(全角空格 U+3000、
 * 不换行空格等)。{@code String.trim()} 只去 ASCII 空白,这些字符留下来会让 URI 解析抛错、只报「地址不合法」。
 * {@link #clean} 先清掉它们;仍不合法时 {@link #firstIllegalChar} / {@link #describeChar} 给出第几个字符、是什么字符
 * (只描述那一个字符,不回显地址本身 —— 地址可能带凭据或内网拓扑)。
 */
public final class UpstreamUrlText {

	private static final Pattern INVISIBLE_URL_CHARS = Pattern.compile("[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u2069\\uFEFF\\u180E\\u00AD]");
	private static final Pattern EDGE_UNICODE_SPACE = Pattern.compile("^[\\s\\p{Z}\\p{Cc}]+|[\\s\\p{Z}\\p{Cc}]+$");

	private UpstreamUrlText() {
	}

	/** 去掉任意位置的零宽 / 方向控制字符与首尾 Unicode 空白;null → 空串。 */
	public static String clean(String raw) {
		if (raw == null) {
			return "";
		}
		String s = INVISIBLE_URL_CHARS.matcher(raw).replaceAll("");
		return EDGE_UNICODE_SPACE.matcher(s).replaceAll("");
	}

	/** 第一个确实不许出现在网址里的字符(空白 / 控制 / 非 ASCII / 引号尖括号等)的下标;没有回 -1。 */
	public static int firstIllegalChar(String u) {
		if (u == null) {
			return -1;
		}
		for (int i = 0; i < u.length(); ) {
			int cp = u.codePointAt(i);
			if (cp <= 0x20 || cp >= 0x7F || "\"<>\\^`{|}".indexOf(cp) >= 0) {
				return i;
			}
			i += Character.charCount(cp);
		}
		return -1;
	}

	/** 描述下标处的那一个字符(空白 / 控制字符给码位,其余给字符本身);越界 = 「末尾」。 */
	public static String describeChar(String u, int at) {
		if (u == null || at < 0 || at >= u.length()) {
			return "末尾";
		}
		int cp = u.codePointAt(at);
		if (Character.isWhitespace(cp) || Character.isSpaceChar(cp)) {
			return String.format("空白字符 U+%04X", cp);
		}
		if (cp < 0x20 || cp == 0x7F) {
			return String.format("控制字符 U+%04X", cp);
		}
		return String.format("「%s」", new String(Character.toChars(cp)));
	}
}
