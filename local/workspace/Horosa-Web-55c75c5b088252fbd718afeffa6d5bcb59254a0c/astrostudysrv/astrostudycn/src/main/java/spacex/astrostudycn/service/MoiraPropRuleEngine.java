package spacex.astrostudycn.service;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

class MoiraPropRuleEngine {

	private static final String[] SIGN_IDS = new String[] {
		"Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
		"Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
	};
	private static final String[] SIGN_NAMES = new String[] {
		"白羊", "金牛", "双子", "巨蟹", "狮子", "处女",
		"天秤", "天蝎", "射手", "摩羯", "水瓶", "双鱼"
	};
	private static final String[] SIGN_ZI = new String[] {
		"戌", "酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥"
	};
	private static final String[] SIGN_AREAS = new String[] {
		"降娄", "大梁", "实沉", "鹑首", "鹑火", "鹑尾",
		"寿星", "大火", "析木", "星纪", "玄枵", "娵訾"
	};
	private static final String[] MOIRA_HOUSE_NAMES = new String[] {
		"命宫", "财帛", "兄弟", "田宅", "男女", "奴仆",
		"夫妻", "疾厄", "迁移", "官禄", "福德", "相貌"
	};
	private static final String[] PILLAR_KEYS = new String[] {"year", "month", "day", "time"};
	private static final String[] PILLAR_NAMES = new String[] {"年", "月", "日", "时"};
	private static final String[] PLANET_CN = new String[] {"日", "月", "金", "木", "水", "火", "土", "计", "罗", "炁", "孛"};
	private static final String[] STEMS = new String[] {"甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"};
	private static final String[] BRANCHES = new String[] {"子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"};
	private static final String[] STEM_BRANCHES = new String[] {
		"甲子", "乙丑", "丙寅", "丁卯", "戊辰", "己巳", "庚午", "辛未", "壬申", "癸酉",
		"甲戌", "乙亥", "丙子", "丁丑", "戊寅", "己卯", "庚辰", "辛巳", "壬午", "癸未",
		"甲申", "乙酉", "丙戌", "丁亥", "戊子", "己丑", "庚寅", "辛卯", "壬辰", "癸巳",
		"甲午", "乙未", "丙申", "丁酉", "戊戌", "己亥", "庚子", "辛丑", "壬寅", "癸卯",
		"甲辰", "乙巳", "丙午", "丁未", "戊申", "己酉", "庚戌", "辛亥", "壬子", "癸丑",
		"甲寅", "乙卯", "丙辰", "丁巳", "戊午", "己未", "庚申", "辛酉", "壬戌", "癸亥"
	};

	private final Map<String, String> raw;
	private final String[] yearNames;
	private final String[] yearStarSeq;
	private final int[] yearStarMap;
	private final int yearStarStart;
	private final int yearStarEnd;
	private final String[] birthYearSigns;
	private final List<String> birthDisplayList;
	private final List<String> nowDisplayList;

	MoiraPropRuleEngine() {
		this.raw = loadProp();
		this.yearNames = array("birth_year_names", STEM_BRANCHES);
		this.yearStarSeq = array("year_star_seq", new String[] {"火", "孛", "木", "金", "土", "月", "水", "炁", "计", "罗"});
		this.yearStarMap = intArray("year_star_map", new int[] {0, 9, 2, 1, 4, 3, 6, 5, 8, 7});
		int[] range = intArray("year_star_range", new int[] {90, 100});
		this.yearStarStart = range.length > 0 ? range[0] : 90;
		this.yearStarEnd = range.length > 1 ? range[1] : 100;
		this.birthYearSigns = array("birth_year_signs", new String[] {"命宫", "相貌", "福德", "官禄", "迁移", "疾厄", "夫妻", "奴仆", "男女", "田宅", "兄弟", "财帛"});
		this.birthDisplayList = Arrays.asList(array("birth_master_display_list", new String[0]));
		this.nowDisplayList = Arrays.asList(array("now_master_display_list", new String[0]));
	}

