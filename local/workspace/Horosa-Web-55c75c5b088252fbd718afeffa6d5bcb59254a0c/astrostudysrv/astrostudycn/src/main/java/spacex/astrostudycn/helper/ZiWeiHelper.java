package spacex.astrostudycn.helper;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import boundless.io.FileUtility;
import boundless.utility.DateTimeUtility;
import boundless.utility.JsonUtility;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.helper.BaZiHelper;
import spacex.astrostudy.helper.JdnHelper;
import spacex.astrostudy.helper.NongliHelper;
import spacex.astrostudy.helper.JdnHelper.RealDate;
import spacex.astrostudy.model.NongLi;
import spacex.astrostudy.model.RealSunTimeOffset;
import spacex.astrostudycn.constants.BaZiGender;
import spacex.astrostudycn.model.ZiWeiStar;

public class ZiWeiHelper {
	private static Map<String, String> LifeHouseStart = new HashMap<String, String>();
	private static Map<String, Integer> NongliMonth = new HashMap<String, Integer>();
	
	public final static Map<String, Integer> FiveElementNum = new HashMap<String, Integer>();
	public final static Map<Integer, String> WuxingJuText = new HashMap<Integer, String>();
	public final static String[] Houses = new String[12];
	
	public final static Map<String, String> HouseGanStart = new HashMap<String, String>();
	
	private static Map<String, Map<String, String>> StarSihua = new HashMap<String, Map<String, String>>();
	private static Map<String, Map<String, Set<String>>> StarSihuaGan = new HashMap<String, Map<String, Set<String>>>();
	private static Map<String, Map<String, String>> StarLight = new HashMap<String, Map<String, String>>();

	private static Map<String, Map<String, String>> DouJun = new HashMap<String, Map<String, String>>();
	
	public static Map<String, Integer> NorthStarsMainStep = new HashMap<String, Integer>();
	public static Map<String, Integer> SouthStarsMainStep = new HashMap<String, Integer>();
	
	public final static Map<String, Map<String, Object>> StarsYearGan = new HashMap<String, Map<String, Object>>();
	public final static Map<String, Map<String, Object>> StarsYearZi = new HashMap<String, Map<String, Object>>();
	public final static Map<String, Map<String, Object>> StarsMonth = new HashMap<String, Map<String, Object>>();
	public final static Map<String, Map<String, Object>> StarsTimeZi = new HashMap<String, Map<String, Object>>();
	public final static Map<String, Map<String, Object>> StarsHuoLin = new HashMap<String, Map<String, Object>>();
	public final static Map<String, Map<String, String>> StarsJiang = new HashMap<String, Map<String, String>>();
	
	public final static Map<String, String> StarsLifeMaster = new HashMap<String, String>();
	public final static Map<String, String> StarsBodyMaster = new HashMap<String, String>();

	private final static Map<String, String> XiaoXian = new HashMap<String, String>();

	public final static String[] StarsBosi = new String[12];
	public final static String[] StarsTaiSui = new String[12];
	public final static String[] ChangSheng12 = new String[12];
	
