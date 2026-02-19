package spacex.astrostudy.helper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.utility.JsonUtility;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.model.FourColumns;

/**
 * 十二串宫算法帮助类
 * @author zjf
 *
 */
public class Gong12Helper {
	private static Map<String, Object>[] gods = new Map[12];
	private static Map<String, Object>[] stars = new Map[12];
	private static Map<String, Integer> zhiIndex = new HashMap<String, Integer>();
	private static Map<String, String> ganTongZi = null;
	private static Map<String, Object>[] starSu = new Map[12];
	private static Map<String, String> starType = null;
	
	static {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudy/helper/gong12.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		List<Map<String, Object>> godlist = (List<Map<String, Object>>) map.get("gods");
		List<Map<String, Object>> starlist = (List<Map<String, Object>>) map.get("stars");
		int i = 0;
		for(Map<String, Object> god : godlist) {
			String zhi = (String) god.get("zhi");
			gods[i++] = god;
			zhiIndex.put(zhi, i);
		}
		i = 0;
		for(Map<String, Object> star : starlist) {
			stars[i++] = star;
		}
		
		String jsonsu = FileUtility.getStringFromClassPath("spacex/astrostudy/helper/gong12Su.json");
		Map<String, Object> mapsu = JsonUtility.toDictionary(jsonsu);
		ganTongZi = (Map<String, String>) mapsu.get("ganTongZi");
		starType = (Map<String, String>) mapsu.get("type");
		List<Map<String, Object>> starSulist = (List<Map<String, Object>>) mapsu.get("stars");
		i = 0;
		for(Map<String, Object> star : starSulist) {
			starSu[i++] = star;
		}
		
	}
	
	public static Map<String, Object> getMing(String monthzhi, String timezhi) {
		int midx = zhiIndex.get(monthzhi);
		int tidx = zhiIndex.get(timezhi);
		int n = midx + tidx;
		// keep palace index in 1..12 to avoid idx-1 becoming -1 on wrap-around (e.g. 亥+亥)
		int idx = (24 - n) % 12;
		if(idx == 0) {
			idx = 12;
		}
		Map<String, Object> god = gods[idx - 1];
		return god;
	}
	
	public static Map<String, Object> getYearCharger(String yearzhi, String ming){
		int yidx = zhiIndex.get(yearzhi);
		int midx = zhiIndex.get(ming);
		int idx = midx - yidx;
		if(yidx > midx) {
			idx = 12 - yidx + midx;
		}
		
		Map<String, Object> star = stars[idx];
		return star;
	}
	
	public static Map<String, Object> getGod(String zhi){
		int idx = zhiIndex.get(zhi) - 1;
		return gods[idx];
	}
	
	public static Map<String, Object> getLiuNianGong12(String yearZi, String dayun, FourColumns forCols){
		Map<String, Object> res = new HashMap<String, Object>();
		Map<String, Object> year = getLiuNianGong12(yearZi, forCols.year.stem.cell, forCols.year.branch.cell);
		Map<String, Object> month = getLiuNianGong12(yearZi, forCols.month.stem.cell, forCols.month.branch.cell);
		Map<String, Object> day = getLiuNianGong12(yearZi, forCols.day.stem.cell, forCols.day.branch.cell);
		Map<String, Object> time = getLiuNianGong12(yearZi, forCols.time.stem.cell, forCols.time.branch.cell);
		Map<String, Object> tai = getLiuNianGong12(yearZi, forCols.tai.stem.cell, forCols.tai.branch.cell);
		Map<String, Object> ming = getLiuNianGong12(yearZi, forCols.ming.stem.cell, forCols.ming.branch.cell);
		Map<String, Object> sheng = getLiuNianGong12(yearZi, forCols.shen.stem.cell, forCols.shen.branch.cell);
		Map<String, Object> yun = getLiuNianGong12(yearZi, dayun.substring(0, 1), dayun.substring(1));
		
		res.put("年", year);
		res.put("月", month);
		res.put("日", day);
		res.put("时", time);
		res.put("胎", tai);
		res.put("命", ming);
		res.put("身", sheng);
		res.put("运", yun);
		
		return res;
	}
	
	public static Map<String, Object> getLiuNianGong12(String yearZi, String gan, String zi){
		String gantozi = ganTongZi.get(gan);
		int ganidx = StemBranch.deltaBranch(yearZi, gantozi);
		int ziidx = StemBranch.deltaBranch(yearZi, zi);
		Map<String, Object> ganstar = starSu[ganidx];
		Map<String, Object> zistar = starSu[ziidx];
		
		Map<String, Object> res = new HashMap<String, Object>();
		res.put("干", ganstar);
		res.put("支", zistar);
		
		return res;
	}
	
	public static Map<String, Object> getGong12(String gz){
		String zi = gz;
		Integer idx = StemBranch.BranchIndex.get(gz);
		if(idx == null) {
			idx = StemBranch.StemIndex.get(gz);
			if(idx == null) {
				throw new RuntimeException("干或支错误");
			}
			zi = ganTongZi.get(gz);
			idx = StemBranch.BranchIndex.get(zi);
		}
		
		Map<String, Object>[] zigong12 = new Map[12];
		Map<String, Object>[] gangong12 = new Map[10];
		Map<String, Object>[] zigong12Su = new Map[12];
		Map<String, Object>[] gangong12Su = new Map[10];
		
		for(int i=0; i<StemBranch.Branches.length; i++) {
			String item = StemBranch.Branches[i];
			int ziidx = StemBranch.deltaBranch(zi, item);
			zigong12Su[i] = starSu[ziidx];
			zigong12[i] = stars[ziidx];
		}
		
		for(int i=0; i<StemBranch.Stems.length; i++) {
			String item = StemBranch.Stems[i];
			String itemzi = ganTongZi.get(item);
			int ziidx = StemBranch.deltaBranch(zi, itemzi);
			gangong12Su[i] = starSu[ziidx];
			gangong12[i] = stars[ziidx];
		}
		
		Map<String, Object> res = new HashMap<String, Object>();
		res.put("干", gangong12);
		res.put("支", zigong12);
		res.put("干苏", gangong12Su);
		res.put("支苏", zigong12Su);
		
		return res;
	}
	
	public static String ganTongZi(String gan) {
		return ganTongZi.get(gan);
	}
	
	public static Map<String, Object>[] getStars(){
		return stars;
	}
	
	public static Map<String, Object>[] getStarSu(){
		return starSu;
	}
	
	public static Map<String, String> getStarType(){
		return starType;
	}
	
	public static void main(String[] args) {
		Map<String, Object>  star = getYearCharger("午", "申");
		System.out.println(star);
		
		Map<String, Object>  god = getMing("午", "申");
		System.out.println(god);
	}
}
