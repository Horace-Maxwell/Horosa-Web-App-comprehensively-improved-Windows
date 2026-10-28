package spacex.astrostudycn.helper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.junit.Assert;
import org.junit.Test;

/**
 * 日期串取段单一来源:公元前前导负号先剥再拆(裸 split("-") 把 "-300-12-10" 的年当成月)。
 * 源码合同:astrostudy / astrostudycn 的 src/main 里,日期串一律经 CivilDateParts 取段,不许再出现裸 split("-") / split("/")。
 * 不需要 Python 计算服务。
 */
public class CivilDatePartsTest {

	@Test
	public void parsesSignedDatesWithoutTearingTheYear() {
		CivilDateParts bc = CivilDateParts.parse("-300/12/10");
		Assert.assertEquals(-300, bc.year);
		Assert.assertEquals(Integer.valueOf(12), bc.month);
		Assert.assertEquals(Integer.valueOf(10), bc.day);
		Assert.assertTrue(bc.negative);
		CivilDateParts dash = CivilDateParts.parse("-0300-06-10 12:00:00");
		Assert.assertEquals(-300, dash.year);
		Assert.assertEquals(Integer.valueOf(6), dash.month);
		CivilDateParts five = CivilDateParts.parse("12000-01-02");
		Assert.assertEquals(12000, five.year);
		Assert.assertEquals(Integer.valueOf(2), five.day);
		CivilDateParts modern = CivilDateParts.parse("1990/05/18");
		Assert.assertEquals(1990, modern.year);
		Assert.assertEquals(Integer.valueOf(5), modern.month);
		Assert.assertFalse(modern.negative);
		CivilDateParts yearOnly = CivilDateParts.parse("2026");
		Assert.assertEquals(2026, yearOnly.year);
		Assert.assertNull(yearOnly.month);
		Assert.assertNull(CivilDateParts.parse(""));
		Assert.assertNull(CivilDateParts.parse(null));
		Assert.assertNull(CivilDateParts.parse("0000-01-01"));
		Assert.assertNull(CivilDateParts.parse("abc-01-01"));
	}

	@Test
	public void astronomicalYearHasYearZero() {
		Assert.assertEquals(-299, CivilDateParts.astronomicalYear(-300));
		Assert.assertEquals(0, CivilDateParts.astronomicalYear(-1));
		Assert.assertEquals(1, CivilDateParts.astronomicalYear(1));
		Assert.assertEquals(2026, CivilDateParts.astronomicalYear(2026));
	}

	private static final Pattern RAW_DATE_SPLIT = Pattern.compile("\\.split\\(\"(-|/|\\[-/\\]|\\[/-\\])\"\\)");

	@Test
	public void mainSourcesDoNotSplitDateStringsByHand() throws IOException {
		Path srvRoot = Paths.get(System.getProperty("user.dir")).getParent();
		List<String> bad = new ArrayList<String>();
		for(String module : new String[] { "astrostudy", "astrostudycn" }) {
			Path main = srvRoot.resolve(module).resolve("src/main/java");
			if(!Files.isDirectory(main)) {
				continue;
			}
			List<Path> files;
			try(Stream<Path> s = Files.walk(main)) {
				files = s.filter(p -> p.toString().endsWith(".java")).collect(Collectors.toList());
			}
			for(Path f : files) {
				if(f.getFileName().toString().equals("CivilDateParts.java")) {
					continue;
				}
				List<String> lines = Files.readAllLines(f, StandardCharsets.UTF_8);
				for(int i = 0; i < lines.size(); i++) {
					String line = lines.get(i);
					String code = line.contains("//") ? line.substring(0, line.indexOf("//")) : line;
					if(RAW_DATE_SPLIT.matcher(code).find()) {
						bad.add(srvRoot.relativize(f) + ":" + (i + 1));
					}
				}
			}
		}
		Assert.assertTrue("日期串取段请经 CivilDateParts(裸 split 把公元前的年当成月):" + bad, bad.isEmpty());
	}

	@Test
	public void rawSplitDetectorHasDiscrimination() {
		Assert.assertTrue(RAW_DATE_SPLIT.matcher("String[] parts = date.split(\"-\");").find());
		Assert.assertTrue(RAW_DATE_SPLIT.matcher("String[] parts = date.split(\"/\");").find());
		Assert.assertFalse(RAW_DATE_SPLIT.matcher("String[] parts = time.split(\":\");").find());
	}
}
