package spacex.astrostudy.helper;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import boundless.io.FileUtility;
import boundless.types.Tuple;
import boundless.types.Tuple4;
import boundless.utility.JsonUtility;
import spacex.astrostudy.constants.StemBranch;

public class GanZiRelativeHelper {
	public static final Map<String, Tuple<Set<String>, String>> ganhe = new HashMap<String, Tuple<Set<String>, String>>();
	public static final Map<String, Tuple<Set<String>, String>> zihe6 = new HashMap<String, Tuple<Set<String>, String>>();
	public static final Map<String, Tuple<Set<String>, String>> zihe3 = new HashMap<String, Tuple<Set<String>, String>>();
	public static final Map<String, Tuple4<Set<String>, String, String, String>> zihui = new HashMap<String, Tuple4<Set<String>, String, String, String>>();
	
	public static final Map<String, Tuple<Set<String>, String>> gancong = new HashMap<String, Tuple<Set<String>, String>>();
	public static final Map<String, Tuple<Set<String>, String>> zicong = new HashMap<String, Tuple<Set<String>, String>>();
	public static final Map<String, Tuple<Set<String>, String>> zixin = new HashMap<String, Tuple<Set<String>, String>>();
	public static final Map<String, Tuple<Set<String>, String>> zicuan = new HashMap<String, Tuple<Set<String>, String>>();
	public static final Map<String, Tuple<Set<String>, String>> zipo = new HashMap<String, Tuple<Set<String>, String>>();
	
	public static final Map<String, String> ganlu = new HashMap<String, String>();
	
	static {
		String jsonstr = FileUtility.getStringFromClassPath("spacex/astrostudy/helper/ganzirelative.json");
		Map<String, Object> json = JsonUtility.toDictionary(jsonstr);
		
		initGanhe(json);
		initZihe6(json);
		initZihe3(json);
		initZihui(json);
		initGancong(json);
		initZicong(json);
		initZixin(json);
		initZicuan(json);
		initZipo(json);
		initLu(json);
	}
	
	private static void initLu(Map<String, Object> json) {
		Map<String, String> map = (Map<String, String>) json.get("lu");
		ganlu.putAll(map);
	}
	
	private static void initGanhe(Map<String, Object> json) {
		Map<String, List<String>> map = (Map<String, List<String>>) json.get("ganhe");
		for(String cell : StemBranch.Stems) {
			List<String> ary = (List<String>) map.get(cell);
			Set<String> set = new HashSet<String>();
			set.add(ary.get(0));
			Tuple<Set<String>, String> tuple = new Tuple<Set<String>, String>(set, ary.get(1));
			ganhe.put(cell, tuple);
		}
	}
	
	private static void initZihe6(Map<String, Object> json) {
		Map<String, List<String>> map = (Map<String, List<String>>) json.get("zihe6");
		for(String cell : StemBranch.Branches) {
			List<String> ary = (List<String>) map.get(cell);
			Set<String> set = new HashSet<String>();
			set.add(ary.get(0));
			Tuple<Set<String>, String> tuple = new Tuple<Set<String>, String>(set, ary.get(1));
			zihe6.put(cell, tuple);
		}
	}
	
	private static void initZihe3(Map<String, Object> json) {
		Map<String, List<String>> map = (Map<String, List<String>>) json.get("zihe3");
		for(String cell : StemBranch.Branches) {
			List<String> ary = (List<String>) map.get(cell);
			Set<String> set = new HashSet<String>();
			set.add(ary.get(0));
			set.add(ary.get(1));
			Tuple<Set<String>, String> tuple = new Tuple<Set<String>, String>(set, ary.get(2));
			zihe3.put(cell, tuple);
		}
	}
	
	private static void initZihui(Map<String, Object> json) {
		Map<String, List<String>> map = (Map<String, List<String>>) json.get("zihui");
		for(String cell : StemBranch.Branches) {
			List<String> ary = (List<String>) map.get(cell);
			Set<String> set = new HashSet<String>();
			set.add(ary.get(0));
			set.add(ary.get(1));
			Tuple4<Set<String>, String, String, String> tuple = new Tuple4<Set<String>, String, String, String>(set, ary.get(2), ary.get(3), ary.get(4));
			zihui.put(cell, tuple);
		}		
	}
	
	private static void initGancong(Map<String, Object> json) {
		Map<String, List<String>> map = (Map<String, List<String>>) json.get("ganchong");
		for(String cell : StemBranch.Stems) {
			List<String> ary = (List<String>) map.get(cell);
			if(ary == null) {
				continue;
			}
			Set<String> set = new HashSet<String>();
			int i = 0;
			for(String str : ary) {
				if(i == ary.size() - 1) {
					Tuple<Set<String>, String> tuple = new Tuple<Set<String>, String>(set, str);
					gancong.put(cell, tuple);
					break;
				}
				set.add(str);
				i++;
			}
			
		}
	}
	
	private static void initZicong(Map<String, Object> json) {
		Map<String, List<String>> map = (Map<String, List<String>>) json.get("zichong");
		for(String cell : StemBranch.Branches) {
			List<String> ary = (List<String>) map.get(cell);
			Set<String> set = new HashSet<String>();
			int i = 0;
			for(String str : ary) {
				if(i == ary.size() - 1) {
					Tuple<Set<String>, String> tuple = new Tuple<Set<String>, String>(set, str);
					zicong.put(cell, tuple);
					break;
					
				}
				set.add(str);
				i++;
			}
		}
	}
	
	private static void initZixin(Map<String, Object> json) {
		Map<String, List<String>> map = (Map<String, List<String>>) json.get("zixin");
		for(String cell : StemBranch.Branches) {
			List<String> ary = (List<String>) map.get(cell);
			Set<String> set = new HashSet<String>();
			int i = 0;
			for(String str : ary) {
				if(i == ary.size() - 1) {
					Tuple<Set<String>, String> tuple = new Tuple<Set<String>, String>(set, str);
					zixin.put(cell, tuple);
					break;
					
				}
				set.add(str);
				i++;
			}
		}
	}
	
	private static void initZicuan(Map<String, Object> json) {
		Map<String, List<String>> map = (Map<String, List<String>>) json.get("zicuan");
		for(String cell : StemBranch.Branches) {
			List<String> ary = (List<String>) map.get(cell);
			Set<String> set = new HashSet<String>();
			int i = 0;
			for(String str : ary) {
				if(i == ary.size() - 1) {
					Tuple<Set<String>, String> tuple = new Tuple<Set<String>, String>(set, str);
					zicuan.put(cell, tuple);
					break;
					
				}
				set.add(str);
				i++;
			}
		}
	}
	
	private static void initZipo(Map<String, Object> json) {
		Map<String, List<String>> map = (Map<String, List<String>>) json.get("zipo");
		for(String cell : StemBranch.Branches) {
			List<String> ary = (List<String>) map.get(cell);
			Set<String> set = new HashSet<String>();
			int i = 0;
			for(String str : ary) {
				if(i == ary.size() - 1) {
					Tuple<Set<String>, String> tuple = new Tuple<Set<String>, String>(set, str);
					zipo.put(cell, tuple);
					break;
					
				}
				set.add(str);
				i++;
			}
		}
	}
	
}
