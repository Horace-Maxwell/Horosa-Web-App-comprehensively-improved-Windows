package spacex.astrostudy.helper;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import boundless.io.FileUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.model.FourColumns;
import spacex.astrostudy.model.GanZi;
import spacex.astrostudy.model.godrule.GodRule;
import spacex.astrostudy.model.godrule.GodRuleByJiaZi;
import spacex.astrostudy.model.godrule.GodRuleByNaYing;
import spacex.astrostudy.model.godrule.GodRuleByPhase;
import spacex.astrostudy.model.godrule.GodRuleByRiZhu;
import spacex.astrostudy.model.godrule.GuoLaoGods;

public class GodsHelper {
	public static GodRule[] rules;
	public static String[] taisuiGods1;
	public static String[] taisuiGods2;
	public static String[] taisuiGods3;
	
	public static Map<String, GodRule> rulesMap = new HashMap<String, GodRule>();
	
	private static final String[] Zhus = new String[] {"年", "日", "年日"};
	
	
	static {
		String jsonstr = FileUtility.getStringFromClassPath("spacex/astrostudy/helper/gods.json");
		List<GodRule> list = JsonUtility.decodeList(jsonstr, GodRule.class);
		rules = new GodRule[list.size()];
		int i = 0;
		for(GodRule godRule : list) {
			if(godRule.keyType.equals(GodRule.TypeRiZhu)) {
				rules[i] = new GodRuleByRiZhu(godRule);
			}else if(godRule.keyType.equals(GodRule.TypeNaYing)) {
				rules[i] = new GodRuleByNaYing(godRule);
			}else if(godRule.keyType.equals(GodRule.TypeJiaZi)) {
				rules[i] = new GodRuleByJiaZi(godRule);
			}else if(godRule.valueType.equals(GodRule.TypePhase) && !godRule.keyType.equals(GodRule.TypeNaYing)) {
				rules[i] = new GodRuleByPhase(godRule);
			}else {
				rules[i] = godRule;
			}
			String[] names = StringUtility.splitString(godRule.name, '/');
			rulesMap.put(godRule.name, godRule);
			for(String name : names) {
				rulesMap.put(name, godRule);
			}
			i++;
		}
		
		jsonstr = FileUtility.getStringFromClassPath("spacex/astrostudy/helper/taisui.json");
		Map<String, Object> map = JsonUtility.toDictionary(jsonstr);  
		List<String> gods = (List<String>) map.get("gods1");
		taisuiGods1 = new String[gods.size()];
		gods.toArray(taisuiGods1);
		
		gods = (List<String>) map.get("gods2");
		taisuiGods2 = new String[gods.size()];
		gods.toArray(taisuiGods2);
		
		gods = (List<String>) map.get("gods3");
		taisuiGods3 = new String[gods.size()];
		gods.toArray(taisuiGods3);
		
	}
	
	private static void findQiQue(FourColumns fourCols) {
		String god = "缺奇";
		boolean allji = fourCols.year.stem.cell.equals("己") && fourCols.month.stem.cell.equals("己") &&
				fourCols.day.stem.cell.equals("己") && fourCols.time.stem.cell.equals("己");
		if(fourCols.year.stem.cell.equals("己") && !allji) {
			fourCols.year.addBadGod(god);
		}
		
	}
	
	private static void findFuYin(FourColumns fourCols) {
		String god = "伏吟";
		
		for(int i=0; i<3; i++) {
			GanZi gz = fourCols.fourZhu[i];
			for(int j=i+1; j<4; j++) {
				GanZi gzVer = fourCols.fourZhu[j];
				if(gz.ganCong(gzVer) != null && gz.ziTong(gzVer)) {
					gz.addBadGod(god);
					gzVer.addBadGod(god);
				}
			}
		}
	}
	
	private static void findFangYin(FourColumns fourCols) {
		String god = "反吟";
		
		for(int i=0; i<3; i++) {
			GanZi gz = fourCols.fourZhu[i];
			for(int j=i+1; j<4; j++) {
				GanZi gzVer = fourCols.fourZhu[j];
				if(gz.ganCong(gzVer) != null && gz.ziCong(gzVer) != null) {
					gz.addBadGod(god);
					gzVer.addBadGod(god);
				}
			}
		}
	}
	
	private static void findSuiDian(FourColumns fourCols) {
		String god = "岁殿";
		int yearZiIdx = StemBranch.BranchIndex.get(fourCols.year.branch.cell);
		int yearGanIdx = StemBranch.StemIndex.get(fourCols.year.stem.cell);
		int idx = (yearZiIdx + yearGanIdx) % 12;
		String zi = StemBranch.Branches[idx];
		for(int i=1; i<4; i++) {
			GanZi gz = fourCols.fourZhu[i];
			if(gz.branch.cell.equals(zi)) {
				gz.branch.addNeutralGod(god);
			}
		}
	}
	