	public final static String[] SiHua = new String[4];

	
	static {
		LifeHouseStart.put("正月", StemBranch.BRANCH_YIN);
		LifeHouseStart.put("二月", StemBranch.BRANCH_MAO);
		LifeHouseStart.put("三月", StemBranch.BRANCH_CEN);
		LifeHouseStart.put("四月", StemBranch.BRANCH_SI);
		LifeHouseStart.put("五月", StemBranch.BRANCH_WU);
		LifeHouseStart.put("六月", StemBranch.BRANCH_WEI);
		LifeHouseStart.put("七月", StemBranch.BRANCH_SHEN);
		LifeHouseStart.put("八月", StemBranch.BRANCH_YOU);
		LifeHouseStart.put("九月", StemBranch.BRANCH_XU);
		LifeHouseStart.put("十月", StemBranch.BRANCH_HAI);
		LifeHouseStart.put("冬月", StemBranch.BRANCH_ZI);
		LifeHouseStart.put("腊月", StemBranch.BRANCH_CHOU);
		
		NongliMonth.put("正月", 1);
		NongliMonth.put("二月", 2);
		NongliMonth.put("三月", 3);
		NongliMonth.put("四月", 4);
		NongliMonth.put("五月", 5);
		NongliMonth.put("六月", 6);
		NongliMonth.put("七月", 7);
		NongliMonth.put("八月", 8);
		NongliMonth.put("九月", 9);
		NongliMonth.put("十月", 10);
		NongliMonth.put("冬月", 11);
		NongliMonth.put("腊月", 12);
		
		FiveElementNum.put("水", 2);
		FiveElementNum.put("木", 3);
		FiveElementNum.put("金", 4);
		FiveElementNum.put("土", 5);
		FiveElementNum.put("火", 6);
		
		WuxingJuText.put(2, "水二局");
		WuxingJuText.put(3, "木三局");
		WuxingJuText.put(4, "金四局");
		WuxingJuText.put(5, "土五局");
		WuxingJuText.put(6, "火六局");
		
		HouseGanStart.put(StemBranch.STEM_JIA, StemBranch.STEM_BING);
		HouseGanStart.put(StemBranch.STEM_JI, StemBranch.STEM_BING);
		HouseGanStart.put(StemBranch.STEM_YI, StemBranch.STEM_WU);
		HouseGanStart.put(StemBranch.STEM_GENG, StemBranch.STEM_WU);
		HouseGanStart.put(StemBranch.STEM_BING, StemBranch.STEM_GENG);
		HouseGanStart.put(StemBranch.STEM_XIN, StemBranch.STEM_GENG);
		HouseGanStart.put(StemBranch.STEM_DING, StemBranch.STEM_RENG);
		HouseGanStart.put(StemBranch.STEM_RENG, StemBranch.STEM_RENG);
		HouseGanStart.put(StemBranch.STEM_WU, StemBranch.STEM_JIA);
		HouseGanStart.put(StemBranch.STEM_GUI, StemBranch.STEM_JIA);
		
		initSihua();
		initStarlight();
		initStarsMain();
		initStarsYearGan();
		initStarsYearZi();
		initStarsMonth();
		initStarsTimeZi();
		initStarsHuoLin();
		initStarsSmallStars();
		initStarsJiang();
		initStarsMaster();
		initDouJun();
		initXiaoXian();
	}
	
