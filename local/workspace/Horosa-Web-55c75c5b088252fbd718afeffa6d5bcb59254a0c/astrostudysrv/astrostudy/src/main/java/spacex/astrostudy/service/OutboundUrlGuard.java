package spacex.astrostudy.service;

import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

import boundless.exception.ErrorCodeException;

/**
 * AI 助手·出站地址守卫(联网检索 / 后续任何本机代理外呼的**唯一**收口点)。
 *
 * <p>规则(基础档纯字符串判定;严格档 validateStrict 在字面判定之后**再按解析结果判**,见 D21):
 * <ul>
 *   <li>scheme 只放行 http / https(file / ftp / javascript / data 一律拒);</li>
 *   <li>不得带 userinfo(<code>user:pw@host</code> 形态是把凭据写进地址);</li>
 *   <li>云元数据地址(169.254.0.0/16、metadata.google.internal、100.100.100.200、fd00:ec2::254)、
 *       通配/未指定地址(0.0.0.0、::、0.x.x.x)、整数形式的 IPv4(2130706433 这类伪装)一律拒;</li>
 *   <li>回环地址只拒本应用自身服务端口(9999 Java / 8899 计算服务)——本机 searxng、内网自建引擎是明面用法,不得连坐;</li>
 *   <li>总长 ≤ {@link #URL_MAX}。</li>
 * </ul>
 * 错误文案只说原因、永不回显地址(内网拓扑不进日志)。
 */
public final class OutboundUrlGuard {

	public static final int URL_MAX = 4096;
	private static final java.util.regex.Pattern DOTTED_QUAD = java.util.regex.Pattern.compile("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$");

	private static final Set<String> BLOCKED_HOSTS = new HashSet<String>(Arrays.asList(
		"metadata.google.internal", "metadata", "169.254.169.254", "100.100.100.200", "fd00:ec2::254",
		"0.0.0.0", "::", "0:0:0:0:0:0:0:0"));

	/** 本应用自身服务端口:回环打自己的 API 就是 SSRF。 */
	private static final Set<Integer> OWN_PORTS = new HashSet<Integer>(Arrays.asList(Integer.valueOf(9999), Integer.valueOf(8899)));

	private OutboundUrlGuard() {
	}

	/** 通过则原样返回地址;不通过抛 {@link ErrorCodeException}(码 {@link AIWebSearchService#ERR_NOT_CONFIGURED}),文案不含地址。 */
	public static String validate(String url) {
		if (url == null || url.trim().isEmpty()) {
			throw reject("地址为空");
		}
		if (url.length() > URL_MAX) {
			throw reject("地址过长");
		}
		URI u;
		try {
			u = new URI(url.trim());
		} catch (URISyntaxException e) {
			throw reject("地址不合法");
		}
		String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
		if (!"http".equals(scheme) && !"https".equals(scheme)) {
			throw reject("只允许 http/https");
		}
		if (u.getRawUserInfo() != null) {
			throw reject("地址不得带用户信息");
		}
		String host = u.getHost();
		if (host == null || host.trim().isEmpty()) {
			throw reject("地址缺主机名");
		}
		String h = host.trim().toLowerCase(Locale.ROOT);
		if (h.startsWith("[") && h.endsWith("]")) {
			h = h.substring(1, h.length() - 1);
		}
		// [AR-34] FQDN 尾点(`localhost.`)与不带尾点是同一主机,字面判定前归一(此前 `localhost.` 不算回环字面量,带自身端口照放)
		while (h.length() > 1 && h.endsWith(".")) {
			h = h.substring(0, h.length() - 1);
		}
		if (BLOCKED_HOSTS.contains(h) || (isDottedQuad(h) && (h.startsWith("169.254.") || h.startsWith("0.")))) {
			throw reject("不允许访问该主机");
		}
		if (h.matches("\\d+") || h.matches("0x[0-9a-f]+")) {
			throw reject("不允许整数形式的地址");
		}
		int port = u.getPort();
		boolean loopback = isLoopbackLiteral(h);
		if (loopback && port > 0 && OWN_PORTS.contains(Integer.valueOf(port))) {
			throw reject("不允许回环访问本应用自身端口");
		}
		// [AR-34·2026-09-17] 回环别名绕过:`localhost.`(带尾点)/ `[::ffff:127.0.0.1]`(IPv4 映射 IPv6)不是回环字面量,此前带自身端口照样放行。
		// 基础档只在「端口 = 自身端口」时多做一次解析(名字→地址;IP 字面量不发 DNS),任一结果为回环即拒;解析失败不拒(基础档不苛求可达)。
		if (!loopback && port > 0 && OWN_PORTS.contains(Integer.valueOf(port)) && resolvesToLoopback(h)) {
			throw reject("不允许回环访问本应用自身端口");
		}
		// 回 trim 后的串:此前回原串,首尾空格的地址过守卫后到 HttpRequest 的 URI.create 抛裸 IllegalArgumentException
		return url.trim();
	}

