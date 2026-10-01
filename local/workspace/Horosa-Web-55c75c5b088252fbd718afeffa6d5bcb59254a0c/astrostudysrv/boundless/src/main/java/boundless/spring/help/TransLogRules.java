package boundless.spring.help;

import java.util.Collection;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 交易日志的两条纯规则(无静态依赖,可单测):
 * <ul>
 * <li>交易码匹配不分大小写:{@code SpringWebConfig} 的 AntPathMatcher 关了大小写敏感,{@code /AIAnalysis/Chat} 也能命中处理器,
 *     排除表 / 白名单若按原样精确匹配,大小写变体就能绕过排除(密钥、对话正文进交易日志)。表载入时统一小写,查询时同样小写。</li>
 * <li>按名删参不分大小写:此前只删 原样 / 全大写 / 全小写 三形,{@code Token} 这类首字母大写要逐一登记才删得掉。</li>
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

	/** 删掉 map 里与 names 任一名不分大小写相等的键(原地;map / names 为空即不动)。 */
	public static int removeParamsIgnoreCase(Map<String, ?> map, String[] names) {
		if(map == null || names == null || names.length == 0) {
			return 0;
		}
		int removed = 0;
		Iterator<String> it = map.keySet().iterator();
		while(it.hasNext()) {
			String k = it.next();
			if(k == null) {
				continue;
			}
			for(String p : names) {
				if(p != null && p.equalsIgnoreCase(k)) {
					it.remove();
					removed++;
					break;
				}
			}
		}
		return removed;
	}
}
