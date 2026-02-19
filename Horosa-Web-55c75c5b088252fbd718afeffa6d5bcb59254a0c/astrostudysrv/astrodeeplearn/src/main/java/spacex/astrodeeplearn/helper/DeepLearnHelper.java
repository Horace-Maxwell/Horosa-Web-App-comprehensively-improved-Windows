package spacex.astrodeeplearn.helper;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.types.ICache;
import boundless.types.cache.CacheFactory;
import boundless.utility.JsonUtility;

public class DeepLearnHelper {
	static private String json10000;
	static private String json20000;
	static private String json30000;
	static private String json40000;
	
	static private Map<String, Object> map10000;
	static private Map<String, Object> map20000;
	static private Map<String, Object> map30000;
	static private Map<String, Object> map40000;
	
	static private Map<String, Object> defFateEvents = new HashMap<String, Object>();
	
	static private ICache cache10000;
	static private ICache cache20000;
	static private ICache cache30000;
	static private ICache cache40000;
	static private ICache cacheBaziFeature;
	
	static {
		json10000 = FileUtility.getStringFromClassPath("spacex/astrodeeplearn/helper/10000.json");
		json20000 = FileUtility.getStringFromClassPath("spacex/astrodeeplearn/helper/20000.json");
		json30000 = FileUtility.getStringFromClassPath("spacex/astrodeeplearn/helper/30000.json");
		json40000 = FileUtility.getStringFromClassPath("spacex/astrodeeplearn/helper/40000.json");
		
		map10000 = JsonUtility.toDictionary(json10000);
		map20000 = JsonUtility.toDictionary(json20000);
		map30000 = JsonUtility.toDictionary(json30000);
		map40000 = JsonUtility.toDictionary(json40000);
		
		cache10000 = CacheFactory.getCache("dlsample10000");
		cache20000 = CacheFactory.getCache("dlsample20000");
		cache30000 = CacheFactory.getCache("dlsample30000");
		cache40000 = CacheFactory.getCache("dlsample40000");
		cacheBaziFeature = CacheFactory.getCache("dlbazifeature");
		
		defFateEvents.put("10000", map10000);
		defFateEvents.put("20000", map20000);
		defFateEvents.put("30000", map30000);
	}
	
	static private Map<String, Object> getSample(Map<String, Object> map){
		Map<String, Object> res = new HashMap<String, Object>();
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			String key = entry.getKey();
			Map<String, Object> evt = (Map<String, Object>) entry.getValue();
			Object val = evt.get("defval");
			res.put(key, val);
		}
		return res;
	}
	
	static private Map<String, Object> getSample(Map<String, Object> map, Map<String, Object> vals){
		Map<String, Object> res = new HashMap<String, Object>();
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			String key = entry.getKey();
			Map<String, Object> evt = (Map<String, Object>) entry.getValue();
			Object val = vals.get(key);
			if(val == null) {
				val = evt.get("defval");				
			}
			res.put(key, val);
		}
		return res;
	}
	
	static public Map<String, Object> getDefFateEvents(){
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("Evt10000", map10000);
		map.put("Evt20000", map20000);
		map.put("Evt30000", map30000);
		map.put("Evt40000", map40000);
		return map;
	}
	
	static public Map<String, Object> getSample10000(String cid){
		Map<String, Object> map = cache10000.getMap(cid);
		if(map == null || map.isEmpty()) {
			map = getSample(map10000);
			return map;
		}
		
		Map<String, Object> res = getSample(map10000, map);
		return res;
	}
	
	static public Map<String, Object> getSample20000(String cid){
		Map<String, Object> map = cache20000.getMap(cid);
		if(map == null || map.isEmpty()) {
			map = getSample(map20000);
			return map;
		}
		
		Map<String, Object> res = getSample(map20000, map);
		return res;
	}
	
	static public Map<String, Object> getSample30000(String cid){
		Map<String, Object> map = cache30000.getMap(cid);
		if(map == null || map.isEmpty()) {
			map = getSample(map30000);
			return map;
		}
		
		Map<String, Object> res = getSample(map30000, map);
		return res;
	}
	
	static public Map<String, Object> getSample40000(String cid){
		Map<String, Object> map = cache40000.getMap(cid);
		if(map == null || map.isEmpty()) {
			map = getSample(map40000);
			return map;
		}
		
		Map<String, Object> res = getSample(map40000, map);
		return res;
	}
	
	static public void setSample10000(String cid, Map<String, Object> map) {
		map.put("_id", cid);
		cache10000.setMap(cid, map);
	}
	
	static public void setSample20000(String cid, Map<String, Object> map) {
		map.put("_id", cid);
		cache20000.setMap(cid, map);
	}
	
	static public void setSample30000(String cid, Map<String, Object> map) {
		map.put("_id", cid);
		cache30000.setMap(cid, map);
	}
	
	static public void setSample40000(String cid, Map<String, Object> map) {
		map.put("_id", cid);
		cache40000.setMap(cid, map);
	}
	
	static public long countSample10000() {
		return cache10000.countTotal();
	}
	
	static public long countSample20000() {
		return cache20000.countTotal();
	}
	
	static public long countSample30000() {
		return cache30000.countTotal();
	}
	
	static public long countSample40000() {
		return cache40000.countTotal();
	}
	
}