	Map<String, Object> build(Map<String, Object> birthChartObj, Map<String, Object> birthParams, Map<String, Object> transitChartObj, Map<String, Object> transitParams, int lifeSignIndex) {
		String[] birthPoles = readPoles(birthChartObj, birthParams);
		String[] transitPoles = readPoles(transitChartObj == null || transitChartObj.isEmpty() ? birthChartObj : transitChartObj, transitParams);
		Map<String, Object> res = new LinkedHashMap<String, Object>();
		res.put("source", "moira_s.prop");
		res.put("encoding", "UTF-16BE");
		res.put("ruleCount", raw.size());
		res.put("yearStarSeq", Arrays.asList(yearStarSeq));
		res.put("yearStarMap", intList(yearStarMap));
		res.put("tenGodListOrg", Arrays.asList(array("ten_god_list_org", new String[0])));
		res.put("tenGodListAlt", Arrays.asList(array("ten_god_list_alt", new String[0])));
		res.put("weakSolid", buildWeakSolid(birthPoles, lifeSignIndex));
		res.put("birthYearStars", buildYearStarContext(birthPoles, raw.get("birth_year_info"), true, lifeSignIndex));
		res.put("currentYearStars", buildYearStarContext(transitPoles, raw.get("current_year_info"), false, lifeSignIndex));
		res.put("natalYearStars", buildYearSignRows(birthPoles, true, lifeSignIndex));
		res.put("transitYearStars", buildYearSignRows(transitPoles, false, lifeSignIndex));
		res.put("birthGodHits", buildGodRows(birthPoles, birthChartObj, birthParams, false, lifeSignIndex));
		res.put("transitGodHits", buildGodRows(transitPoles, transitChartObj, transitParams, true, lifeSignIndex));
		res.put("signStatus", buildSignStatus(birthChartObj));
		return res;
	}

	private Map<String, Object> buildYearStarContext(String[] poles, String yearInfo, boolean birth, int lifeSignIndex) {
		Map<String, Object> res = new LinkedHashMap<String, Object>();
		String yearPole = safePole(poles, 0);
		res.put("yearPole", yearPole);
		res.put("yearStar", yearPole.length() >= 1 ? getYearStar(indexOf(yearNames, yearPole), yearStarStart) : "");
		List<Map<String, Object>> groups = parseYearInfoGroups(resolveYearInfo(poles, yearInfo, birth, lifeSignIndex));
		res.put("groups", groups);
		Map<String, List<String>> byPlanet = new LinkedHashMap<String, List<String>>();
		for(String p : PLANET_CN) {
			byPlanet.put(p, new ArrayList<String>());
		}
		for(Map<String, Object> group : groups) {
			List<Map<String, String>> items = castItems(group.get("items"));
			for(Map<String, String> item : items) {
				String star = item.get("star");
				String name = item.get("name");
				if(byPlanet.containsKey(star) && !byPlanet.get(star).contains(name)) {
					byPlanet.get(star).add(name);
				}
			}
		}
		List<Map<String, Object>> rows = new ArrayList<Map<String, Object>>();
		for(String p : PLANET_CN) {
			Map<String, Object> row = new LinkedHashMap<String, Object>();
			row.put("star", p);
			row.put("changeTo", firstTenGod(byPlanet.get(p)));
			row.put("items", byPlanet.get(p));
			rows.add(row);
		}
		res.put("planetRows", rows);
		return res;
	}

	@SuppressWarnings("unchecked")
	private List<Map<String, String>> castItems(Object obj) {
		if(obj instanceof List) {
			return (List<Map<String, String>>) obj;
		}
		return Collections.emptyList();
	}

	private String firstTenGod(List<String> items) {
		if(items == null) {
			return "";
		}
		Set<String> ten = new HashSet<String>(Arrays.asList(array("ten_god_list_org", new String[0])));
		for(String item : items) {
			if(ten.contains(item)) {
				return item;
			}
		}
		return "";
	}

	private List<Map<String, Object>> parseYearInfoGroups(String text) {
		List<Map<String, Object>> groups = new ArrayList<Map<String, Object>>();
		if(text == null) {
			return groups;
		}
		String cleaned = text.replace("$", "").replace("@", " ").trim();
		String[] parts = cleaned.split("\\|");
		for(String part : parts) {
			String p = part.trim();
			if(p.isEmpty()) {
				continue;
			}
			List<Map<String, String>> items = new ArrayList<Map<String, String>>();
			for(String token : p.split("%")) {
				Map<String, String> item = parseYearItem(token);
				if(item != null) {
					items.add(item);
				}
			}
			if(items.isEmpty()) {
				continue;
			}
			Map<String, Object> row = new LinkedHashMap<String, Object>();
			row.put("main", items.get(0).get("name"));
			row.put("mainStar", items.get(0).get("star"));
			row.put("items", items);
			groups.add(row);
		}
		return groups;
	}