	/** 主机名解析后任一地址为回环(127/8、::1、IPv4 映射回环)即真;解析失败 / 无结果 → 假(基础档只拦「解析得到的回环」)。 */
	static boolean resolvesToLoopback(String h) {
		InetAddress[] addrs;
		try {
			addrs = resolver.resolve(h);
		} catch (Exception e) {
			return false;
		}
		if (addrs == null) {
			return false;
		}
		for (InetAddress a : addrs) {
			if (a != null && a.isLoopbackAddress()) {
				return true;
			}
		}
		return false;
	}

	private static ErrorCodeException reject(String reason) {
		return new ErrorCodeException(AIWebSearchService.ERR_NOT_CONFIGURED, "检索服务地址不允许:" + reason);
	}

	// ── [批三①] 严格档:网页读取(web_fetch)用。检索是「本机/内网自建引擎是明面用法」,读整页不是——
	//    任意地址读回体等于把内网页面交给模型,所以严格档再拒:回环(任意端口)/ RFC1918 / 链路本地 / IPv6 ULA / .local .internal .localhost 后缀。
	//    仅当环境变量 HOROSA_WEBFETCH_ALLOW_LOOPBACK=1(测试假页面 / 用户自建内网页面)才放开这一层;基础规则(元数据/整数地址/userinfo…)永不放开。

	/** 严格档是否放行本机/内网(环境变量 HOROSA_WEBFETCH_ALLOW_LOOPBACK=1;缺省关)。 */
	public static boolean allowLoopbackFromEnv() {
		String v = System.getenv("HOROSA_WEBFETCH_ALLOW_LOOPBACK");
		return v != null && "1".equals(v.trim());
	}

	public static String validateStrict(String url) {
		return validateStrict(url, allowLoopbackFromEnv());
	}

	/** 通过则原样返回;不通过抛 {@link ErrorCodeException}(码 {@link AIWebFetchService#ERR_FETCH_BLOCKED}),文案不含地址。 */
	public static String validateStrict(String url, boolean allowLoopback) {
		String ok;
		try {
			ok = validate(url);
		} catch (ErrorCodeException e) {
			throw new ErrorCodeException(AIWebFetchService.ERR_FETCH_BLOCKED, "网页地址不允许:" + stripPrefix(e.getMessage()));
		}
		URI u0;
		try {
			u0 = new URI(ok.trim());
		} catch (URISyntaxException e) {
			throw new ErrorCodeException(AIWebFetchService.ERR_FETCH_BLOCKED, "网页地址不允许:地址不合法");
		}
		String h0 = u0.getHost() == null ? "" : u0.getHost().trim().toLowerCase(Locale.ROOT);
		if (h0.startsWith("[") && h0.endsWith("]")) {
			h0 = h0.substring(1, h0.length() - 1);
		}
		// 放行回环只对**回环字面量**(测试假页面 / 自建本机页面);此前 allowLoopback 整体 return,连解析层都跳过 ——
		// 带此变量起的后端从未执行过解析判定,公网域名解析到内网也放行
		if (allowLoopback && isLoopbackLiteral(h0)) {
			return ok;
		}
		URI u;
		try {
			u = new URI(ok.trim());
		} catch (URISyntaxException e) {
			throw new ErrorCodeException(AIWebFetchService.ERR_FETCH_BLOCKED, "网页地址不允许:地址不合法");
		}
		String h = u.getHost() == null ? "" : u.getHost().trim().toLowerCase(Locale.ROOT);
		if (h.startsWith("[") && h.endsWith("]")) {
			h = h.substring(1, h.length() - 1);
		}
		if (isPrivateOrLocalHost(h)) {
			throw new ErrorCodeException(AIWebFetchService.ERR_FETCH_BLOCKED, "网页地址不允许:不允许读取本机或内网地址");
		}
		// [进阶复查 D21·2026-09-08] 字面判定之后再按**解析结果**判:公网域名解析到内网/回环 A 记录(DNS 重绑定、内网名字对外解析、
		// IPv4 映射 IPv6 字面量 ::ffff:127.0.0.1)此前可穿透纯字符串判定。每一跳都走这里(调用方逐跳 validateStrict)。
		checkResolvedAddresses(h);
		return ok;
	}

	/** 解析器可注入(测试用桩;缺省 InetAddress.getAllByName)。 */
	public interface Resolver {
		InetAddress[] resolve(String host) throws UnknownHostException;
	}

	private static final Resolver DEFAULT_RESOLVER = new Resolver() {
		@Override
		public InetAddress[] resolve(String host) throws UnknownHostException {
			return InetAddress.getAllByName(host);
		}
	};
	private static volatile Resolver resolver = DEFAULT_RESOLVER;

	static void setResolverForTests(Resolver r) {
		resolver = r == null ? DEFAULT_RESOLVER : r;
	}