	private static void findDouShao(FourColumns fourCols) {
		String god = "斗杓";
		int monthZiIdx = StemBranch.BranchIndex.get(fourCols.month.branch.cell);
		int timeZiIdx = StemBranch.BranchIndex.get(fourCols.time.branch.cell);
		int delta = timeZiIdx - 10 ;
		int idx = (monthZiIdx + delta + 12) % 12;
		String zi = StemBranch.Branches[idx];
		for(int i=1; i<4; i++) {
			GanZi gz = fourCols.fourZhu[i];
			if(gz.branch.cell.equals(zi)) {
				gz.branch.addGoodGod(god);
			}
		}		
	}
	
	private static void findTaiSuiGods(FourColumns fourCols) {
		int yearZiIdx = StemBranch.BranchIndex.get(fourCols.year.branch.cell);
		fourCols.year.branch.addTaiSuiGod(taisuiGods1[0]);
		fourCols.year.branch.addTaiSuiGod(taisuiGods2[0]);
		fourCols.year.branch.addTaiSuiGod(taisuiGods3[0]);
		for(int i=1; i<fourCols.fourZhu.length; i++) {
			GanZi gz = fourCols.fourZhu[i];
			int ziIdx = StemBranch.BranchIndex.get(gz.branch.cell);
			int delta = ziIdx - yearZiIdx;
			int idx = (delta + 12) % 12;
			if(!taisuiGods1[idx].equals("")) {
				gz.branch.addTaiSuiGod(taisuiGods1[idx]);
			}
			if(!taisuiGods2[idx].equals("")) {
				gz.branch.addTaiSuiGod(taisuiGods2[idx]);
			}
			if(!taisuiGods3[idx].equals("")) {
				gz.branch.addTaiSuiGod(taisuiGods3[idx]);
			}
		}
	}
	
	
	public static void findGods(FourColumns fourCols, String zhu) {
		findQiQue(fourCols);
		findFangYin(fourCols);
		findFuYin(fourCols);
		findSuiDian(fourCols);
		findDouShao(fourCols);
		findTaiSuiGods(fourCols);
		
		if(zhu.equals(GodRule.ZhuNianRi)) {
			for(GodRule rule : rules) {
				rule.findGods(fourCols, GodRule.ZhuNian);
				rule.findGods(fourCols, GodRule.ZhuRi);
			}
			
		}else {
			String zu = zhu;
			if(StringUtility.isNumeric(zhu)) {
				int idx = ConvertUtility.getValueAsInt(zhu, 0);
				idx = idx >= Zhus.length ? 0 : idx;
				zu = Zhus[idx];
			}
			for(GodRule rule : rules) {
				rule.findGods(fourCols, zu);
			}
		}
	}

	public static void findGods(GanZi gz, GanZi keygz, int yearZiIdx) {
		for(GodRule rule : rules) {
			rule.findGod(gz, keygz);
		}
		
		int ziIdx = StemBranch.BranchIndex.get(gz.branch.cell);
		int delta = ziIdx - yearZiIdx;
		int idx = (delta + 12) % 12;
		if(!taisuiGods1[idx].equals("")) {
			gz.branch.addTaiSuiGod(taisuiGods1[idx]);
		}
		if(!taisuiGods2[idx].equals("")) {
			gz.branch.addTaiSuiGod(taisuiGods2[idx]);
		}
		if(!taisuiGods3[idx].equals("")) {
			gz.branch.addTaiSuiGod(taisuiGods3[idx]);
		}
	}
	
	
	public static Map<String, Object> findTaiSuiGods(String yearzi) {
		Map<String, Object> res = new HashMap<String, Object>();
		Map<String, String> god1Map = new HashMap<String, String>();
		Map<String, String> god2Map = new HashMap<String, String>();
		Map<String, String> god3Map = new HashMap<String, String>();
		int yearZiIdx = StemBranch.BranchIndex.get(yearzi);
		for(int i=0; i<12; i++) {
			String zi = StemBranch.Branches[i];
			int delta = i - yearZiIdx;
			int idx = (delta + 12) % 12;
			if(!taisuiGods1[idx].equals("")) {
				god1Map.put(taisuiGods1[idx], zi);
			}
			if(!taisuiGods2[idx].equals("")) {
				god2Map.put(taisuiGods2[idx], zi);
			}
			if(!taisuiGods3[idx].equals("")) {
				god3Map.put(taisuiGods3[idx], zi);
			}
		}
		
		res.put("taisui1", god1Map);
		res.put("taisui2", god2Map);
		res.put("taisui3", god3Map);
		return res;
	}
	
