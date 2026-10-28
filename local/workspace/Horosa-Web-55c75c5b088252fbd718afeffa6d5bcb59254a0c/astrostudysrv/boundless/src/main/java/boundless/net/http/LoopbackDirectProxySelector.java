package boundless.net.http;

import java.io.IOException;
import java.net.InetAddress;
import java.net.Proxy;
import java.net.ProxySelector;
import java.net.SocketAddress;
import java.net.URI;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;

/**
 * 全局代理选择器:本机地址(localhost / 127.* / ::1 / 0.0.0.0 / ::)一律直连,其余目标原样交给原默认选择器。
 *
 * <p>为什么必须在代码层做:启动参数 {@code -Djava.net.useSystemProxies=true} 让 JDK 的默认选择器去读操作系统代理。
 * 一旦走「系统代理」这条路,{@code http.nonProxyHosts} / {@code socksNonProxyHosts} 两个属性都不再参与判定
 * (JDK 只在 {@code *.proxyHost} 系统属性设了时才看它们),本机例外全凭操作系统那边的例外表;而 Windows 上
 * 系统代理只写了「主机:端口」时,JDK 会把同一个 HTTP 代理也当作 SOCKS 代理返回,且 SOCKS 查询不认例外表。
 * 结果:每一个裸 {@link java.net.Socket}(Apache HttpClient 的连接、数据库 / 缓存驱动、连接诊断)连本机端口时
 * 都会先去跟那个 HTTP 代理做 SOCKS 握手,报 {@code Reply from SOCKS server has bad version},本地排盘全线失败。
 *
 * <p>所有经 JDK 取代理的出站路径都过这里:裸 Socket(SocksSocketImpl 每次连接都查 {@link ProxySelector#getDefault()})、
 * {@link java.net.HttpURLConnection}、用 {@code .proxy(selector)} 构造的 JDK HttpClient。外部地址的结果与原选择器
 * 完全一致(系统代理照旧生效)。判定只做字面解析,绝不做 DNS 查询。
 */
public final class LoopbackDirectProxySelector extends ProxySelector {

	private static final List<Proxy> DIRECT = Collections.singletonList(Proxy.NO_PROXY);
	private static final Pattern IPV4_LITERAL = Pattern.compile("^\\d{1,3}(\\.\\d{1,3}){3}$");

	private final ProxySelector delegate;

	public LoopbackDirectProxySelector(ProxySelector delegate) {
		this.delegate = (delegate instanceof LoopbackDirectProxySelector)
			? ((LoopbackDirectProxySelector) delegate).delegate
			: delegate;
	}

	/** 被包住的原选择器(可能为 null = 原本就没有默认选择器)。 */
	public ProxySelector delegate() {
		return delegate;
	}

	/**
	 * 把当前默认选择器包一层后设为全局默认;已经包过则原样返回。幂等、线程安全,失败(安全管理器拒绝等)时
	 * 返回当前默认选择器,不抛错。
	 */
	public static synchronized ProxySelector install() {
		ProxySelector current = ProxySelector.getDefault();
		if (current instanceof LoopbackDirectProxySelector) {
			return current;
		}
		try {
			LoopbackDirectProxySelector wrapped = new LoopbackDirectProxySelector(current);
			ProxySelector.setDefault(wrapped);
			return wrapped;
		} catch (RuntimeException e) {
			return current;
		}
	}

	/**
	 * 是否本机地址。接受 URI 主机串的各种写法:{@code localhost}、{@code foo.localhost}、末尾带点、
	 * 方括号包住的 IPv6、IPv4 映射的 IPv6({@code ::ffff:127.0.0.1})。名字只认 localhost 一族,不解析 DNS。
	 */
	public static boolean isLoopbackHost(String rawHost) {
		if (rawHost == null) {
			return false;
		}
		String host = rawHost.trim().toLowerCase();
		if (host.startsWith("[") && host.endsWith("]") && host.length() >= 2) {
			host = host.substring(1, host.length() - 1);
		}
		int zone = host.indexOf('%');
		if (zone >= 0 && host.indexOf(':') >= 0) {
			host = host.substring(0, zone);
		}
		while (host.endsWith(".")) {
			host = host.substring(0, host.length() - 1);
		}
		if (host.isEmpty()) {
			return false;
		}
		if (host.equals("localhost") || host.endsWith(".localhost")) {
			return true;
		}
		try {
			InetAddress addr;
			if (IPV4_LITERAL.matcher(host).matches()) {
				addr = InetAddress.getByName(host);
			} else if (host.indexOf(':') >= 0 && host.matches("^[0-9a-f:.]+$")) {
				addr = InetAddress.getByName(host);
			} else {
				return false;
			}
			// IPv4 映射的 IPv6 字面量(::ffff:127.0.0.1)由 JDK 直接解析成 Inet4Address,同一判据覆盖
			return addr.isLoopbackAddress() || addr.isAnyLocalAddress();
		} catch (Exception e) {
			return false;
		}
	}

	/** URI 目标是否本机;主机名解析不出(含下划线等)时回退取 authority 的主机段。 */
	public static boolean isLoopbackTarget(URI uri) {
		if (uri == null) {
			return false;
		}
		String host = uri.getHost();
		if (host == null) {
			String auth = uri.getRawAuthority();
			if (auth == null) {
				return false;
			}
			int at = auth.lastIndexOf('@');
			if (at >= 0) {
				auth = auth.substring(at + 1);
			}
			if (auth.startsWith("[")) {
				int end = auth.indexOf(']');
				host = end > 0 ? auth.substring(0, end + 1) : auth;
			} else {
				int colon = auth.lastIndexOf(':');
				host = colon >= 0 ? auth.substring(0, colon) : auth;
			}
		}
		return isLoopbackHost(host);
	}

	@Override
	public List<Proxy> select(URI uri) {
		if (uri == null) {
			throw new IllegalArgumentException("URI can't be null.");
		}
		if (isLoopbackTarget(uri)) {
			return DIRECT;
		}
		if (delegate == null) {
			return DIRECT;
		}
		List<Proxy> got = delegate.select(uri);
		return (got == null || got.isEmpty()) ? DIRECT : got;
	}

	@Override
	public void connectFailed(URI uri, SocketAddress sa, IOException ioe) {
		if (uri == null || sa == null || ioe == null) {
			throw new IllegalArgumentException("Arguments can't be null.");
		}
		if (delegate != null && !isLoopbackTarget(uri)) {
			delegate.connectFailed(uri, sa, ioe);
		}
	}
}