	private static void initSihua() {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/ziweisihua.json");
		Map<String, Object> sihuamap = JsonUtility.toDictionary(json);
		Map<String, Object> map = (Map<String, Object>) sihuamap.get("gan");
		List<String> sihualist = (List<String>)sihuamap.get("hua");
		sihualist.toArray(SiHua);
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			String gan = entry.getKey();
			List<String> list = (List<String>) entry.getValue();
			String[] stars = new String[list.size()];
			list.toArray(stars);
			Map<String, String> sihua = new HashMap<String, String>();
			sihua.put(stars[0], SiHua[0]);
			sihua.put(stars[1], SiHua[1]);
			sihua.put(stars[2], SiHua[2]);
			sihua.put(stars[3], SiHua[3]);
			StarSihua.put(gan, sihua);
			setupSihuaGan(gan, stars, SiHua);
		}
	}
	
	private static void setupSihuaGan(String gan, String[] stars, String[] huaary) {
		for(int i=0; i<stars.length; i++) {
			String star = stars[i];
			Map<String, Set<String>> sihuagan = (Map<String, Set<String>>) StarSihuaGan.get(star);
			if(sihuagan == null) {
				sihuagan = new HashMap<String, Set<String>>();
				StarSihuaGan.put(star, sihuagan);
			}
			String hua = huaary[i];
			Set<String> set = (Set<String>) sihuagan.get(hua);
			if(set == null) {
				set = new HashSet<String>();
				sihuagan.put(hua, set);
			}
			set.add(gan);
		}
	}
	
	private static void initStarlight() {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/ziweistarlight.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			Map<String, String> light = (Map<String, String>) entry.getValue();
			StarLight.put(entry.getKey(), light);
		}
	}
	
	private static void initStarsMain() {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/ziweistarsmain.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		Map<String, Object> north = (Map<String, Object>) map.get("north");
		for(Map.Entry<String, Object> entry : north.entrySet()) {
			NorthStarsMainStep.put(entry.getKey(), (int)entry.getValue());
		}		
		Map<String, Object> south = (Map<String, Object>) map.get("south");
		for(Map.Entry<String, Object> entry : south.entrySet()) {
			SouthStarsMainStep.put(entry.getKey(), (int)entry.getValue());
		}		
	}
	
	private static void initStarsYearGan() {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/ziweiyeargan.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			Map<String, Object> star = (Map<String, Object>) entry.getValue();
			StarsYearGan.put(entry.getKey(), star);
		}
	}
	
	private static void initStarsYearZi() {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/ziweiyearzi.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			Map<String, Object> star = (Map<String, Object>) entry.getValue();
			StarsYearZi.put(entry.getKey(), star);
		}
	}
	
	private static void initStarsMonth() {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/ziweimonth.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			Map<String, Object> star = (Map<String, Object>) entry.getValue();
			StarsMonth.put(entry.getKey(), star);
		}
	}
	
	private static void initStarsTimeZi() {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/ziweitimezi.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			Map<String, Object> star = (Map<String, Object>) entry.getValue();
			StarsTimeZi.put(entry.getKey(), star);
		}
	}
	
	private static void initStarsHuoLin() {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/ziweihuolin.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			String key = entry.getKey();
			String y1 = key.charAt(0) + "";
			String y2 = key.charAt(1) + "";
			String y3 = key.charAt(2) + "";
			
			Map<String, Object> star = (Map<String, Object>) entry.getValue();
			StarsHuoLin.put(y1, star);
			StarsHuoLin.put(y2, star);
			StarsHuoLin.put(y3, star);
		}
	}
	
	private static void initStarsSmallStars() {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/ziweismallstars.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		
		List<String> houses = (List<String>) map.get("houses");
		List<String> changsheng = (List<String>) map.get("changsheng");
		List<String> bosi = (List<String>) map.get("bosi");
		List<String> taisui = (List<String>) map.get("taisui");
		bosi.toArray(StarsBosi);
		taisui.toArray(StarsTaiSui);
		changsheng.toArray(ChangSheng12);
		houses.toArray(Houses);
	}

	private static void initStarsJiang() {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/ziweijiang.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			String key = entry.getKey();
			Map<String, String> val = (Map<String, String>) entry.getValue();
			String y1 = key.charAt(0) + "";
			String y2 = key.charAt(1) + "";
			String y3 = key.charAt(2) + "";
			StarsJiang.put(y1, val);
			StarsJiang.put(y2, val);
			StarsJiang.put(y3, val);
		}
	}
	
	private static void initStarsMaster() {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/ziweizu.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		Map<String, String> life = (Map<String, String>) map.get("life");
		Map<String, String> body = (Map<String, String>) map.get("body");
		StarsLifeMaster.putAll(life);
		StarsBodyMaster.putAll(body);
	}
	
	private static void initDouJun() {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/ziweidou.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			String month = entry.getKey();
			Map<String, String> dou = (Map<String, String>) entry.getValue();
			DouJun.put(month, dou);
		}
	}

	private static void initXiaoXian() {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/ziweixiaoxian.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			String key = entry.getKey();
			String val = (String) entry.getValue();
			String y1 = key.charAt(0) + "";
			String y2 = key.charAt(1) + "";
			String y3 = key.charAt(2) + "";
			XiaoXian.put(y1, val);
			XiaoXian.put(y2, val);
			XiaoXian.put(y3, val);
		}
		
	}
		
	public static void setupSihua(String yeargan, ZiWeiStar star, Map<String, Map<String, String>> mySihua) {
		Map<String, String> map = null;
		if(mySihua != null) {
			map = mySihua.get(yeargan);
		}
		if(map == null) {
			map = StarSihua.get(yeargan);
		}
		String hua = map.get(star.name);
		star.sihua = hua;
	}
	
	public static String getStarLight(String star, String zi) {
		Map<String, String> map = StarLight.get(star);
		if(map == null) {
			return null;
		}
		return map.get(zi);
	}
	
	public static Map<String, Set<String>> getStarSihuaGan(String star, Map<String, Map<String, Set<String>>> mySihuaGan){
		Map<String, Set<String>> res = null;
		if(mySihuaGan != null) {
			res = mySihuaGan.get(star);
		}
		if(res == null) {
			res = StarSihuaGan.get(star);
		}
		return res;
	}
	
	public static Map<String, Map<String, String>> cloneSihua(){
		Map<String, Map<String, String>> res = new HashMap<String, Map<String, String>>();
		for(Map.Entry<String, Map<String, String>> entry : StarSihua.entrySet()) {
			Map<String, String> sihua = new HashMap<String, String>();
			sihua.putAll(entry.getValue());
			res.put(entry.getKey(), sihua);
		}
		return res;
	}
	
	public static String getDouJun(String month, String timezi) {
		Map<String, String> map = DouJun.get(month);
		String zi = map.get(timezi);
		return zi;
	}
	
	public static int getSmallDirectioinHouse(int xiaoxianAge, String yearZi, BaZiGender gender) {
		int idx = xiaoxianAge % 12;
		String zi = XiaoXian.get(yearZi);
		int startidx = StemBranch.BranchIndex.get(zi);
		if(gender == BaZiGender.Male) {
			idx = (idx + startidx) % 12;
		}else {
			idx = (idx - startidx + 12) % 12;
		}
		return idx;
	}
}