	/** 解析主机名(IP 字面量不发 DNS);任一结果为本机/内网/保留段即拒;解析失败或无结果也拒(读不到也不该读)。 */
	static void checkResolvedAddresses(String h) {
		InetAddress[] addrs;
		try {
			addrs = resolver.resolve(h);
		} catch (Exception e) {
			throw new ErrorCodeException(AIWebFetchService.ERR_FETCH_BLOCKED, "网页地址不允许:主机名解析失败");
		}
		if (addrs == null || addrs.length == 0) {
			throw new ErrorCodeException(AIWebFetchService.ERR_FETCH_BLOCKED, "网页地址不允许:主机名无解析结果");
		}
		for (InetAddress a : addrs) {
			if (isPrivateOrLocalAddress(a)) {
				throw new ErrorCodeException(AIWebFetchService.ERR_FETCH_BLOCKED, "网页地址不允许:解析到本机或内网地址");
			}
		}
	}

	/** 回环 / 任意 / 链路本地 / 站点本地(RFC1918)/ 多播 / 0.0.0.0/8 / CGNAT 100.64.0.0/10 / 192.0.0.0/24 / 198.18.0.0/15 / 240.0.0.0/4 / IPv6 ULA fc00::/7。 */
	static boolean isPrivateOrLocalAddress(InetAddress a) {
		// [D36] NAT64 64:ff9b::/96、6to4 中继 192.88.99.0/24、IPv6 文档段 2001:db8::/32:字面判定与解析判定都算内网/非公网
		try {
			String hs = a == null ? "" : a.getHostAddress().toLowerCase(Locale.ROOT);
			if (hs.startsWith("64:ff9b:") || hs.startsWith("2001:db8:") || hs.startsWith("192.88.99.")) {
				return true;
			}
		} catch (RuntimeException ignored) {
			// 继续走既有判定
		}
		if (a == null) {
			return true;
		}
		if (a.isLoopbackAddress() || a.isAnyLocalAddress() || a.isLinkLocalAddress() || a.isSiteLocalAddress() || a.isMulticastAddress()) {
			return true;
		}
		byte[] b = a.getAddress();
		if (b != null && b.length == 4) {
			int b0 = b[0] & 0xff;
			int b1 = b[1] & 0xff;
			int b2 = b[2] & 0xff;
			if (b0 == 0 || b0 >= 240) {
				return true;
			}
			if (b0 == 100 && b1 >= 64 && b1 <= 127) {
				return true;
			}
			if (b0 == 192 && b1 == 0 && b2 == 0) {
				return true;
			}
			if (b0 == 198 && (b1 == 18 || b1 == 19)) {
				return true;
			}
			return false;
		}
		if (b != null && b.length == 16) {
			int b0 = b[0] & 0xff;
			return (b0 & 0xfe) == 0xfc;
		}
		return false;
	}

	/** 回环 / RFC1918 / 链路本地 / IPv6 ULA / 本地后缀:全部纯字符串判定,不做 DNS。 */
	static boolean isPrivateOrLocalHost(String h) {
		if (h == null || h.isEmpty()) {
			return true;
		}
		if ("localhost".equals(h) || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".home.arpa")) {
			return true;
		}
		// IPv6 字面量才看前缀(fc00::/7 ULA、fe80::/10 链路本地);域名以 fc/fd 开头(fcc.gov、fdroid.org)不得误伤
		if ("::1".equals(h) || "0:0:0:0:0:0:0:1".equals(h) || (h.indexOf(':') >= 0 && (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")))) {
			return true;
		}
		if (isDottedQuad(h) && (h.startsWith("127.") || h.startsWith("10.") || h.startsWith("192.168.") || h.startsWith("169.254.") || h.startsWith("100.64.") || h.startsWith("100.65.") || h.startsWith("100.66.") || h.startsWith("100.67.") || h.startsWith("100.68.") || h.startsWith("100.69.") || h.startsWith("100.7") || h.startsWith("100.8") || h.startsWith("100.9") || h.startsWith("100.10") || h.startsWith("100.11") || h.startsWith("100.12"))) {
			return true;
		}
		if (isDottedQuad(h) && h.startsWith("172.")) {
			String[] parts = h.split("\\.");
			if (parts.length >= 2) {
				try {
					int second = Integer.parseInt(parts[1]);
					if (second >= 16 && second <= 31) {
						return true;
					}
				} catch (NumberFormatException ignored) {
					return true;
				}
			}
		}
		return false;
	}

	/** 点分十进制 IPv4 字面量(四段纯数字)。此前用 startsWith("10.")/"127."/"172." 判**任意主机名**,10.gov / 172.today 这类公网名字被当内网拒。 */
	static boolean isDottedQuad(String h) {
		return h != null && DOTTED_QUAD.matcher(h).matches();
	}

	/** 回环字面量:localhost / 127.x.x.x / ::1(严格档 HOROSA_WEBFETCH_ALLOW_LOOPBACK=1 只放这些,其余主机仍做解析判定)。 */
	static boolean isLoopbackLiteral(String h) {
		return "localhost".equals(h) || "::1".equals(h) || "0:0:0:0:0:0:0:1".equals(h) || (isDottedQuad(h) && h.startsWith("127."));
	}

	private static String stripPrefix(String msg) {
		String s = msg == null ? "" : msg;
		int i = s.indexOf(':');
		return i >= 0 && i < s.length() - 1 ? s.substring(i + 1) : s;
	}
}
