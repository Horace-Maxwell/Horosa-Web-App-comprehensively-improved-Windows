package boundless.types.cache;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/**
 * 本地回落缓存(Mongo 缺席时的文档缓存)落盘脱敏:装请求记录的缓存写进文件的内容不含任何密钥原文;
 * 内存里的文档与读取路径不变;旧版本写下的明文记录在下一次写盘时一并脱敏;
 * 功能性缓存(没开脱敏)原样落盘 —— 否则重启读回的是掩码。
 */
public class LocalDocumentCacheRedactionTest {

	private static final String[] SECRETS = {
		"opaque-api-1", "opaque-api-2", "opaque-auth-1", "opaque-goog-1", "opaque-anth-1", "opaque-q-1",
		"opaque-pw-1", "opaque-tok-1", "opaque-sec-1", "opaque-extra-1", "opaque-bearer-1"
	};

	private Path dir;

	@Before
	public void setUp() throws Exception {
		dir = Files.createTempDirectory("horosa-docache-test");
	}

	@After
	public void tearDown() throws Exception {
		if(dir != null) {
			try (java.util.stream.Stream<Path> s = Files.walk(dir)) {
				s.sorted(java.util.Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
			}
		}
	}

	/** 形如交易日志的一条请求记录:请求头 / 参数 / 嵌套供应商选项 / 错误文字 / 调用栈各藏一把。 */
	static Map<String, Object> requestRecord() {
		Map<String, Object> head = new LinkedHashMap<String, Object>();
		head.put("Authorization", "Bearer opaque-auth-1");
		head.put("X-Goog-Api-Key", "opaque-goog-1");
		head.put("x-api-key", "opaque-anth-1");
		head.put("clientapp", "desktop");
		Map<String, Object> extra = new LinkedHashMap<String, Object>();
		extra.put("X-My-Gateway", "opaque-extra-1");
		Map<String, Object> options = new LinkedHashMap<String, Object>();
		options.put("extraHeaders", extra);
		options.put("client_secret", "opaque-sec-1");
		Map<String, Object> params = new LinkedHashMap<String, Object>();
		params.put("providerType", "gemini");
		params.put("apiKey", "opaque-api-1");
		params.put("API_KEY", "opaque-api-2");
		params.put("Password", "opaque-pw-1");
		params.put("accessToken", "opaque-tok-1");
		params.put("providerOptions", options);
		params.put("pdTimeKey", "keep-pd");
		Map<String, Object> rec = new LinkedHashMap<String, Object>();
		rec.put("transcode", "/aianalysis/chat");
		rec.put("head", head);
		rec.put("params", params);
		rec.put("errmsg", "upstream: https://h/v1beta/models/x:generateContent?key=opaque-q-1");
		rec.put("errstack", "java.lang.RuntimeException: Authorization: Bearer opaque-bearer-1");
		return rec;
	}

	private static void assertNoSecret(String fileText) {
		for(String s : SECRETS) {
			assertFalse(s + " 明文落盘", fileText.contains(s));
		}
	}

	@Test
	public void requestRecordsAreMaskedOnDiskButNotInMemory() throws Exception {
		Path f = dir.resolve("translog.json");
		LocalDocumentCache cache = new LocalDocumentCache("translog", "_id", "v", f, true);
		assertTrue(cache.isRedactOnPersist());
		Map<String, Object> rec = requestRecord();
		rec.put("_id", "r1");
		cache.add(rec);
		cache.put("k2", requestRecord());
		cache.setMap("k3", requestRecord(), 3600);
		cache.putFieldValue((Object) "k4", "params", requestRecord().get("params"));

		String disk = new String(Files.readAllBytes(f), StandardCharsets.UTF_8);
		assertNoSecret(disk);
		assertTrue(disk.contains("keep-pd"));
		assertTrue(disk.contains("/aianalysis/chat"));
		assertTrue(disk.contains("X-My-Gateway") || disk.contains("extraHeaders"));

		// 读取路径不变:内存里还是原文档
		Map<String, Object> back = cache.getMap("r1");
		assertNotNull(back);
		assertEquals("opaque-api-1", ((Map<?, ?>) back.get("params")).get("apiKey"));

		// 重启读回:能读、结构在,只是密钥成了掩码
		LocalDocumentCache reopened = new LocalDocumentCache("translog", "_id", "v", f, true);
		Map<String, Object> again = reopened.getMap("r1");
		assertNotNull(again);
		assertEquals("keep-pd", ((Map<?, ?>) again.get("params")).get("pdTimeKey"));
		assertEquals("gemini", ((Map<?, ?>) again.get("params")).get("providerType"));
		assertNotNull(reopened.getMap("k3"));
		assertNotNull(reopened.get("k2"));
	}

	@Test
	public void legacyPlaintextFileIsScrubbedOnNextWriteAndStillReadable() throws Exception {
		Path f = dir.resolve("astrolog.json");
		// 旧版本(不脱敏)写下的明文记录
		LocalDocumentCache legacy = new LocalDocumentCache("astrolog", "_id", "v", f, false);
		Map<String, Object> old = requestRecord();
		old.put("_id", "old-1");
		legacy.add(old);
		String before = new String(Files.readAllBytes(f), StandardCharsets.UTF_8);
		assertTrue("前提:旧文件确有明文", before.contains("opaque-api-1"));

		LocalDocumentCache upgraded = new LocalDocumentCache("astrolog", "_id", "v", f, true);
		assertNotNull("旧记录照常读回", upgraded.getMap("old-1"));
		Map<String, Object> fresh = new LinkedHashMap<String, Object>();
		fresh.put("_id", "new-1");
		fresh.put("transcode", "/chart");
		upgraded.add(fresh);
		String after = new String(Files.readAllBytes(f), StandardCharsets.UTF_8);
		assertNoSecret(after);
		assertTrue(after.contains("old-1"));
		assertTrue(after.contains("new-1"));
	}

	@Test
	public void legacyPlaintextFileIsScrubbedOnLoadWithoutAnyWrite() throws Exception {
		// 桌面版交易日志不写盘(needtranslog=false):等不到「下一次写盘」,读入时就要回写脱敏版
		Path f = dir.resolve("astrolog.json");
		LocalDocumentCache legacy = new LocalDocumentCache("astrolog", "_id", "v", f, false);
		Map<String, Object> old = requestRecord();
		old.put("_id", "old-2");
		legacy.add(old);
		assertTrue("前提:旧文件确有明文", new String(Files.readAllBytes(f), StandardCharsets.UTF_8).contains("opaque-api-1"));
		LocalDocumentCache upgraded = new LocalDocumentCache("astrolog", "_id", "v", f, true);
		String after = new String(Files.readAllBytes(f), StandardCharsets.UTF_8);
		assertNoSecret(after);
		assertTrue(after.contains("old-2"));
		assertNotNull("旧记录照常读回", upgraded.getMap("old-2"));
		// 没开脱敏的功能性缓存:读入不回写、原样
		Path g = dir.resolve("nongli2.json");
		LocalDocumentCache fn = new LocalDocumentCache("nongli", "_id", "v", g, false);
		Map<String, Object> doc = new LinkedHashMap<String, Object>();
		doc.put("_id", "n2");
		doc.put("token", "functional-token-2");
		fn.add(doc);
		long m0 = Files.getLastModifiedTime(g).toMillis();
		Thread.sleep(20);
		new LocalDocumentCache("nongli", "_id", "v", g, false);
		assertEquals(m0, Files.getLastModifiedTime(g).toMillis());
		assertTrue(new String(Files.readAllBytes(g), StandardCharsets.UTF_8).contains("functional-token-2"));
	}

	@Test
	public void functionalCachesPersistVerbatim() throws Exception {
		Path f = dir.resolve("nongli.json");
		LocalDocumentCache cache = new LocalDocumentCache("nongli", "_id", "v", f);
		assertFalse(cache.isRedactOnPersist());
		Map<String, Object> doc = new LinkedHashMap<String, Object>();
		doc.put("_id", "n1");
		doc.put("key", "2020-01-01T00");
		doc.put("token", "functional-token-1");
		cache.add(doc);
		String disk = new String(Files.readAllBytes(f), StandardCharsets.UTF_8);
		assertTrue(disk.contains("2020-01-01T00"));
		assertTrue(disk.contains("functional-token-1"));
		LocalDocumentCache reopened = new LocalDocumentCache("nongli", "_id", "v", f);
		assertEquals("functional-token-1", reopened.getMap("n1").get("token"));
	}

	/** 源码锁:回落缓存只有一个写文件的地方,且经 persistDocsLocked(脱敏单源);工厂造回落缓存处处带脱敏开关。 */
	@Test
	public void sourceLockWritePathAndFactoryWiring() throws Exception {
		Path base = Paths.get("src/main/java/boundless/types/cache");
		String cache = new String(Files.readAllBytes(base.resolve("LocalDocumentCache.java")), StandardCharsets.UTF_8);
		assertEquals("文件写入点只许一处", 1, count(cache, "Files.writeString("));
		assertTrue(cache.contains("root.put(\"docs\", persistDocsLocked());"));
		assertTrue(cache.contains("SecretRedactor.redactRecord(doc, null, this.keyField)"));
		String factory = new String(Files.readAllBytes(base.resolve("MongoCacheFactory.java")), StandardCharsets.UTF_8);
		Matcher m = Pattern.compile("new LocalDocumentCache\\(([^;]*)\\);").matcher(factory);
		int n = 0;
		while(m.find()) {
			n++;
			assertTrue("回落缓存构造未带脱敏开关:" + m.group(1), m.group(1).trim().endsWith("redactOnPersist)") || m.group(1).trim().endsWith("redactOnPersist"));
		}
		assertTrue(n >= 3);
		assertTrue(factory.contains("p.get(RedactOnPersistKey)"));
		assertTrue(factory.contains("factory.redactOnPersist = this.redactOnPersist;"));
	}

	private static int count(String s, String needle) {
		int c = 0;
		int i = 0;
		while((i = s.indexOf(needle, i)) >= 0) {
			c++;
			i += needle.length();
		}
		return c;
	}
}
