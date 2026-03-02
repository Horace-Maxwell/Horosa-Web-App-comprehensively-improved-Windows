package spacex.astrostudycn.helper;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import boundless.io.FileUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.model.FourColumns;

public class LiuRengHelper {
	
	private static final class DataCounter{
		public int cnt;
		public String[] data;
		
		public DataCounter() {}
		public DataCounter(int cnt, String[] data) {
			this.cnt = cnt;
			this.data = data;
		}
	}
	
	private static final String[] MaleRunYear = new String[] {
		"丙寅", "丁卯", "戊辰", "己巳", "庚午", "辛未", "壬申", "癸酉", "甲戌", "乙亥",
		"丙子", "丁丑", "戊寅", "己卯", "庚辰", "辛巳", "壬午", "癸未", "甲申", "乙酉",
		"丙戌", "丁亥", "戊子", "己丑", "庚寅", "辛卯", "壬辰", "癸巳", "甲午", "乙未",
		"丙申", "丁酉", "戊戌", "己亥", "庚子", "辛丑", "壬寅", "癸卯", "甲辰", "乙巳",
		"丙午", "丁未", "戊申", "己酉", "庚戌", "辛亥", "壬子", "癸丑", "甲寅", "乙卯",
		"丙辰", "丁巳", "戊午", "己未", "庚申", "辛酉", "壬戌", "癸亥", "甲子", "乙丑"
	};

	private static final String[] FemaleRunYear = new String[] {
		"壬申", "辛未", "庚午", "己巳", "戊辰", "丁卯", "丙寅", "乙丑", "甲子", "癸亥",
		"壬戌", "辛酉", "庚申", "己未", "戊午", "丁巳", "丙辰", "乙卯", "甲寅", "癸丑",
		"壬子", "辛亥", "庚戌", "己酉", "戊申", "丁未", "丙午", "乙巳", "甲辰", "癸卯",
		"壬寅", "辛丑", "庚子", "己亥", "戊戌", "丁酉", "丙申", "乙未", "甲午", "癸巳",
		"壬辰", "辛卯", "庚寅", "己丑", "戊子", "丁亥", "丙戌", "乙酉", "甲申", "癸未",
		"壬午", "辛巳", "庚辰", "己卯", "戊寅", "丁丑", "丙子", "乙亥", "甲戌", "癸酉",
	};
	
	private static final String[] TianJiang = new String[] {"贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙", "天空", "白虎", "太常", "玄武", "太阴", "天后"};
	private static final Set<String> ZiMeng = new HashSet<String>();
	private static final Set<String> ZiZong = new HashSet<String>();
	private static final Set<String> ZiJi = new HashSet<String>();
	private static final Set<String> YangZi = new HashSet<String>();
	private static final Set<String> YingZi = new HashSet<String>();
	private static final Set<String> YangGan = new HashSet<String>();
	private static final Set<String> YingGan = new HashSet<String>();
	private static final Set<String> WinnerZiList = new HashSet<String>();
	private static final Set<String> SummerZiList = new HashSet<String>();

	private static Map<String, Object> LiuRengDict = new HashMap<String, Object>();
	private static Map<String, Set<String>> GanZiRestrain = new HashMap<String, Set<String>>();
	private static Map<String, Set<String>> GanZiBrother = new HashMap<String, Set<String>>();
	private static Map<String, Set<String>> GanZiAccrue = new HashMap<String, Set<String>>();
	private static Map<String, Set<String>> ZiSangHe = new HashMap<String, Set<String>>();
	
	private static Map<String, Object> DayGui = null;
	private static Map<String, Object> NightGui = null;
	private static Map<String, Object> ZiXing = null;
	private static Map<String, Object> ZiCong = null;
	private static Map<String, Object> ZiYiMa = null;
	private static Map<String, Object> ZiHe = null;
	private static Map<String, Object> GanHe = null;
	private static Map<String, Object> ZiLiuQin = null;
	private static Map<String, Object> GanZiWuXing = null;
	private static Map<String, Object> GanJiZi = null;
	private static Map<String, Object> ZiHanGan = null;