	public static Map<String, Object> findGods(String key, String[] names){
		Map<String, Object> res = new HashMap<String, Object>();
		for(String name : names) {
			GodRule rule = rulesMap.get(name);
			Set<String> set = rule.rule.get(key);
			res.put(name, set);
		}
		
		return res;
	}
	
	public static GuoLaoGods findGuoLaoGods(String gan, String zi) {
		GuoLaoGods guolao = new GuoLaoGods();
		for(GodRule rule : rules) {
			if(!rule.valueType.equals(GodRule.TypeZi)) {
				continue;
			}
			
			Set<String> set = null;
			if(rule.keyType.equals(GodRule.TypeZi)) {
				set = rule.rule.get(zi);
			}else if(rule.keyType.equals(GodRule.TypeGan)) {
				set = rule.rule.get(gan);
			}
			if(set != null && !isGuoLaoExclude(rule.name)) {
				if(set.size() == 1) {
					for(String valzi : set) {
						String name = rule.name;
						if(name.equals("果老文昌")) {
							name = "文昌";
						}else if(name.equals("干墓(水土同)")) {
							name = "干墓";
						}else if(name.equals("长生(水土同)")) {
							name = "长生";
						}
						if(rule.jixiong.equals(GodRule.JiXiongJi)) {
							guolao.addGoodGod(valzi, name);
						}else if(rule.jixiong.equals(GodRule.JiXiongZhong)) {
							guolao.addNeutralGod(valzi, name);
						}else if(rule.jixiong.equals(GodRule.JiXiongXiong)) {
							guolao.addBadGod(valzi, name);
						}
					}
				}				
			}
		}
		
		Map<String, Object> taisui = findTaiSuiGods(zi);
		Map<String, String> taisui1 = (Map<String, String>) taisui.get("taisui1");
		Map<String, String> taisui2 = (Map<String, String>) taisui.get("taisui2");
		Map<String, String> taisui3 = (Map<String, String>) taisui.get("taisui3");
		for(Map.Entry<String, String> entry : taisui1.entrySet()) {
			guolao.addTaiSuiGod(entry.getValue(), entry.getKey(), 0);
		}
		for(Map.Entry<String, String> entry : taisui2.entrySet()) {
			guolao.addTaiSuiGod(entry.getValue(), entry.getKey(), 1);
		}
		for(Map.Entry<String, String> entry : taisui3.entrySet()) {
			guolao.addTaiSuiGod(entry.getValue(), entry.getKey(), 2);
		}

		addGuoLaoKongWang(guolao, gan + zi);
		
		String god = "岁殿";
		int yearZiIdx = StemBranch.BranchIndex.get(zi);
		int yearGanIdx = StemBranch.StemIndex.get(gan);
		int idx = (yearZiIdx + yearGanIdx) % 12;
		String valzi = StemBranch.Branches[idx];
		guolao.addNeutralGod(valzi, god);
		
		return guolao;
	}
	
	public static void addDouShao(GuoLaoGods guolao, String monthZi, String timeZi) {
		String god = "斗杓";
		int monthZiIdx = StemBranch.BranchIndex.get(monthZi);
		int timeZiIdx = StemBranch.BranchIndex.get(timeZi);
		int delta = timeZiIdx - 10 ;
		int idx = (monthZiIdx + delta + 12) % 12;
		String zi = StemBranch.Branches[idx];
		guolao.addGoodGod(zi, god);
	}
	
	private static boolean isGuoLaoExclude(String name) {
		String[] texts = new String[] {"子平文昌"};	
		for(String txt : texts) {
			if(name.contains(txt)) {
				return true;
			}
		}
		return false;
	}
	
	private static void addGuoLaoKongWang(GuoLaoGods guolao, String ganzi) {
		Map<String, String> map = new HashMap<String, String>();
		map.put("甲子", "戌");
		map.put("丙寅", "戌");
		map.put("戊辰", "戌");
		map.put("庚午", "戌");
		map.put("壬申", "戌");
		
		map.put("乙丑", "亥");
		map.put("丁卯", "亥");
		map.put("己巳", "亥");
		map.put("辛未", "亥");
		map.put("癸酉", "亥");
		
		map.put("甲戌", "申");
		map.put("丙子", "申");
		map.put("戊寅", "申");
		map.put("庚辰", "申");
		map.put("壬午", "申");
		
		String zi = map.get(ganzi);
		if(zi == null) {
			return;
		}
		guolao.addBadGod(zi, "空亡");
	}
	
}