	private Map<String, String> parseYearItem(String token) {
		String t = token == null ? "" : token.trim();
		if(t.isEmpty() || t.indexOf('︵') < 0 || t.indexOf('︶') < 0) {
			return null;
		}
		int a = t.indexOf('︵');
		int b = t.indexOf('︶', a + 1);
		if(a <= 0 || b <= a) {
			return null;
		}
		Map<String, String> item = new LinkedHashMap<String, String>();
		item.put("name", t.substring(0, a).trim());
		item.put("star", t.substring(a + 1, b).trim());
		return item;
	}

	private String resolveYearInfo(String[] poles, String yearInfo, boolean birth, int lifeSignIndex) {
		if(yearInfo == null) {
			return "";
		}
		String yearPole = safePole(poles, 0);
		String str = yearInfo.replace("@", " ");
		String[] yearData = array(yearPole, new String[0]);
		DecimalFormat format = new DecimalFormat("00");
		for(int i=0; i<yearData.length; i++) {
			str = str.replaceFirst(format.format(i + 1), yearData[i]);
		}
		if(birth) {
			str = str.replaceFirst("00", wifeStar(lifeSignIndex));
			replaceMonthKeys(poles, str);
			str = replaceMonthKeys(poles, str);
			str = replaceLifeBranchKeys(poles, str, lifeSignIndex);
			str = replacePowerKeys(poles, str);
		}else {
			str = str.replaceFirst("00", " ");
		}
		int yIndex = indexOf(yearNames, yearPole);
		for(int i=yearStarStart; i<yearStarEnd; i++) {
			str = str.replaceAll(format.format(i), getYearStar(yIndex, i));
		}
		return str;
	}

	private String replaceMonthKeys(String[] poles, String str) {
		String[] names = array("month_key_seq", new String[0]);
		String[] indexes = array("month_index_seq", new String[0]);
		String monthBranch = branch(safePole(poles, 1));
		for(int i=0; i<names.length && i<indexes.length; i++) {
			String val = lookupPair(names[i], monthBranch);
			if(!val.isEmpty()) {
				str = str.replaceFirst(indexes[i], val);
			}
		}
		return str;
	}

	private String replaceLifeBranchKeys(String[] poles, String str, int lifeSignIndex) {
		String lifeBranch = signZi(lifeSignIndex);
		String[] data = array("year_birth_earth_key", new String[0]);
		if(data.length >= 2) {
			String val = lookupPair(data[0], lifeBranch);
			if(!val.isEmpty()) {
				str = str.replaceFirst(data[1], val);
			}
		}
		String[] names = array("sky_key_seq", new String[0]);
		String[] indexes = array("sky_index_seq", new String[0]);
		String stem = stem(safePole(poles, 0));
		for(int i=0; i<names.length && i<indexes.length; i++) {
			String val = lookupPair(names[i] + stem, lifeBranch);
			if(!val.isEmpty()) {
				str = str.replaceFirst(indexes[i], val);
			}
		}
		return str;
	}

	private String replacePowerKeys(String[] poles, String str) {
		String[] names = array("power_key", new String[0]);
		String[] indexes = array("power_index", new String[0]);
		String stem = stem(safePole(poles, 0));
		for(int i=0; i<names.length && i<indexes.length; i++) {
			String val = lookupPair(names[i], stem);
			if(!val.isEmpty()) {
				str = str.replaceFirst(indexes[i], val);
			}
		}
		return str;
	}

	private String wifeStar(int lifeSignIndex) {
		String[] wifeSigns = array("wife_signs", new String[0]);
		int wifePos = intValue(raw.get("birth_wife_sign"), 6);
		if(wifeSigns.length == 0) {
			return " ";
		}
		return wifeSigns[wrap(lifeSignIndex - wifePos, wifeSigns.length)];
	}