	static {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/liureng.json");
		LiuRengDict = JsonUtility.toDictionary(json);
		
		DayGui = (Map<String, Object>) LiuRengDict.get("DayGui");
		NightGui = (Map<String, Object>) LiuRengDict.get("NightGui");
		ZiXing = (Map<String, Object>) LiuRengDict.get("ZiXing");
		ZiCong = (Map<String, Object>) LiuRengDict.get("ZiCong");
		ZiYiMa = (Map<String, Object>) LiuRengDict.get("ZiYiMa");
		ZiHe = (Map<String, Object>) LiuRengDict.get("ZiHe");
		GanHe = (Map<String, Object>) LiuRengDict.get("GanHe");
		ZiLiuQin = (Map<String, Object>) LiuRengDict.get("ZiLiuQin");
		GanZiWuXing = (Map<String, Object>) LiuRengDict.get("GanZiWuXing");
		GanJiZi = (Map<String, Object>) LiuRengDict.get("GanJiZi");
		ZiHanGan = (Map<String, Object>) LiuRengDict.get("ZiHanGan");
		
		List<String> ary = (List<String>) LiuRengDict.get("YangZi");
		YangZi.addAll(ary);
		ary = (List<String>) LiuRengDict.get("YingZi");
		YingZi.addAll(ary);
		ary = (List<String>) LiuRengDict.get("YangGan");
		YangGan.addAll(ary);
		ary = (List<String>) LiuRengDict.get("YingGan");
		YingGan.addAll(ary);
		ary = (List<String>) LiuRengDict.get("WinnerZiList");
		WinnerZiList.addAll(ary);
		ary = (List<String>) LiuRengDict.get("SummerZiList");
		SummerZiList.addAll(ary);
		ary = (List<String>) LiuRengDict.get("ZiMeng");
		ZiMeng.addAll(ary);
		ary = (List<String>) LiuRengDict.get("ZiJi");
		ZiJi.addAll(ary);
		ary = (List<String>) LiuRengDict.get("ZiZong");
		ZiZong.addAll(ary);
		
		
		Map<String, Object> map = (Map<String, Object>) LiuRengDict.get("GanZiRestrain");
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			Set<String> set = new HashSet<String>();
			List<String> list = (List<String>) entry.getValue();
			set.addAll(list);
			GanZiRestrain.put(entry.getKey(), set);
		}
		map = (Map<String, Object>) LiuRengDict.get("GanZiBrother");
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			Set<String> set = new HashSet<String>();
			List<String> list = (List<String>) entry.getValue();
			set.addAll(list);
			GanZiBrother.put(entry.getKey(), set);
		}
		map = (Map<String, Object>) LiuRengDict.get("GanZiAccrue");
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			Set<String> set = new HashSet<String>();
			List<String> list = (List<String>) entry.getValue();
			set.addAll(list);
			GanZiAccrue.put(entry.getKey(), set);
		}
		map = (Map<String, Object>) LiuRengDict.get("ZiSangHe");
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			Set<String> set = new HashSet<String>();
			List<String> list = (List<String>) entry.getValue();
			set.addAll(list);
			ZiSangHe.put(entry.getKey(), set);
		}
	}
	
	public static String getLiuQin(String zi, String gan) {
		Map<String, Object> map = (Map<String, Object>) ZiLiuQin.get(zi);
		return (String) map.get("gan");
	}

	public static String getGuiZi(String gan, boolean isDiurnal){
		String guizi = null;
		if(isDiurnal){
			guizi = (String)DayGui.get(gan);
		}else{
			guizi = (String)NightGui.get(gan);
		}
		return guizi;
	}

	public static boolean isRestrain(String gz1, String gz2){
		return GanZiRestrain.get(gz1).contains(gz2);
	}

	public static boolean isBrother(String gz1, String gz2){
		return GanZiBrother.get(gz1).contains(gz2);
	}

	public static boolean isAccrue(String gz1, String gz2){
		return GanZiAccrue.get(gz1).contains(gz2);
	}

	public static DataCounter sameYingYang(String gan, String[] ziAry){
		int cnt = 0;
		String cuang0 = null;
		List<String> stack = new ArrayList<String>();
		if(YangGan.contains(gan)){
			for(int i=0; i<ziAry.length; i++){
				if(YangZi.contains(ziAry[i])){
					cuang0 = ziAry[i];
					cnt = cnt + 1;
					stack.add(ziAry[i]);
				}
			}
			if(cnt == 1){
				return new DataCounter(1, new String[] {cuang0});
			}else if(cnt > 1){
				String[] ary = new String[stack.size()];
				stack.toArray(ary);
				return new DataCounter(cnt, ary);
			}else{
				return new DataCounter(0, ziAry);
			}
		}else{
			for(int i=0; i<ziAry.length; i++){
				if(YingZi.contains(ziAry[i])){
					cuang0 = ziAry[i];
					cnt = cnt + 1;
					stack.add(ziAry[i]);
				}
			}
			if(cnt == 1){
				return new DataCounter(1, new String[] {cuang0});
			}else if(cnt > 1){
				String[] ary = new String[stack.size()];
				stack.toArray(ary);
				return new DataCounter(cnt, ary);
			}else{
				return new DataCounter(0, ziAry);
			}
		}
	}
	
	public static String[] getXun(String gan, String zi){
		int jiaziIdx = StemBranch.JiaZiIndex.get(gan+zi);
		int firstidx = jiaziIdx / 10 * 10;
		int lastidx = firstidx + 10;
		String[] xun = new String[10];
		for(int i=firstidx, idx=0; i<lastidx; i++, idx++) {
			xun[idx] = StemBranch.JiaZi[i].substring(1);
		}
		return xun;
	}
	
	
	public static Map<String, Object> runYear(FourColumns fourcols, boolean male, String yearGanZi) {
		String birthYear = fourcols.year.ganzi;
		int birthIdx = StemBranch.JiaZiIndex.get(birthYear);
		int guaIdx = StemBranch.JiaZiIndex.get(yearGanZi);
		int idx = (guaIdx - birthIdx + 60) % 60;
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("age", idx);
		if(male) {
			map.put("year", MaleRunYear[idx]) ;
		}else {
			map.put("year", FemaleRunYear[idx]) ;
		}
		return map;
	}
	
	public static Map<String, Object> calcKeCuang(FourColumns fourcols, String yue, boolean isDiurnal) {
		Map<String, Object> res = new HashMap<String, Object>();
		String[] downZi = new String[12];
		System.arraycopy(StemBranch.Branches, 0, downZi, 0, 12);
		res.put("downZi", downZi);
		
		genYueJiangIndex(fourcols, yue, res);
		genHouseTianJiang(fourcols, yue, isDiurnal, res);
		
		getKe(fourcols.day.ganzi, res);
		
		
		return res;
	}
	
	private static void genYueJiangIndex(FourColumns fourcols, String yue, Map<String, Object> res){
		String[] upZi = new String[12];
		int[] yueIdxs = new int[12];
		
		int yueIdx = StemBranch.BranchIndex.get(yue);
		int tmIdx = StemBranch.BranchIndex.get(fourcols.time.branch.cell);
		int delta = yueIdx - tmIdx;
		for(int i=0; i<12; i++){
			int idx = (i + delta + 12) % 12;
			yueIdxs[i] = idx;
			upZi[i] = StemBranch.Branches[idx];
		}		
		
		res.put("upZi", upZi);
		res.put("yueIndexs", yueIdxs);
	}

	private static void genHouseTianJiang(FourColumns fourcols, String yue, boolean isDiurnal, Map<String, Object> res){
		String[] houseTianJiang = new String[12];
		int[] yueIndexs = (int[]) res.get("yueIndexs");
		String guizi = getGuiZi(fourcols.day.stem.cell, isDiurnal);
		int houseidx = 0;
		for(int i=0; i<12; i++){
			String zi = StemBranch.Branches[yueIndexs[i]];
			if(zi == guizi){
				houseidx = i;
				break;
			}
		}
		String housezi = StemBranch.Branches[houseidx];
		if(SummerZiList.contains(housezi)){
			for(int i=0; i<12; i++){
				int idx = (houseidx - i + 12) % 12;
				houseTianJiang[i] = TianJiang[idx];
			}
		}else{
			for(int i=0; i<12; i++){
				int idx = (i - houseidx + 12) % 12;
				houseTianJiang[i] = TianJiang[idx];
			}
		}

		res.put("houseTianJiang", houseTianJiang);
	}
	
	private static int getIndexOf(String[] ary, String elem) {
		for(int i=0; i<ary.length; i++) {
			if(ary[i].equals(elem)) {
				return i;
			}
		}
		return -1;
	}
	
	private static void getKe(String ganzi, Map<String, Object> res){
		String daygan = ganzi.substring(0, 1);
		String[] downZi = (String[]) res.get("downZi");
		String[] upZi = (String[]) res.get("upZi");
		String[] houseTianJiang = (String[]) res.get("houseTianJiang");
		
		String ganjizi = (String)GanJiZi.get(daygan);
		int idx = getIndexOf(downZi, ganjizi);
		String ke1zi = upZi[idx];
		String tj1 = houseTianJiang[idx];
		String[] ke1 = new String[] {tj1, ke1zi, daygan};

		idx = getIndexOf(downZi, ke1zi);
		String ke2zi = upZi[idx];
		String tj2 = houseTianJiang[idx];
		String[] ke2 =  new String[] {tj2, ke2zi, ke1zi};

		String dayzi = ganzi.substring(01);;
		idx = getIndexOf(downZi, dayzi);
		String ke3zi = upZi[idx];
		String tj3 = houseTianJiang[idx];
		String[] ke3 = new String[] {tj3, ke3zi, dayzi};

		idx = getIndexOf(downZi, ke3zi);
		String ke4zi = upZi[idx];
		String tj4 = houseTianJiang[idx];
		String[] ke4 = new String[] {tj4, ke4zi, ke3zi};

		List<String[]> kes = new ArrayList<String[]>();
		kes.add(ke1);
		kes.add(ke2);
		kes.add(ke3);
		kes.add(ke4);
		
		res.put("ke", kes);
	}

	
	
	
	public static void main(String[] args) {
		String[] xun = getXun("丙", "戌");
		System.out.println(ConvertUtility.getValueAsString(xun));
	}
	
}
