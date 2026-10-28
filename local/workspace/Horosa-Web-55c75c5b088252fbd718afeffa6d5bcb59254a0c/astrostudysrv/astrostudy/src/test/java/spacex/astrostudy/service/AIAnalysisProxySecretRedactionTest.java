package spacex.astrostudy.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

import org.junit.Test;

import boundless.exception.ErrorCodeException;

/**
 * 接口密钥不出现在任何错误文字 / 错误事件 / 错误日志里(Gemini 的密钥此前拼在网址 ?key= 里,
 * 接口地址不合法时 URI 解析异常把整条网址连密钥带进对话气泡与后端日志)。
 * 根修:密钥走 x-goog-api-key 请求头;所有外呼网址经 toUpstreamUri 预检(报第几个字符、不带网址);
 * 兜底:回页面与写日志的文字统一过 redactSecrets。
 */
public class AIAnalysisProxySecretRedactionTest {

	// 不是任何常见密钥形态:兜底的形态脱敏认不出它,只有「本次请求的密钥原文」那一层能挡
	private static final String KEY = "unitGeminiSecret-7f3a9c";
	// 三种不合法地址:主机名里夹空格 / 路径里多了 | / 没有主机名(都在发起网络请求之前就判出)
	private static final String[] BAD_BASES = { "https://my proxy.example.com/v1beta", "https://example.invalid/v1beta|x", "https:///v1beta" };

	private static Map<String, Object> params(String base){
		Map<String, Object> p = new LinkedHashMap<String, Object>();
		p.put("providerType", "gemini");
		p.put("baseUrl", base);
		p.put("apiKey", KEY);
		p.put("model", "gemini-3.5-flash");
		Map<String, Object> msg = new LinkedHashMap<String, Object>();
		msg.put("role", "user");
		msg.put("content", "hi");
		p.put("messages", Arrays.asList(msg));
		p.put("input", Arrays.asList("hello"));
		return p;
	}

	private static String chain(Throwable t){
		StringWriter sw = new StringWriter();
		t.printStackTrace(new PrintWriter(sw));
		return sw.toString();
	}

	static final class Capture extends AIAnalysisProxyService {
		final List<String> events = new CopyOnWriteArrayList<String>();
		final List<String> logs = new CopyOnWriteArrayList<String>();
		@Override
		void sendEvent(SseChannel channel, String eventName, Map<String, Object> payload) {
			events.add(eventName + ":" + payload);
		}
		@Override
		void writeErrorLog(Throwable redacted, String context) {
			logs.add(context + "\n" + chain(redacted));
		}
	}

	@Test
	public void badBaseUrlNeverLeaksKeyOnAnyOfFourPaths() {
		for(String base : BAD_BASES) {
			// 非流式三条路(对话 / 列模型 / 嵌入):抛出的异常(控制器的异常处理会原样写日志)里不带密钥,报「接口地址不合法」
			List<Runnable> calls = new ArrayList<Runnable>();
			final Capture svc = new Capture();
			calls.add(() -> svc.chat(params(base)));
			calls.add(() -> svc.listModels(params(base)));
			calls.add(() -> svc.embeddings(params(base)));
			for(int i = 0; i < calls.size(); i++) {
				try {
					calls.get(i).run();
					fail(base + " 路径 " + i + " 应当报错");
				}catch(ErrorCodeException e) {
					String all = chain(e);
					assertFalse(base + " 路径 " + i + " 异常带出了密钥:" + all, all.contains(KEY));
					assertTrue(base + " 路径 " + i + " 应说明接口地址不合法:" + e.getMessage(), e.getMessage().contains("接口地址不合法"));
					assertFalse("异常文字不该复述网址:" + e.getMessage(), e.getMessage().contains("example"));
				}
			}
			// 流式:错误事件与错误日志都不带密钥
			Capture stream = new Capture();
			stream.chatStream(params(base), new org.springframework.web.servlet.mvc.method.annotation.SseEmitter());
			assertEquals(base + " 应发一条错误事件:" + stream.events, 1, stream.events.stream().filter(x -> x.startsWith("error:")).count());
			for(String ev : stream.events) {
				assertFalse("错误事件带出了密钥:" + ev, ev.contains(KEY));
			}
			assertTrue(stream.events.get(stream.events.size() - 1).contains("接口地址不合法"));
			assertEquals("应写一条错误日志", 1, stream.logs.size());
			assertFalse("错误日志带出了密钥:" + stream.logs.get(0), stream.logs.get(0).contains(KEY));
		}
	}

