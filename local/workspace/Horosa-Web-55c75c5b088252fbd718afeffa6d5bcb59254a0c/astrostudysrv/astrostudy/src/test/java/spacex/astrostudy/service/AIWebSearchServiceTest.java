package spacex.astrostudy.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.Test;

import boundless.exception.ErrorCodeException;

/** 联网检索(P7):归一形状五家一致;HTML 去净;摘要封顶;错误文案永不含 Key;未配置/空查询各自报码。 */
public class AIWebSearchServiceTest {

	private static Map<String, Object> row(String... kv) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		for (int i = 0; i + 1 < kv.length; i += 2) {
			m.put(kv[i], kv[i + 1]);
		}
		return m;
	}

	private static Map<String, Object> wrap(String key, List<Map<String, Object>> rows) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		m.put(key, rows);
		return m;
	}

	@Test
	public void normalizeTavilyExaAndSearxngShareOneShape() {
		AIWebSearchService svc = new AIWebSearchService();
		List<Map<String, Object>> rows = new ArrayList<Map<String, Object>>();
		rows.add(row("title", "紫微斗数简介", "url", "https://a.test/1", "content", "命宫与三方四正", "published_date", "2026-01-01"));
		rows.add(row("title", "无链接的条目", "content", "应被丢弃"));
		rows.add(row("name", "别名字段", "link", "https://a.test/2", "snippet", "另一种字段名"));
		List<Map<String, Object>> out = svc.normalize("tavily", wrap("results", rows), 10);
		assertEquals(2, out.size());
		assertEquals("紫微斗数简介", out.get(0).get("title"));
		assertEquals("https://a.test/1", out.get(0).get("url"));
		assertEquals("命宫与三方四正", out.get(0).get("snippet"));
		assertEquals("2026-01-01", out.get(0).get("publishedAt"));
		assertEquals("别名字段", out.get(1).get("title"));
		assertEquals("另一种字段名", out.get(1).get("snippet"));
		assertEquals("", out.get(1).get("publishedAt"));
		// exa / searxng / custom 同样读顶层 results
		assertEquals(1, svc.normalize("exa", wrap("results", Arrays.asList(row("title", "t", "url", "https://b.test", "text", "x"))), 10).size());
		assertEquals(1, svc.normalize("searxng", wrap("results", Arrays.asList(row("title", "t", "url", "https://c.test", "content", "y"))), 10).size());
		// 回体畸形 → 空表(绝不编造)
		assertTrue(svc.normalize("tavily", null, 10).isEmpty());
		assertTrue(svc.normalize("tavily", new LinkedHashMap<String, Object>(), 10).isEmpty());
	}

	@Test
	public void normalizeBraveReadsNestedWebResultsAndRespectsMax() {
		AIWebSearchService svc = new AIWebSearchService();
		List<Map<String, Object>> rows = new ArrayList<Map<String, Object>>();
		for (int i = 0; i < 8; i++) {
			rows.add(row("title", "t" + i, "url", "https://d.test/" + i, "description", "s" + i, "page_age", "2026-02-0" + (i % 9)));
		}
		Map<String, Object> payload = new LinkedHashMap<String, Object>();
		payload.put("web", wrap("results", rows));
		List<Map<String, Object>> out = svc.normalize("brave", payload, 3);
		assertEquals(3, out.size());
		assertEquals("https://d.test/0", out.get(0).get("url"));
		// brave 的顶层 results 不该被误读
		assertTrue(svc.normalize("brave", wrap("results", rows), 3).isEmpty());
	}

	@Test
	public void stripHtmlRemovesTagsScriptsAndEntities() {
		assertEquals("命宫 在午", AIWebSearchService.stripHtml("<p>命宫</p>  <b>在午</b>"));
		assertEquals("safe", AIWebSearchService.stripHtml("<script>alert('x')</script> safe"));
		assertEquals("a & b < c > d \" e ' f", AIWebSearchService.stripHtml("a &amp; b &lt; c &gt; d &quot; e &#39; f"));
		assertEquals("", AIWebSearchService.stripHtml(null));
		assertEquals("", AIWebSearchService.stripHtml(""));
	}

	@Test
	public void snippetIsClippedToLimit() {
		StringBuilder sb = new StringBuilder();
		for (int i = 0; i < 2000; i++) {
			sb.append('x');
		}
		AIWebSearchService svc = new AIWebSearchService();
		List<Map<String, Object>> out = svc.normalize("tavily", wrap("results", Arrays.asList(row("title", "t", "url", "https://e.test", "content", sb.toString()))), 10);
		assertEquals(AIWebSearchService.SNIPPET_MAX, ((String) out.get(0).get("snippet")).length());
	}

	@Test
	public void missingKeyOrQueryFailsFastAndNeverEchoesTheKey() {
		AIWebSearchService svc = new AIWebSearchService();
		Map<String, Object> p = new LinkedHashMap<String, Object>();
		p.put("engine", "tavily");
		p.put("query", "   ");
		p.put("apiKey", "tvly-SECRET-KEY-0000");
		try {
			svc.search(p);
			fail("空查询应报错");
		} catch (ErrorCodeException e) {
			assertEquals(AIWebSearchService.ERR_EMPTY_QUERY, e.getCode());
			assertFalse("错误文案绝不含 Key", String.valueOf(e.getMessage()).contains("tvly-SECRET-KEY-0000"));
		}
		Map<String, Object> p2 = new LinkedHashMap<String, Object>();
		p2.put("engine", "tavily");
		p2.put("query", "紫微斗数");
		try {
			svc.search(p2);
			fail("缺 Key 应报未配置");
		} catch (ErrorCodeException e) {
			assertEquals(AIWebSearchService.ERR_NOT_CONFIGURED, e.getCode());
		}
		Map<String, Object> p3 = new LinkedHashMap<String, Object>();
		p3.put("engine", "custom");
		p3.put("query", "q");
		p3.put("apiKey", "k");
		try {
			svc.search(p3);
			fail("自定义引擎缺地址应报未配置");
		} catch (ErrorCodeException e) {
			assertEquals(AIWebSearchService.ERR_NOT_CONFIGURED, e.getCode());
		}
		Map<String, Object> p4 = new LinkedHashMap<String, Object>();
		p4.put("engine", "nope");
		p4.put("query", "q");
		p4.put("apiKey", "k");
		try {
			svc.search(p4);
			fail("未知引擎应报未配置");
		} catch (ErrorCodeException e) {
			assertEquals(AIWebSearchService.ERR_NOT_CONFIGURED, e.getCode());
		}
	}
}