	private List<Map<String, Object>> buildYearSignRows(String[] poles, boolean birth, int lifeSignIndex) {
		List<Map<String, Object>> rows = new ArrayList<Map<String, Object>>();
		String yearPole = safePole(poles, 0);
		int yIndex = indexOf(yearNames, yearPole);
		for(int i=0; i<birthYearSigns.length; i++) {
			String name = birthYearSigns[i];
			String[] arr = array(name + string("year_sign_key", "星"), new String[0]);
			if(arr.length < 3) {
				continue;
			}
			int code = intValue(arr[0], -1);
			String star = code > 0 ? getYearStar(yIndex, code) : "";
			int signIdx = wrap(lifeSignIndex - i, 12);
			Map<String, Object> row = new LinkedHashMap<String, Object>();
			row.put("name", name);
			row.put("star", star);
			row.put("shortName", arr[1]);
			row.put("quality", arr[2]);
			row.put("zi", signZi(signIdx));
			row.put("sign", SIGN_IDS[signIdx]);
			row.put("signName", SIGN_NAMES[signIdx]);
			row.put("area", SIGN_AREAS[signIdx]);
			row.put("mode", birth ? "birth" : "current");
			rows.add(row);
		}
		return rows;
	}

	private Map<String, Object> buildWeakSolid(String[] poles, int lifeSignIndex) {
		Map<String, Object> res = new LinkedHashMap<String, Object>();
		List<Map<String, Object>> pillarRows = new ArrayList<Map<String, Object>>();
		Map<String, List<String>> weakByZi = new LinkedHashMap<String, List<String>>();
		Map<String, List<String>> solidByZi = new LinkedHashMap<String, List<String>>();
		for(int i=0; i<PILLAR_KEYS.length; i++) {
			String pole = safePole(poles, i);
			String weak = computeWeakHouse(pole);
			String solid = branch(pole);
			Map<String, Object> row = new LinkedHashMap<String, Object>();
			row.put("pillar", PILLAR_NAMES[i]);
			row.put("stemBranch", pole);
			row.put("weakZi", weak);
			row.put("solidZi", solid);
			row.put("weak", weak);
			row.put("solid", solid);
			pillarRows.add(row);
			addName(weakByZi, weak, PILLAR_NAMES[i]);
			addName(solidByZi, solid, PILLAR_NAMES[i]);
		}
		List<Map<String, Object>> houseRows = new ArrayList<Map<String, Object>>();
		for(int i=0; i<12; i++) {
			int signIdx = wrap(lifeSignIndex + i, 12);
			String zi = signZi(signIdx);
			Map<String, Object> row = new LinkedHashMap<String, Object>();
			row.put("house", MOIRA_HOUSE_NAMES[i]);
			row.put("houseIndex", i + 1);
			row.put("zi", zi);
			row.put("signName", SIGN_NAMES[signIdx]);
			row.put("area", SIGN_AREAS[signIdx]);
			row.put("weakPillars", listOrEmpty(weakByZi.get(zi)));
			row.put("solidPillars", listOrEmpty(solidByZi.get(zi)));
			row.put("weak", weakByZi.containsKey(zi));
			row.put("solid", solidByZi.containsKey(zi));
			row.put("label", labelWeakSolid(weakByZi.get(zi), solidByZi.get(zi)));
			houseRows.add(row);
		}
		res.put("pillars", pillarRows);
		res.put("houses", houseRows);
		return res;
	}

	private String labelWeakSolid(List<String> weak, List<String> solid) {
		List<String> labels = new ArrayList<String>();
		if(weak != null && !weak.isEmpty()) {
			labels.add("虚" + join(weak, ""));
		}
		if(solid != null && !solid.isEmpty()) {
			labels.add("实" + join(solid, ""));
		}
		return join(labels, "、");
	}