	@Test
	public void geminiKeyTravelsInHeaderNotUrlAndBaseUrlInvisibleCharsAreStripped() throws Exception {
		com.sun.net.httpserver.HttpServer server = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
		final List<String> seen = new CopyOnWriteArrayList<String>();
		server.createContext("/", ex -> {
			seen.add(ex.getRequestURI().toString() + "|" + ex.getRequestHeaders().getFirst("x-goog-api-key") + "|" + ex.getRequestHeaders().getFirst("Authorization"));
			ex.getRequestBody().readAllBytes();
			byte[] body;
			if(ex.getRequestURI().getPath().endsWith(":embedContent")) {
				body = "{\"embedding\":{\"values\":[0.1,0.2]}}".getBytes(StandardCharsets.UTF_8);
			}else if(ex.getRequestURI().getPath().endsWith("/models")) {
				body = "{\"models\":[{\"name\":\"models/gemini-3.5-flash\"}]}".getBytes(StandardCharsets.UTF_8);
			}else {
				body = "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"好\"}]}}]}".getBytes(StandardCharsets.UTF_8);
			}
			ex.getResponseHeaders().add("Content-Type", "application/json");
			ex.sendResponseHeaders(200, body.length);
			ex.getResponseBody().write(body);
			ex.close();
		});
		server.start();
		try {
			// 从中文文档复制来的地址:尾部全角空格 + 零宽空格,中间夹一个零宽连接符 —— 清掉后照常可用
			String base = "http://127.0.0.1:" + server.getAddress().getPort() + "/v1‍beta/　​";
			Capture svc = new Capture();
			assertEquals("好", svc.chat(params(base)).get("content"));
			svc.listModels(params(base));
			svc.embeddings(params(base));
			assertEquals(3, seen.size());
			for(String s : seen) {
				assertTrue("网址被清理后应照常到达:" + s, s.startsWith("/v1beta/"));
				String uri = s.substring(0, s.indexOf('|'));
				assertFalse("网址里不该再有密钥:" + uri, uri.contains(KEY) || uri.contains("key="));
				assertTrue("密钥应走 x-goog-api-key:" + s, s.contains("|" + KEY + "|"));
				assertTrue("Gemini 不带 Authorization:" + s, s.endsWith("|null"));
			}
		} finally {
			server.stop(0);
		}
	}

	@Test
	public void redactSecretsCoversLiteralKeyAndCommonShapes() {
		assertEquals("x *** y", AIAnalysisProxyService.redactSecrets("x " + KEY + " y", KEY));
		assertEquals("https://h/m?alt=sse&key=***", AIAnalysisProxyService.redactSecrets("https://h/m?alt=sse&key=AnyThing123"));
		assertEquals("Authorization: Bearer ***", AIAnalysisProxyService.redactSecrets("Authorization: Bearer abcdef123456"));
		assertEquals("用 *** 调用", AIAnalysisProxyService.redactSecrets("用 sk-abcdefghijklmnop 调用"));
		assertEquals("key ***", AIAnalysisProxyService.redactSecrets("key AIzaSyA1234567890abcdefghijk"));
		assertEquals("没有密钥的文字原样", AIAnalysisProxyService.redactSecrets("没有密钥的文字原样", "", null));
		assertNull(AIAnalysisProxyService.redactSecrets(null));
		// 写日志用的异常副本:每层消息都脱敏、类名与调用栈保留
		Exception inner = new IllegalArgumentException("bad " + KEY);
		Throwable red = AIAnalysisProxyService.redactedThrowable(new RuntimeException("outer " + KEY, inner), KEY);
		String all = chain(red);
		assertFalse(all, all.contains(KEY));
		assertTrue(all, all.contains("java.lang.IllegalArgumentException: bad ***"));
		assertEquals(inner.getStackTrace().length, red.getCause().getStackTrace().length);
	}

	@Test
	public void toUpstreamUriReportsPositionWithoutEchoingUrlAndAcceptsIdn() {
		try {
			AIAnalysisProxyService.toUpstreamUri("https://my proxy.example.com/v1?key=" + KEY);
			fail("应报错");
		}catch(ErrorCodeException e) {
			assertTrue(e.getMessage(), e.getMessage().contains("第 11 个字符处:空白字符 U+0020"));
			assertFalse(e.getMessage(), e.getMessage().contains(KEY) || e.getMessage().contains("example"));
		}
		assertEquals("xn--mnq481g.example.com", AIAnalysisProxyService.toUpstreamUri("https://代理.example.com/v1").getHost());
		for(String bad : new String[]{ "ftp://h/v1", "https:///v1", "not a url" }) {
			try {
				AIAnalysisProxyService.toUpstreamUri(bad);
				fail(bad + " 应报错");
			}catch(ErrorCodeException e) {
				assertTrue(e.getMessage(), e.getMessage().contains("接口地址不合法"));
			}
		}
		assertNotNull(AIAnalysisProxyService.toUpstreamUri("http://127.0.0.1:11434/v1"));
		assertEquals("https://x/v1", AIAnalysisProxyService.resolveBaseUrl("gemini", "﻿ https://x/v1/　 "));
	}

	/** 源码锁:网址里再拼密钥 / 绕过 toUpstreamUri 直接 URI.create 即红 */
	@Test
	public void sourceNeverPutsKeyIntoUrlNorBypassesUriPreflight() throws Exception {
		Path src = Paths.get("src/main/java/spacex/astrostudy/service/AIAnalysisProxyService.java");
		if(!Files.exists(src)) { src = Paths.get("astrostudy").resolve(src); }
		String code = new String(Files.readAllBytes(src), StandardCharsets.UTF_8);
		assertFalse("网址里拼了密钥", Pattern.compile("[?&]key=(%s|\"\\s*\\+)").matcher(code).find());
		assertFalse("外呼网址绕过了 toUpstreamUri", code.contains("URI.create("));
		assertTrue("Gemini 密钥应走 x-goog-api-key", code.contains("headers.put(\"x-goog-api-key\", key);"));
	}
}
