package boundless.spring.help;

import java.util.Collection;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * 交易日志的纯规则(无静态依赖,可单测)。参数 / 请求头脱敏不在这里:统一走 {@code boundless.utility.SecretRedactor}(单源)。
 * <ul>
 * <li>交易码匹配不分大小写:{@code SpringWebConfig} 的 AntPathMatcher 关了大小写敏感,{@code /AIAnalysis/Chat} 也能命中处理器,
 *     排除表 / 白名单若按原样精确匹配,大小写变体就能绕过排除(密钥、对话正文进交易日志)。表载入时统一小写,查询时同样小写。</li>
 * </ul>
 */
public final class TransLogRules {
	private TransLogRules() {}

	/** 交易码集合统一为去空白的小写形;null 元素丢弃。 */
	public static Set<String> normalizeTransCodes(Collection<String> codes) {
		Set<String> out = new HashSet<String>();
		if(codes == null) {
			return out;
		}
		for(String c : codes) {
			if(c != null) {
				out.add(c.trim().toLowerCase(Locale.ROOT));
			}
		}
		return out;
	}

	/** path 是否在(已 normalize 的)集合里,不分大小写、忽略首尾空白。 */
	public static boolean transCodeIn(Set<String> normalized, String path) {
		if(normalized == null || path == null) {
			return false;
		}
		return normalized.contains(path.trim().toLowerCase(Locale.ROOT));
	}
}
