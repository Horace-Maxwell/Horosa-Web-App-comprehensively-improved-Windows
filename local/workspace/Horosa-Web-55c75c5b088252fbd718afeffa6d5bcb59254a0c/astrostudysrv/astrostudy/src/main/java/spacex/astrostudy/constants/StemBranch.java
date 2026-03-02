package spacex.astrostudy.constants;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import boundless.io.FileUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class StemBranch {
	
	public static final String STEM_JIA = "甲";
	public static final String STEM_YI = "乙";
	public static final String STEM_BING = "丙";
	public static final String STEM_DING = "丁";
	public static final String STEM_WU = "戊";
	public static final String STEM_JI = "己";
	public static final String STEM_GENG = "庚";
	public static final String STEM_XIN = "辛";
	public static final String STEM_RENG = "壬";
	public static final String STEM_GUI = "癸";
	
	public static final String BRANCH_ZI = "子";
	public static final String BRANCH_CHOU = "丑";
	public static final String BRANCH_YIN = "寅";
	public static final String BRANCH_MAO = "卯";
	public static final String BRANCH_CEN = "辰";
	public static final String BRANCH_SI = "巳";
	public static final String BRANCH_WU = "午";
	public static final String BRANCH_WEI = "未";
	public static final String BRANCH_SHEN = "申";
	public static final String BRANCH_YOU = "酉";
	public static final String BRANCH_XU = "戌";
	public static final String BRANCH_HAI = "亥";
	
	public static final String[] Stems = new String[] {STEM_JIA, STEM_YI, STEM_BING, STEM_DING, STEM_WU, STEM_JI, STEM_GENG, STEM_XIN, STEM_RENG, STEM_GUI};
	public static final String[] Branches = new String[] {BRANCH_ZI, BRANCH_CHOU, BRANCH_YIN, BRANCH_MAO, BRANCH_CEN, BRANCH_SI, BRANCH_WU, BRANCH_WEI, BRANCH_SHEN, BRANCH_YOU, BRANCH_XU, BRANCH_HAI};
	
	public static final String[] StemsCong = new String[] {STEM_GENG, STEM_XIN, STEM_RENG, STEM_GUI, STEM_WU, STEM_JI, STEM_JIA, STEM_YI, STEM_BING, STEM_DING};
	public static final String[] BranchesCong = new String[] {BRANCH_WU, BRANCH_WEI, BRANCH_SHEN, BRANCH_YOU, BRANCH_XU, BRANCH_HAI, BRANCH_ZI, BRANCH_CHOU, BRANCH_YIN, BRANCH_MAO, BRANCH_CEN, BRANCH_SI};
	
	public static final String[] JiaZi = new String[] {
			STEM_JIA + BRANCH_ZI, STEM_YI + BRANCH_CHOU, STEM_BING + BRANCH_YIN, STEM_DING + BRANCH_MAO, STEM_WU + BRANCH_CEN, STEM_JI + BRANCH_SI, STEM_GENG + BRANCH_WU, STEM_XIN + BRANCH_WEI, STEM_RENG + BRANCH_SHEN, STEM_GUI + BRANCH_YOU,			
			STEM_JIA + BRANCH_XU, STEM_YI + BRANCH_HAI, STEM_BING + BRANCH_ZI, STEM_DING + BRANCH_CHOU, STEM_WU + BRANCH_YIN, STEM_JI + BRANCH_MAO, STEM_GENG + BRANCH_CEN, STEM_XIN + BRANCH_SI, STEM_RENG + BRANCH_WU, STEM_GUI + BRANCH_WEI,			
			STEM_JIA + BRANCH_SHEN, STEM_YI + BRANCH_YOU, STEM_BING + BRANCH_XU, STEM_DING + BRANCH_HAI, STEM_WU + BRANCH_ZI, STEM_JI + BRANCH_CHOU, STEM_GENG + BRANCH_YIN, STEM_XIN + BRANCH_MAO, STEM_RENG + BRANCH_CEN, STEM_GUI + BRANCH_SI,			
			STEM_JIA + BRANCH_WU, STEM_YI + BRANCH_WEI, STEM_BING + BRANCH_SHEN, STEM_DING + BRANCH_YOU, STEM_WU + BRANCH_XU, STEM_JI + BRANCH_HAI, STEM_GENG + BRANCH_ZI, STEM_XIN + BRANCH_CHOU, STEM_RENG + BRANCH_YIN, STEM_GUI + BRANCH_MAO,			
			STEM_JIA + BRANCH_CEN, STEM_YI + BRANCH_SI, STEM_BING + BRANCH_WU, STEM_DING + BRANCH_WEI, STEM_WU + BRANCH_SHEN, STEM_JI + BRANCH_YOU, STEM_GENG + BRANCH_XU, STEM_XIN + BRANCH_HAI, STEM_RENG + BRANCH_ZI, STEM_GUI + BRANCH_CHOU,			
			STEM_JIA + BRANCH_YIN, STEM_YI + BRANCH_MAO, STEM_BING + BRANCH_CEN, STEM_DING + BRANCH_SI, STEM_WU + BRANCH_WU, STEM_JI + BRANCH_WEI, STEM_GENG + BRANCH_SHEN, STEM_XIN + BRANCH_YOU, STEM_RENG + BRANCH_XU, STEM_GUI + BRANCH_HAI
	};
	
	public static final String[] JiaZiNaYing = new String[] {
			"海中金", "海中金", "炉中火", "炉中火", "大林木", "大林木", "路旁土", "路旁土", "剑锋金", "剑锋金",
			"山头火", "山头火", "涧下水", "涧下水", "城头土", "城头土", "白蜡金", "白蜡金", "杨柳木", "杨柳木",
			"井泉水", "井泉水", "屋上土", "屋上土", "霹雳火", "霹雳火", "松柏木", "松柏木", "长流水", "长流水",
			"砂中金", "砂中金", "山下火", "山下火", "平地木", "平地木", "壁上土", "壁上土", "金箔金", "金箔金",
			"覆灯火", "覆灯火", "天河水", "天河水", "大驿土", "大驿土", "钗钏金", "钗钏金", "桑柘木", "桑柘木",
			"大溪水", "大溪水", "砂中土", "砂中土", "天上火", "天上火", "石榴木", "石榴木", "大海水", "大海水"
	};
	
	public static final FiveElement[] JiaZiNaYingElement = new FiveElement[] {
			FiveElement.Metal, FiveElement.Metal, FiveElement.Fire, FiveElement.Fire, FiveElement.Wood, FiveElement.Wood, FiveElement.Earth, FiveElement.Earth, FiveElement.Metal, FiveElement.Metal,
			FiveElement.Fire, FiveElement.Fire, FiveElement.Water, FiveElement.Water, FiveElement.Earth, FiveElement.Earth, FiveElement.Metal, FiveElement.Metal, FiveElement.Wood, FiveElement.Wood,
			FiveElement.Water, FiveElement.Water, FiveElement.Earth, FiveElement.Earth, FiveElement.Fire, FiveElement.Fire, FiveElement.Wood, FiveElement.Wood, FiveElement.Water, FiveElement.Water,
			FiveElement.Metal, FiveElement.Metal, FiveElement.Fire, FiveElement.Fire, FiveElement.Wood, FiveElement.Wood, FiveElement.Earth, FiveElement.Earth, FiveElement.Metal, FiveElement.Metal,
			FiveElement.Fire, FiveElement.Fire, FiveElement.Water, FiveElement.Water, FiveElement.Earth, FiveElement.Earth, FiveElement.Metal, FiveElement.Metal, FiveElement.Wood, FiveElement.Wood,
			FiveElement.Water, FiveElement.Water, FiveElement.Earth, FiveElement.Earth, FiveElement.Fire, FiveElement.Fire, FiveElement.Wood, FiveElement.Wood, FiveElement.Water, FiveElement.Water
	};
	
	public static final String[] XunEmptyStr = new String[] {
		String.format("%s%s", BRANCH_XU, BRANCH_HAI),
		String.format("%s%s", BRANCH_SHEN, BRANCH_YOU),
		String.format("%s%s", BRANCH_WU, BRANCH_WEI),
		String.format("%s%s", BRANCH_CEN, BRANCH_SI),
		String.format("%s%s", BRANCH_YIN, BRANCH_MAO),
		String.format("%s%s", BRANCH_ZI, BRANCH_CHOU)
	};
	
	public static final String[] Phase12 = new String[] {
			"长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养"
	};
		
	
	public static final String[] StemInBranch = new String[] {
			String.format("%s", STEM_GUI),
			String.format("%s,%s,%s", STEM_JI, STEM_XIN, STEM_GUI),
			String.format("%s,%s,%s", STEM_JIA, STEM_BING, STEM_WU),
			String.format("%s", STEM_YI),
			String.format("%s,%s,%s", STEM_WU, STEM_GUI, STEM_YI),
			String.format("%s,%s,%s", STEM_BING, STEM_GENG, STEM_WU),
			String.format("%s,%s", STEM_DING, STEM_JI),
			String.format("%s,%s,%s", STEM_JI, STEM_YI, STEM_DING),
			String.format("%s,%s,%s", STEM_GENG, STEM_RENG, STEM_WU),
			String.format("%s", STEM_XIN),
			String.format("%s,%s,%s", STEM_WU, STEM_DING, STEM_XIN),
			String.format("%s,%s", STEM_RENG, STEM_JIA),
	};
	
	public static final FiveElement[] StemFiveElem = new FiveElement[] {
			FiveElement.Wood, FiveElement.Wood, 
			FiveElement.Fire, FiveElement.Fire, 
			FiveElement.Earth, FiveElement.Earth, 
			FiveElement.Metal, FiveElement.Metal, 
			FiveElement.Water, FiveElement.Water
	};
	
	public static final FiveElement[] BranchFiveElem = new FiveElement[] {
			FiveElement.Water, FiveElement.Earth, 
			FiveElement.Wood, FiveElement.Wood, 
			FiveElement.Earth, FiveElement.Fire, 
			FiveElement.Fire, FiveElement.Earth, 
			FiveElement.Metal, FiveElement.Metal, 
			FiveElement.Earth, FiveElement.Water
	};
	
	public static final Map<String, Integer> StemIndex = new HashMap<String, Integer>();
	public static final Map<String, Integer> BranchIndex = new HashMap<String, Integer>();
	public static final Map<String, Integer> JiaZiIndex = new HashMap<String, Integer>();
	public static final Map<String, Integer> ZiMonth = new HashMap<String, Integer>();
	public static final Map<String, Integer> SigSunMonth = new HashMap<String, Integer>();
	public static final Map<String, Integer> SigSunMonthInv = new HashMap<String, Integer>();
	
	public static final Map<String, Set<String>> XunEmpty = new HashMap<String, Set<String>>();
	public static final Map<String, String> NaYingMap = new HashMap<String, String>();
	public static final Map<String, FiveElement> NaYingElemMap = new HashMap<String, FiveElement>();
	
	public static final Map<String, String[]> BranchStemsMap = new HashMap<String, String[]>();
	public static final Map<String, FiveElement> StemFiveElemMap = new HashMap<String, FiveElement>();
	public static final Map<String, FiveElement> BranchFiveElemMap = new HashMap<String, FiveElement>();
	public static final Map<String, Polarity> StemPolarityMap = new HashMap<String, Polarity>();
	public static final Map<String, Polarity> BranchPolarityMap = new HashMap<String, Polarity>();
	
	public static final Map<String, String> GanJiZi = new HashMap<String, String>();
	public static final Map<String, String[]> ZiHanGan = new HashMap<String, String[]>();
	
	public static final Map<String, String> GanPos = new HashMap<String, String>();
	public static final Map<String, String> GanShenShou = new HashMap<String, String>();
	public static final Map<String, String> ZiPos = new HashMap<String, String>();
	public static final Map<String, String> ZiShenShou = new HashMap<String, String>();
	
	public static final Map<String, String> SignZi = new HashMap<String, String>();
	public static final Map<String, Integer> SignDeg = new HashMap<String, Integer>();
	public static final List<String> SignList = new ArrayList<String>();
	public static final List<String> Su27 = new ArrayList<String>();

	static {
		for(int i=0; i<Stems.length; i++) {
			StemIndex.put(Stems[i], i);
			StemFiveElemMap.put(Stems[i], StemFiveElem[i]);
			Polarity polar = i % 2 == 0 ? Polarity.Positive : Polarity.Negative;
			StemPolarityMap.put(Stems[i], polar);
		}
		
		for(int i=0; i<Branches.length; i++) {
			BranchIndex.put(Branches[i], i);
			String stemstr = StemInBranch[i];
			String[] stems = StringUtility.splitString(stemstr, ',');
			BranchStemsMap.put(Branches[i], stems);
			BranchFiveElemMap.put(Branches[i], BranchFiveElem[i]);
			Polarity polar = i % 2 == 0 ? Polarity.Positive : Polarity.Negative;
			BranchPolarityMap.put(Branches[i], polar);
		}
		
		Set<String> xunempty = null;
		for(int i=0; i<JiaZi.length; i++) {
			JiaZiIndex.put(JiaZi[i], i);
			int xun = i / 10;
			int ord = i % 10;
			if(ord == 0) {
				String str = XunEmptyStr[xun];
				xunempty = new HashSet<String>();
				xunempty.add(str.substring(0, 1));
				xunempty.add(str.substring(1));
			}
			XunEmpty.put(JiaZi[i], xunempty);
			NaYingMap.put(JiaZi[i], JiaZiNaYing[i]);
			NaYingElemMap.put(JiaZi[i], JiaZiNaYingElement[i]);
		}
		
		ZiMonth.put(BRANCH_ZI, 11);
		ZiMonth.put(BRANCH_CHOU, 12);
		ZiMonth.put(BRANCH_YIN, 1);
		ZiMonth.put(BRANCH_MAO, 2);
		ZiMonth.put(BRANCH_CEN, 3);
		ZiMonth.put(BRANCH_SI, 4);
		ZiMonth.put(BRANCH_WU, 5);
		ZiMonth.put(BRANCH_WEI, 6);
		ZiMonth.put(BRANCH_SHEN, 7);
		ZiMonth.put(BRANCH_YOU, 8);
		ZiMonth.put(BRANCH_XU, 9);
		ZiMonth.put(BRANCH_HAI, 10);
		
		SigSunMonth.put(BRANCH_ZI, 1);
		SigSunMonth.put(BRANCH_CHOU, 12);
		SigSunMonth.put(BRANCH_YIN, 11);
		SigSunMonth.put(BRANCH_MAO, 10);
		SigSunMonth.put(BRANCH_CEN, 9);
		SigSunMonth.put(BRANCH_SI, 8);
		SigSunMonth.put(BRANCH_WU, 7);
		SigSunMonth.put(BRANCH_WEI, 6);
		SigSunMonth.put(BRANCH_SHEN, 5);
		SigSunMonth.put(BRANCH_YOU, 4);
		SigSunMonth.put(BRANCH_XU, 3);
		SigSunMonth.put(BRANCH_HAI, 2);
				
		SigSunMonthInv.put(BRANCH_ZI, 1);
		SigSunMonthInv.put(BRANCH_CHOU, 2);
		SigSunMonthInv.put(BRANCH_YIN, 3);
		SigSunMonthInv.put(BRANCH_MAO, 4);
		SigSunMonthInv.put(BRANCH_CEN, 5);
		SigSunMonthInv.put(BRANCH_SI, 6);
		SigSunMonthInv.put(BRANCH_WU, 7);
		SigSunMonthInv.put(BRANCH_WEI, 8);
		SigSunMonthInv.put(BRANCH_SHEN, 9);
		SigSunMonthInv.put(BRANCH_YOU, 10);
		SigSunMonthInv.put(BRANCH_XU, 11);
		SigSunMonthInv.put(BRANCH_HAI, 12);
		
		String ganjizi = FileUtility.getStringFromClassPath("spacex/astrostudy/constants/ganjizi.json");
		Map<String, Object> json = JsonUtility.toDictionary(ganjizi);
		Map<String, Object> ganji = (Map<String, Object>) json.get("ganjizi");
		Map<String, Object> zihangan = (Map<String, Object>) json.get("zihangan");
		Map<String, String> sigzi = (Map<String, String>) json.get("signzi");
		Map<String, Integer> sigdeg = (Map<String, Integer>) json.get("signDeg");
		List<String> siglist = (List<String>) json.get("signList");
		List<String> su27 = (List<String>) json.get("su27");
		SignZi.putAll(sigzi);
		SignDeg.putAll(sigdeg);
		SignList.addAll(siglist);
		Su27.addAll(su27);
		for(String gan : Stems) {
			GanJiZi.put(gan, (String)ganji.get(gan));
		}
		for(String zi : Branches) {
			List<String> list = (List<String>)zihangan.get(zi);
			String[] ary = new String[list.size()];
			list.toArray(ary);
			ZiHanGan.put(zi, ary);
		}
		
		String ganzipos = FileUtility.getStringFromClassPath("spacex/astrostudy/constants/ganzipos.json");
		json = JsonUtility.toDictionary(ganzipos);
		Map<String, Object> ganpos = (Map<String, Object>) json.get("gan");
		Map<String, Object> zipos = (Map<String, Object>) json.get("zi");
		for(String gan : Stems) {
			List<String> list = (List<String>)ganpos.get(gan);
			GanPos.put(gan, list.get(0));
			GanShenShou.put(gan, list.get(1));
		}
		for(String zi : Branches) {
			List<String> list = (List<String>)zipos.get(zi);
			ZiPos.put(zi, list.get(0));
			ZiShenShou.put(zi, list.get(1));
		}
	}
	
	
	public static String getNaYing(String gangzhi) {
		return NaYingMap.get(gangzhi);
	}
	
	public static FiveElement getNaYingElement(String gangzhi) {
		return NaYingElemMap.get(gangzhi);
	}
	
	public static String getXunEmpty(String gangzhi) {
		int idx = JiaZiIndex.get(gangzhi);
		int xun = idx / 10;
		return XunEmptyStr[xun];
	}
	
	public static Set<String> getXunEmptySet(String gangzhi) {
		return XunEmpty.get(gangzhi);
	}
	
	public static String[] getStems(String branch) {
		return BranchStemsMap.get(branch);
	}
	
	public static FiveElement getStemElem(String stem) {
		return StemFiveElemMap.get(stem);
	}
	
	public static FiveElement getBranchElem(String branch) {
		return BranchFiveElemMap.get(branch);
	}
	
	public static Polarity getStemPolar(String stem) {
		return StemPolarityMap.get(stem);
	}
	
	public static Polarity getBranchPolar(String stem) {
		return BranchPolarityMap.get(stem);
	}
	
	public static int deltaBranch(String zi1, String zi2) {
		int n1 = BranchIndex.get(zi1);
		int n2 = BranchIndex.get(zi2);
		if(n2 >= n1) {
			return n2 - n1;
		}
		
		return 12 - n1 + n2;
	}
	
	public static int deltaStem(String gan1, String gan2) {
		int n1 = StemIndex.get(gan1);
		int n2 = StemIndex.get(gan2);
		if(n2 >= n1) {
			return n2 - n1;
		}
		
		return 12 - n1 + n2;
	}
	
}
