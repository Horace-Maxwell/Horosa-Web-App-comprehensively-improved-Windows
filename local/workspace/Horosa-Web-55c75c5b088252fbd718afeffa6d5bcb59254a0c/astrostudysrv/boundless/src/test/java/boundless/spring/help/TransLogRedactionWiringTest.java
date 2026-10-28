package boundless.spring.help;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.junit.Test;

/**
 * 源码锁:会写出去的请求记录(交易日志、错误日志里的请求数据 / 查询串 / 出站请求头与网址)都经密钥脱敏单源
 * SecretRedactor,别处不再自带字段表 / 正则(两套规则会各漏各的)。
 */
public class TransLogRedactionWiringTest {
	private static final Path MAIN = Paths.get("src/main/java/boundless");

	private static String read(String rel) throws IOException {
		return new String(Files.readAllBytes(MAIN.resolve(rel)), StandardCharsets.UTF_8);
	}

	private static int count(String s, String needle) {
		int c = 0;
		for(int i = s.indexOf(needle); i >= 0; i = s.indexOf(needle, i + needle.length())) {
			c++;
		}
		return c;
	}

	@Test
	public void transLogWriteGoesThroughRedactor() throws IOException {
		String helper = read("spring/help/TransLogMongoHelper.java");
		assertEquals("交易日志写入点只许一处", 1, count(helper, "cache.add("));
		assertTrue(helper.contains("cache.add(SecretRedactor.redactRecord(map));"));

		String td = read("spring/help/interceptor/TransData.java");
		assertTrue(td.contains("head = SecretRedactor.redactRecord(head, RemovedParams);"));
		assertTrue(td.contains("map = SecretRedactor.redactRecord(map, RemovedParams);"));
		assertFalse(td.contains("removeParamsIgnoreCase"));
		// 先放 user 再脱敏(用户对象里也可能带令牌)
		assertTrue(td.indexOf("head.put(\"user\", user.toMap());") < td.indexOf("head = SecretRedactor.redactRecord(head, RemovedParams);"));
	}

	@Test
	public void errorLogsUseTheSingleSource() throws IOException {
		String h = read("spring/help/springcomp/RestResponseEntityExceptionHandler.java");
		assertTrue(h.contains("SecretRedactor.redactValue(decoded)"));
		assertTrue(h.contains("return SecretRedactor.redactText(queryString);"));
		assertFalse("异常处理器又自带了一张字段表", h.contains("sensitiveLogFields"));

		String dbg = read("spring/help/interceptor/DebugTransParamsLogInterceptor.java");
		assertTrue(dbg.contains("SecretRedactor.redactText(request.getQueryString())"));
		assertTrue(dbg.contains("TransLogRules.transCodeIn(excludeTransSet, path)"));
	}

	@Test
	public void outboundHttpLogsAreRedacted() throws IOException {
		String cmd = read("net/http/HttpUriRequestHystrixCommand.java");
		assertTrue(cmd.contains("boundless.utility.SecretRedactor.redactHeaders(headers)"));
		assertFalse("出站请求头又自带了一张名字表", cmd.contains("key.equals(\"authorization\")"));
		int lines = 0;
		try (DirectoryStream<Path> ds = Files.newDirectoryStream(MAIN.resolve("net/http"), "*.java")) {
			for(Path p : ds) {
				for(String line : Files.readAllLines(p, StandardCharsets.UTF_8)) {
					String t = line.trim();
					boolean urlLog = t.startsWith("HttpClientUtility.log.error(") || t.startsWith("log.error(\"fail, msg:")
						|| (t.startsWith("QueueLog.error(AppLoggers.ErrorLogger, \"请求{}失败"));
					if(urlLog) {
						lines++;
						// 网址与异常文字两个参数都要过单源
						assertTrue(p.getFileName() + " 网址 / 异常文字未脱敏:" + t, count(t, "SecretRedactor.redactText(") >= 2);
					}
				}
			}
		}
		assertTrue(lines >= 10);
	}
}