	private List<Map<String, Object>> buildGodRows(String[] poles, Map<String, Object> chartObj, Map<String, Object> params, boolean now, int lifeSignIndex) {
		Map<String, LinkedHashSet<String>> table = buildGodTable(poles, chartObj, params, now);
		List<String> display = now ? nowDisplayList : birthDisplayList;
		List<Map<String, Object>> rows = new ArrayList<Map<String, Object>>();
		for(int i=0; i<12; i++) {
			int signIdx = wrap(lifeSignIndex + i, 12);
			String zi = signZi(signIdx);
			List<String> gods = ordered(table.get(zi), display);
			Map<String, Object> row = new LinkedHashMap<String, Object>();
			row.put("house", MOIRA_HOUSE_NAMES[i]);
			row.put("houseIndex", i + 1);
			row.put("zi", zi);
			row.put("signName", SIGN_NAMES[signIdx]);
			row.put("area", SIGN_AREAS[signIdx]);
			row.put("gods", gods);
			row.put("goodGods", gods);
			row.put("neutralGods", Collections.emptyList());
			row.put("badGods", Collections.emptyList());
			row.put("taisuiGods", now ? gods : Collections.emptyList());
			row.put("source", "moira_s.prop");
			rows.add(row);
		}
		return rows;
	}

	private Map<String, LinkedHashSet<String>> buildGodTable(String[] poles, Map<String, Object> chartObj, Map<String, Object> params, boolean now) {
		Map<String, LinkedHashSet<String>> table = new LinkedHashMap<String, LinkedHashSet<String>>();
		String yearPole = safePole(poles, 0);
		addEntries(table, string("star_sky_earth_key", "干支") + yearPole);
		addEntries(table, string("star_sky_key", "天干") + stem(yearPole));
		addEntries(table, string("star_earth_key", "地支") + branch(yearPole));
		addEntries(table, string("star_month_key", "月支") + branch(safePole(poles, 1)));
		addEntries(table, string("star_month_hour_key", "月时") + branch(safePole(poles, 1)) + branch(safePole(poles, 3)));
		addQi(table, yearPole, chartObj, params);
		return table;
	}

	private void addEntries(Map<String, LinkedHashSet<String>> table, String key) {
		for(String entry : array(key, new String[0])) {
			int idx = entry.indexOf(':');
			if(idx <= 0 || idx >= entry.length() - 1) {
				continue;
			}
			addStar(table, entry.substring(0, idx).trim(), entry.substring(idx + 1).trim(), new HashSet<String>());
		}
	}

	private void addStar(Map<String, LinkedHashSet<String>> table, String zi, String star, Set<String> seen) {
		if(zi.isEmpty() || star.isEmpty()) {
			return;
		}
		if(!table.containsKey(zi)) {
			table.put(zi, new LinkedHashSet<String>());
		}
		table.get(zi).add(star);
		if(seen.contains(star)) {
			return;
		}
		seen.add(star);
		String value = raw.get(star);
		if(value == null || value.indexOf(':') >= 0 || value.startsWith("+") || value.startsWith("-") || value.indexOf("[") >= 0) {
			return;
		}
		for(String item : splitList(value)) {
			addStar(table, zi, item, seen);
		}
	}

	private void addQi(Map<String, LinkedHashSet<String>> table, String yearPole, Map<String, Object> chartObj, Map<String, Object> params) {
		String yearStem = stem(yearPole);
		String qi = raw.get(string("star_sky_qi_key", "卦气") + yearStem);
		if(qi == null || qi.length() < 3 || qi.indexOf(':') < 0) {
			return;
		}
		String startZi = qi.substring(0, 1);
		double degree = isDay(params) ? planetLon(chartObj, "Sun") : planetLon(chartObj, "Moon");
		int startSign = ziToSign(startZi);
		if(startSign < 0 || degree < -900) {
			return;
		}
		int shift = wrap(signIndex(degree) - startSign, 12);
		int stemIndex = indexOf(STEMS, yearStem);
		if(stemIndex < 0) {
			return;
		}
		String key = string("star_sky_qi_key", "卦气") + STEMS[wrap(stemIndex + shift, STEMS.length)];
		String value = raw.get(key);
		if(value != null && value.length() >= 3 && value.indexOf(':') > 0) {
			addStar(table, value.substring(value.indexOf(':') + 1, value.indexOf(':') + 2), string("star_sky_qi_key", "卦气"), new HashSet<String>());
		}
	}

