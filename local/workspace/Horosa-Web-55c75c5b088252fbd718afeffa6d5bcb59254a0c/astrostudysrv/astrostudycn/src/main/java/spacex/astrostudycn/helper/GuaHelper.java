package spacex.astrostudycn.helper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.net.ByteOrder;
import boundless.utility.ByteUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;

public class GuaHelper {
	public static class HuGua{
		public Map<String, Object> up;
		public Map<String, Object> down;
		public Map<String, Object> gua64;
	}
	
	private static Map<String, Map<String, Object>> GuaMap = new HashMap<String, Map<String, Object>>();
	private static Map<String, Object>[] Gua64 = new Map[64];
	
	private static Map<String, Map<String, Object>> MeiyiGuaMap = new HashMap<String, Map<String, Object>>();
	private static Map<String, Object>[] MeiyiGua8 = new Map[8];
	
	private static Map<String, Object>[] sixiangGua = null;
	private static Map<String, Object> ganziGua = new HashMap<String, Object>();
	
	static {
		build();
	}

	public static void build() {
		for(int i=0; i<64; i++) {
			String fname = ByteUtility.intToBinString(i, 6, ByteOrder.LITTLE_ENDIAN);
			try {
				readGua(fname);
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
		for(int i=0; i<8; i++) {
			String fname = ByteUtility.intToBinString(i, 3, ByteOrder.LITTLE_ENDIAN);
			try {
				readMeiyiGua(fname);
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
		
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/gua.json");		
		Map<String, Object> guamap = JsonUtility.toDictionary(json);
		ganziGua = (Map<String, Object>) guamap.get("干支");
		List<Map<String, Object>> sixiang = (List<Map<String, Object>>) guamap.get("四象");
		sixiangGua = new Map[sixiang.size()];
		int i = 0;
		for(Map<String, Object> map : sixiang) {
			sixiangGua[i++] = map;
		}
	}
	
	private static void readGua(String fname){
		String path = "gua/";
		String guapath = String.format("%s%s.json", path, fname);
		String json = FileUtility.getStringFromClassPath(guapath);		
		Map<String, Object> gua = JsonUtility.toDictionary(json);
		String name = (String) gua.get("name");
		String abrname = (String) gua.get("abrname");
		String guaname = (String) gua.get("guaname");
		GuaMap.put(guaname, gua);
		GuaMap.put(abrname, gua);
		GuaMap.put(name, gua);
		GuaMap.put(fname, gua);
		int ord = ConvertUtility.getValueAsInt(gua.get("ord"));
		Gua64[ord - 1] = gua;
	}
	
	private static void readMeiyiGua(String fname){
		String path = "meihuayi/";
		String guapath = String.format("%s%s.json", path, fname);
		String json = FileUtility.getStringFromClassPath(guapath);		
		Map<String, Object> gua = JsonUtility.toDictionary(json);
		String name = (String) gua.get("name");
		String abrname = (String) gua.get("abrname");
		MeiyiGuaMap.put(abrname, gua);
		MeiyiGuaMap.put(name, gua);
		MeiyiGuaMap.put(fname, gua);
		int ord = ConvertUtility.getValueAsInt(gua.get("ord"));
		MeiyiGua8[ord - 1] = gua;
	}
	
	public static Map<String, Object> getGua(String name) {
		return GuaMap.get(name);
	}
	
	public static HuGua getHuGua(String upName, String downName){
		Map<String, Object> up = MeiyiGuaMap.get(upName);
		Map<String, Object> down = MeiyiGuaMap.get(downName);
		if(up == null) {
			throw new RuntimeException("miss.up.gua." + upName);
		}
		if(down == null) {
			throw new RuntimeException("miss.down.gua." + downName);
		}
		
		List<Integer> upyao = (List<Integer>) up.get("yao");
		List<Integer> downyao = (List<Integer>) down.get("yao");
		int[] upary = new int[upyao.size()];
		int[] downary = new int[downyao.size()];
		int i = 0;
		for(Integer n : upyao) {
			upary[i++] = n.intValue();
		}
		i = 0;
		for(Integer n : downyao) {
			downary[i++] = n.intValue();
		}
		
		String huUp = String.format("%d%d%d", downary[2], upary[0], upary[1]);
		String huDown = String.format("%d%d%d", downary[1], downary[2], upary[0]);
		
		Map<String, Object> upgua = MeiyiGuaMap.get(huUp);
		Map<String, Object> downgua = MeiyiGuaMap.get(huDown);
		
		HuGua gua = new HuGua();
		gua.up = upgua;
		gua.down = downgua;
		gua.gua64 = getGua(huDown + huUp);
		
		return gua;
	}
	
	public static Map<String, Object> getTongGua(Map<String, Object> gua64){
		List<Integer> yaos = (List<Integer>)gua64.get("yao");
		StringBuilder sb = new StringBuilder();
		for(int n : yaos) {
			if(n == 0) {
				sb.append("1");
			}else {
				sb.append("0");
			}
		}
		Map<String, Object> gua = getGua(sb.toString());
		return gua;
	}
	
	public static Map<String, Object> getGua(int idx) {
		return Gua64[idx];
	}
	
	public static Map<String, Object> getMeiyiGua(String name) {
		return MeiyiGuaMap.get(name);
	}
	
	public static Map<String, Object> getMeiyiGua(int idx) {
		return MeiyiGua8[idx];
	}
	
	public static Map<String, Object> getMeiyiGanZiGua(String key){
		String gua = (String) ganziGua.get(key);
		Map<String, Object> map = getMeiyiGua(gua);	
		return map;
	}
	
	
	public static void main(String[] args) {
		String json = JsonUtility.encodePretty(MeiyiGuaMap);
		System.out.println(json);
		
		HuGua gua = getHuGua("天", "水");
		System.out.println(gua.gua64.get("abrname"));
	}
	
}
