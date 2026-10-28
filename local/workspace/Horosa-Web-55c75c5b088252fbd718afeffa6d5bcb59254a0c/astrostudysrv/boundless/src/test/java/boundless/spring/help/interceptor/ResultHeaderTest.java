package boundless.spring.help.interceptor;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.Test;

/** Result 头编码口径:只含 ASCII、页面 decodeURIComponent(+ 还原空格)能还原原文;各模块写 Result 头只许经 ResultHeader。 */
public class ResultHeaderTest {

	private static String pageDecode(String header) throws Exception {
		// 与页面 decodeResultHeader 同口径:+ → 空格,再按 UTF-8 百分号解码(URLDecoder 正是这两步)
		return URLDecoder.decode(header, StandardCharsets.UTF_8.name());
	}

	@Test
	public void encodedHeaderIsAsciiAndRoundTrips() throws Exception {
		String[] samples = { "参数错误: year, month", "100% failed", "a+b c", "line1\nline2", "" };
		for (String s : samples) {
			String enc = ResultHeader.encode(s);
			assertTrue("头值必须是可见 ASCII:" + enc, enc.chars().allMatch(c -> c >= 0x21 && c <= 0x7e) || enc.isEmpty());
			assertFalse("空格不许编码成 +(页面要区分原文里的 +):" + enc, enc.contains("+"));
			assertEquals(s, pageDecode(enc));
		}
		assertEquals("", ResultHeader.encode(null));
	}

	private static final Pattern RAW_WRITE = Pattern.compile(
			"(setHeader|addHeader)\\s*\\(\\s*(KeyConstants\\.ResultMessage|\"Result\")\\s*,");

	@Test
	public void resultHeaderIsOnlyWrittenThroughResultHeader() throws IOException {
		File modules = new File("..").getCanonicalFile();
		List<String> offenders = new ArrayList<>();
		File[] dirs = modules.listFiles(File::isDirectory);
		assertTrue("找不到后端各模块目录:" + modules, dirs != null && dirs.length > 0);
		int scanned = 0;
		for (File m : dirs) {
			Path src = new File(m, "src/main/java").toPath();
			if (!Files.isDirectory(src)) {
				continue;
			}
			try (Stream<Path> files = Files.walk(src)) {
				for (Path f : (Iterable<Path>) files.filter(p -> p.toString().endsWith(".java"))::iterator) {
					scanned++;
					if (f.getFileName().toString().equals("ResultHeader.java")) {
						continue;
					}
					String text = new String(Files.readAllBytes(f), StandardCharsets.UTF_8);
					if (RAW_WRITE.matcher(text).find()) {
						offenders.add(modules.toPath().relativize(f).toString());
					}
				}
			}
		}
		assertTrue("扫到的源码文件太少(目录挪了?):" + scanned, scanned > 50);
		assertTrue("这些文件直接写 Result 头(改用 ResultHeader.setMessage):" + offenders, offenders.isEmpty());
	}
}
