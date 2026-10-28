package boundless.spring.help.interceptor;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import javax.servlet.http.HttpServletResponse;

/**
 * 响应头 Result(错误文字)的唯一写入口。
 *
 * <p>HTTP 头只能放 ISO-8859-1:原文里的中文会被容器换成空格(读到空串),裸 % 会让页面的解码抛错。
 * 所以一律按 UTF-8 百分号编码(URLEncoder,空格再写成 %20),页面用 decodeURIComponent(+ 还原成空格)解,
 * 解不开就原样显示。各处不许再直接 setHeader(KeyConstants.ResultMessage, …)(源码锁见 ResultHeaderTest)。
 */
public final class ResultHeader {
	private ResultHeader() {
	}

	public static String encode(String message) {
		if (message == null || message.isEmpty()) {
			return "";
		}
		return URLEncoder.encode(message, StandardCharsets.UTF_8).replace("+", "%20");
	}

	public static void setMessage(HttpServletResponse response, String message) {
		response.setHeader(KeyConstants.ResultMessage, encode(message));
	}
}
