package boundless.spring.help;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import org.junit.Test;

/**
 * 交易日志两条纯规则的判别向量:排除表 / 白名单不分大小写;按名删参不分大小写。
 * 改前形态(精确串匹配 / 只删三形)在这些向量上必红。
 */
public class TransLogRulesTest {

	@Test
	public void transCodeMatchIgnoresCaseAndWhitespace() {
		Set<String> set = TransLogRules.normalizeTransCodes(Arrays.asList("/aianalysis/chat", " /Common/Time ", null));
		assertEquals(new HashSet<String>(Arrays.asList("/aianalysis/chat", "/common/time")), set);
		assertTrue(TransLogRules.transCodeIn(set, "/aianalysis/chat"));
		assertTrue("大小写变体必须仍命中排除表", TransLogRules.transCodeIn(set, "/AIAnalysis/Chat"));
		assertTrue(TransLogRules.transCodeIn(set, "/AIANALYSIS/CHAT "));
		assertTrue(TransLogRules.transCodeIn(set, "/common/TIME"));
		assertFalse(TransLogRules.transCodeIn(set, "/aianalysis/chat/stream"));
		assertFalse(TransLogRules.transCodeIn(set, null));
		assertFalse(TransLogRules.transCodeIn(null, "/aianalysis/chat"));
		assertTrue(TransLogRules.normalizeTransCodes(null).isEmpty());
	}

	@Test
	public void shippedExcludeTableStillMatchesCaseVariants() throws Exception {
		// 随包的排除表(astrostudyboot 资源):每一条的大写变体都必须命中;资源不在(单模块构建)则跳过
		File json = new File("../astrostudyboot/src/main/resources/conf/log/excludelogtrans.json");
		if(!json.isFile()) {
			return;
		}
		String text = new String(Files.readAllBytes(json.toPath()), StandardCharsets.UTF_8);
		Set<String> raw = new HashSet<String>();
		for(String line : text.split("\n")) {
			String t = line.trim();
			if(t.startsWith("\"")) {
				raw.add(t.substring(1, t.lastIndexOf('"')));
			}
		}
		assertTrue("排除表至少含 AI 对话端点", raw.contains("/aianalysis/chat"));
		Set<String> set = TransLogRules.normalizeTransCodes(raw);
		for(String code : raw) {
			assertTrue(code, TransLogRules.transCodeIn(set, code.toUpperCase()));
			assertTrue(code, TransLogRules.transCodeIn(set, code));
		}
	}

	@Test
	public void removeParamsIgnoresCase() {
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("Token", "t");
		map.put("ACCESSTOKEN", "a");
		map.put("passWord", "p");
		map.put("Passwd", "q");
		map.put("keep", "k");
		map.put(null, "n");
		int removed = TransLogRules.removeParamsIgnoreCase(map, new String[] {"token", "accesstoken", "Password", "PASSWD", null});
		assertEquals(4, removed);
		assertEquals(2, map.size());
		assertEquals("k", map.get("keep"));
		assertTrue(map.containsKey(null));
		assertEquals(0, TransLogRules.removeParamsIgnoreCase(map, new String[0]));
		assertEquals(0, TransLogRules.removeParamsIgnoreCase(null, new String[] {"keep"}));
		assertEquals(0, TransLogRules.removeParamsIgnoreCase(map, null));
		assertEquals("keep 不在删除名单,原样保留", "k", map.get("keep"));
	}
}
