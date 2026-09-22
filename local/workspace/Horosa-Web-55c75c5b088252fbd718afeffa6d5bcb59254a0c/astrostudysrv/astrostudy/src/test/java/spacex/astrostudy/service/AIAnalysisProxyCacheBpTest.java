package spacex.astrostudy.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.Test;

// Anthropic system 前缀缓存断点:单段带标记(对话 window 模式:稳定层 + 断点、无挥发段)必须打成
// 单块数组并带 cache_control;无标记保持字符串形态(旧行为字节零变);多段仍按原规则非末块打标。
public class AIAnalysisProxyCacheBpTest {

	private static Map<String, Object> msg(String role, String content) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		m.put("role", role);
		m.put("content", content);
		return m;
	}

	private static Map<String, Object> params() {
		Map<String, Object> p = new LinkedHashMap<String, Object>();
		p.put("maxTokens", 1024);
		p.put("temperature", 0.7);
		return p;
	}

	private static Object systemOf(String systemText) {
		List<Map<String, Object>> messages = new ArrayList<Map<String, Object>>();
		messages.add(msg("system", systemText));
		messages.add(msg("user", "请分析"));
		Map<String, Object> body = AIAnalysisProxyService.buildAnthropicBody("claude-sonnet-5", params(), messages, true);
		return body.get("system");
	}

	@Test
	public void singleSegmentWithMarkerBecomesOneCachedBlock() {
		Object sys = systemOf("稳定前缀甲乙丙\n\n" + AIAnalysisProxyService.PROMPT_CACHE_BP);
		assertTrue("单段带标记应为数组块", sys instanceof List);
		List<?> blocks = (List<?>) sys;
		assertEquals(1, blocks.size());
		Map<?, ?> blk = (Map<?, ?>) blocks.get(0);
		assertEquals("text", blk.get("type"));
		assertEquals("稳定前缀甲乙丙", blk.get("text"));
		assertFalse("标记不得泄漏进上游文本", String.valueOf(blk.get("text")).contains(AIAnalysisProxyService.PROMPT_CACHE_BP));
		Map<?, ?> cc = (Map<?, ?>) blk.get("cache_control");
		assertNotNull("单块必须打 cache_control", cc);
		assertEquals("ephemeral", cc.get("type"));
	}

	@Test
	public void noMarkerKeepsPlainStringForm() {
		Object sys = systemOf("稳定前缀甲乙丙");
		assertTrue("无标记保持字符串形态(旧行为)", sys instanceof String);
		assertEquals("稳定前缀甲乙丙", sys);
	}

	@Test
	public void twoSegmentsOnlyNonLastBlockCached() {
		Object sys = systemOf("稳定前缀\n\n" + AIAnalysisProxyService.PROMPT_CACHE_BP + "\n\n挥发段");
		assertTrue(sys instanceof List);
		List<?> blocks = (List<?>) sys;
		assertEquals(2, blocks.size());
		Map<?, ?> first = (Map<?, ?>) blocks.get(0);
		Map<?, ?> last = (Map<?, ?>) blocks.get(1);
		assertEquals("稳定前缀", first.get("text"));
		assertNotNull(first.get("cache_control"));
		assertEquals("挥发段", last.get("text"));
		assertNull("末块不打 cache_control(原规则)", last.get("cache_control"));
	}

	@Test
	public void onlyMarkerYieldsEmptySystemString() {
		Object sys = systemOf(AIAnalysisProxyService.PROMPT_CACHE_BP);
		assertEquals("", sys);
	}
}