	private List<Map<String, Object>> buildSignStatus(Map<String, Object> chartObj) {
		List<Map<String, Object>> rows = new ArrayList<Map<String, Object>>();
		for(String star : PLANET_CN) {
			Map<String, Object> obj = objectByCn(chartObj, star);
			if(obj == null) {
				continue;
			}
			double lon = position(obj);
			int signIdx = signIndex(lon);
			List<String> statuses = new ArrayList<String>();
			for(String entry : array(string("sign_status_key", "星辰") + star, new String[0])) {
				int idx = entry.indexOf(':');
				if(idx > 0 && signZi(signIdx).equals(entry.substring(0, idx))) {
					statuses.add(entry.substring(idx + 1));
				}
			}
			Map<String, Object> row = new LinkedHashMap<String, Object>();
			row.put("star", star);
			row.put("zi", signZi(signIdx));
			row.put("signName", SIGN_NAMES[signIdx]);
			row.put("statuses", statuses);
			row.put("status", join(statuses, "、"));
			rows.add(row);
		}
		return rows;
	}

	private List<String> ordered(Set<String> set, List<String> display) {
		List<String> result = new ArrayList<String>();
		if(set == null || set.isEmpty()) {
			return result;
		}
		for(String item : display) {
			if(set.contains(item)) {
				result.add(item);
			}
		}
		for(String item : set) {
			if(!result.contains(item)) {
				result.add(item);
			}
		}
		return result;
	}

	private String getYearStar(int yearIndex, int order) {
		if(yearIndex < 0) {
			return "";
		}
		int n = order - yearStarStart;
		if(n < 0) {
			return "";
		}
		int idx = (yearIndex + n) % yearStarSeq.length;
		return yearStarSeq[idx];
	}

	private String computeWeakHouse(String pole) {
		int i = indexOf(yearNames, pole);
		if(i < 0) {
			return "";
		}
		int index = 10 - 2 * (i / 10);
		if((i % 2) == 1) {
			index++;
		}
		return BRANCHES[wrap(index, BRANCHES.length)];
	}

	private String[] readPoles(Map<String, Object> chartObj, Map<String, Object> params) {
		String[] poles = new String[4];
		Map<String, Object> bazi = bazi(chartObj);
		for(int i=0; i<PILLAR_KEYS.length; i++) {
			poles[i] = readPole(bazi, PILLAR_KEYS[i]);
		}
		if(poles[0].isEmpty()) {
			poles[0] = stemBranchForYear(yearFromParams(params));
		}
		return poles;
	}

	private String readPole(Map<String, Object> bazi, String key) {
		Map<String, Object> one = asMap(bazi.get(key));
		String value = firstText(one, "text", "name", "value");
		if(value.isEmpty()) {
			String stem = firstText(asMap(one.get("stem")), "cell", "text", "name");
			String branch = firstText(asMap(one.get("branch")), "cell", "text", "name");
			value = stem + branch;
		}
		return normalizePole(value);
	}

	private String normalizePole(String value) {
		String s = value == null ? "" : value.trim();
		for(String pole : yearNames) {
			if(s.contains(pole)) {
				return pole;
			}
		}
		if(s.length() >= 2) {
			String candidate = s.substring(0, 2);
			if(indexOf(yearNames, candidate) >= 0) {
				return candidate;
			}
		}
		return "";
	}

	private Map<String, Object> bazi(Map<String, Object> chartObj) {
		Map<String, Object> chart = asMap(chartObj.get("chart"));
		Map<String, Object> chartNongli = asMap(chart.get("nongli"));
		Map<String, Object> rootNongli = asMap(chartObj.get("nongli"));
		Map<String, Object> bazi = asMap(chartNongli.get("bazi"));
		if(!bazi.isEmpty()) {
			return bazi;
		}
		return asMap(rootNongli.get("bazi"));
	}

	private Map<String, String> loadProp() {
		Map<String, String> map = new LinkedHashMap<String, String>();
		InputStream in = MoiraPropRuleEngine.class.getClassLoader().getResourceAsStream("moira/moira_s.prop");
		if(in == null) {
			return map;
		}
		try {
			BufferedReader reader = new BufferedReader(new InputStreamReader(in, Charset.forName("UTF-16BE")));
			String line;
			while((line = reader.readLine()) != null) {
				String s = line.trim();
				if(s.isEmpty() || s.startsWith("#")) {
					continue;
				}
				int idx = s.indexOf('=');
				if(idx <= 0) {
					continue;
				}
				map.put(s.substring(0, idx).trim(), unquote(s.substring(idx + 1).trim()));
			}
			reader.close();
		}catch(Exception e) {
			return map;
		}
		return map;
	}

