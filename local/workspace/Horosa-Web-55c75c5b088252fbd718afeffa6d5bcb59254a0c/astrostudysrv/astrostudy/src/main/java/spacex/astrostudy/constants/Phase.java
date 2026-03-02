package spacex.astrostudy.constants;

import java.util.HashMap;
import java.util.Map;

public class Phase {
	private Map<String, String> ganZiPhase = new HashMap<String, String>();
	private Map<String, String> ganPhaseZi = new HashMap<String, String>();
	private Map<String, String> wuXingZiPhase = new HashMap<String, String>();
	private Map<String, String> wuXingPhaseZi = new HashMap<String, String>();

	public Phase(Map<String, Object> ganzimap, Map<String, Object> ganphasemap, Map<String, Object> wxzimap, Map<String, Object> wxphasemap) {
		for(Map.Entry<String, Object> entry : ganzimap.entrySet()) {
			ganZiPhase.put(entry.getKey(), entry.getValue().toString());
		}
		for(Map.Entry<String, Object> entry : ganphasemap.entrySet()) {
			ganPhaseZi.put(entry.getKey(), entry.getValue().toString());
		}
		for(Map.Entry<String, Object> entry : wxzimap.entrySet()) {
			wuXingZiPhase.put(entry.getKey(), entry.getValue().toString());
		}
		for(Map.Entry<String, Object> entry : wxphasemap.entrySet()) {
			wuXingPhaseZi.put(entry.getKey(), entry.getValue().toString());
		}
	}
	
	public String getPhase(String gan, String zi) {
		String key = String.format("%s_%s", gan, zi);
		return ganZiPhase.get(key);
	}
	
	public String getPhaseZi(String gan, String phase) {
		String key = String.format("%s_%s", gan, phase);
		return ganPhaseZi.get(key);
	}
	
	public String getPhase(FiveElement wx, String zi) {
		String wxstr = wx.toString();
		String key = String.format("%s_%s", wxstr, zi);
		return wuXingZiPhase.get(key);
	}
	
	public String getPhaseZi(FiveElement wx, String phase) {
		String wxstr = wx.toString();
		String key = String.format("%s_%s", wxstr, phase);
		return wuXingPhaseZi.get(key);
	}
	
	
}