	private String[] array(String key, String[] fallback) {
		String value = raw.get(key);
		if(value == null) {
			return fallback;
		}
		List<String> list = splitList(value);
		return list.toArray(new String[list.size()]);
	}

	private int[] intArray(String key, int[] fallback) {
		String[] arr = array(key, new String[0]);
		if(arr.length == 0) {
			return fallback;
		}
		int[] out = new int[arr.length];
		for(int i=0; i<arr.length; i++) {
			out[i] = intValue(arr[i], 0);
		}
		return out;
	}

	private List<String> splitList(String value) {
		List<String> list = new ArrayList<String>();
		if(value == null) {
			return list;
		}
		for(String item : value.split(",")) {
			String v = unquote(item.trim());
			if(!v.isEmpty()) {
				list.add(v);
			}
		}
		return list;
	}

	private String lookupPair(String key, String prefix) {
		if(key == null || prefix == null || prefix.isEmpty()) {
			return "";
		}
		for(String item : array(key, new String[0])) {
			int idx = item.indexOf(':');
			if(idx > 0 && prefix.equals(item.substring(0, idx))) {
				return item.substring(idx + 1);
			}
		}
		return "";
	}

	private Map<String, Object> objectByCn(Map<String, Object> chartObj, String cn) {
		Map<String, Object> chart = asMap(chartObj.get("chart"));
		for(Object item : asList(chart.get("objects"))) {
			Map<String, Object> obj = asMap(item);
			String id = stringValue(obj.get("id"));
			if(("日".equals(cn) && "Sun".equals(id)) || ("月".equals(cn) && "Moon".equals(id))
				|| ("金".equals(cn) && "Venus".equals(id)) || ("木".equals(cn) && "Jupiter".equals(id))
				|| ("水".equals(cn) && "Mercury".equals(id)) || ("火".equals(cn) && "Mars".equals(id))
				|| ("土".equals(cn) && "Saturn".equals(id)) || ("罗".equals(cn) && "North Node".equals(id))
				|| ("计".equals(cn) && "South Node".equals(id)) || ("炁".equals(cn) && "Purple Clouds".equals(id))
				|| ("孛".equals(cn) && "Dark Moon".equals(id))) {
				return obj;
			}
		}
		return null;
	}

	private double planetLon(Map<String, Object> chartObj, String id) {
		Map<String, Object> chart = asMap(chartObj.get("chart"));
		for(Object item : asList(chart.get("objects"))) {
			Map<String, Object> obj = asMap(item);
			if(id.equals(stringValue(obj.get("id")))) {
				return position(obj);
			}
		}
		return -999;
	}

	private double position(Map<String, Object> obj) {
		if(obj == null) {
			return 0;
		}
		// 黄仪显示口径(QizhengMoiraRuleService.DISPLAY_ECLIPTIC 同线程装载):度数取黄经;
		// 赤仪/未装载:取 ra(旧行为)。
		if(QizhengMoiraRuleService.displayEcliptic() && obj.containsKey("lon")) {
			return normalize(num(obj.get("lon"), 0));
		}
		if(obj.containsKey("ra")) {
			return normalize(num(obj.get("ra"), 0));
		}
		if(obj.containsKey("lon")) {
			return normalize(num(obj.get("lon"), 0));
		}
		String sign = stringValue(obj.get("sign"));
		double signLon = num(obj.get("signlon"), 0);
		for(int i=0; i<SIGN_IDS.length; i++) {
			if(SIGN_IDS[i].equals(sign)) {
				return normalize(i * 30.0 + signLon);
			}
		}
		return normalize(signLon);
	}

	private int signIndex(double lon) {
		return wrap((int)Math.floor(normalize(lon) / 30.0), 12);
	}

	private int ziToSign(String zi) {
		for(int i=0; i<SIGN_ZI.length; i++) {
			if(SIGN_ZI[i].equals(zi)) {
				return i;
			}
		}
		return -1;
	}

	private String signZi(int signIdx) {
		return SIGN_ZI[wrap(signIdx, 12)];
	}

	private boolean isDay(Map<String, Object> params) {
		String time = stringValue(params == null ? null : params.get("time"));
		int hour = 12;
		try {
			hour = Integer.parseInt(time.split(":")[0]);
		}catch(Exception e) {
			hour = 12;
		}
		return hour >= 6 && hour < 18;
	}

	private int yearFromParams(Map<String, Object> params) {
		String date = stringValue(params == null ? null : params.get("date")).replace('/', '-');
		// 年段=首个 '-' 分隔段(公元前带前导负号、五位年均正确;旧 substring(0,4) 会把 -7040 截成 -704)
		boolean neg = date.startsWith("-");
		String body = neg ? date.substring(1) : date;
		int cut = body.indexOf('-');
		String yearText = cut > 0 ? body.substring(0, cut) : body;
		if(yearText.length() > 0) {
			int y = intValue(yearText, 2000);
			return neg ? -y : y;
		}
		return 2000;
	}

	private String stemBranchForYear(int year) {
		return STEM_BRANCHES[wrap(year - 1984, 60)];
	}

	private String stem(String pole) {
		return pole != null && pole.length() >= 1 ? pole.substring(0, 1) : "";
	}

	private String branch(String pole) {
		return pole != null && pole.length() >= 2 ? pole.substring(1, 2) : "";
	}

	private String safePole(String[] poles, int idx) {
		return poles != null && poles.length > idx && poles[idx] != null ? poles[idx] : "";
	}

	private void addName(Map<String, List<String>> map, String key, String name) {
		if(key == null || key.isEmpty()) {
			return;
		}
		if(!map.containsKey(key)) {
			map.put(key, new ArrayList<String>());
		}
		map.get(key).add(name);
	}

	private List<String> listOrEmpty(List<String> list) {
		return list == null ? Collections.<String>emptyList() : list;
	}

	private List<Integer> intList(int[] arr) {
		List<Integer> list = new ArrayList<Integer>();
		for(int item : arr) {
			list.add(item);
		}
		return list;
	}

	private String string(String key, String fallback) {
		String value = raw.get(key);
		return value == null || value.isEmpty() ? fallback : value;
	}

	@SuppressWarnings("unchecked")
	private Map<String, Object> asMap(Object obj) {
		if(obj instanceof Map) {
			return (Map<String, Object>) obj;
		}
		return Collections.emptyMap();
	}

	@SuppressWarnings("unchecked")
	private List<Object> asList(Object obj) {
		if(obj instanceof List) {
			return (List<Object>) obj;
		}
		return Collections.emptyList();
	}

	private String firstText(Map<String, Object> map, String... keys) {
		for(String key : keys) {
			String value = stringValue(map.get(key));
			if(!value.isEmpty()) {
				return value;
			}
		}
		return "";
	}

	private String stringValue(Object obj) {
		return obj == null ? "" : String.valueOf(obj);
	}

	private double num(Object obj, double fallback) {
		if(obj instanceof Number) {
			return ((Number)obj).doubleValue();
		}
		try {
			return Double.parseDouble(String.valueOf(obj));
		}catch(Exception e) {
			return fallback;
		}
	}

	private int intValue(String value, int fallback) {
		try {
			return Integer.parseInt(value.trim());
		}catch(Exception e) {
			return fallback;
		}
	}

	private int indexOf(String[] arr, String value) {
		for(int i=0; i<arr.length; i++) {
			if(arr[i].equals(value)) {
				return i;
			}
		}
		return -1;
	}

	private double normalize(double val) {
		double out = val % 360.0;
		return out < 0 ? out + 360.0 : out;
	}

	private int wrap(int val, int size) {
		if(size <= 0) {
			return 0;
		}
		int out = val % size;
		return out < 0 ? out + size : out;
	}

	private String join(List<String> list, String sep) {
		if(list == null || list.isEmpty()) {
			return "";
		}
		StringBuilder sb = new StringBuilder();
		for(int i=0; i<list.size(); i++) {
			if(i > 0) {
				sb.append(sep);
			}
			sb.append(list.get(i));
		}
		return sb.toString();
	}

	private String unquote(String value) {
		if(value == null) {
			return "";
		}
		String v = value.trim();
		if(v.length() >= 2 && ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'")))) {
			return v.substring(1, v.length() - 1);
		}
		return v;
	}
}
