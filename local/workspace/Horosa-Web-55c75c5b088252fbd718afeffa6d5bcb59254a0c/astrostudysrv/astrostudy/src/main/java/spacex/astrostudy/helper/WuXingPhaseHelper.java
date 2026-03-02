package spacex.astrostudy.helper;

import java.util.Map;

import boundless.io.FileUtility;
import boundless.utility.JsonUtility;
import spacex.astrostudy.constants.FiveElement;
import spacex.astrostudy.constants.Phase;
import spacex.astrostudy.constants.PhaseType;

public class WuXingPhaseHelper {
	public static final Phase phaseHuotuTong;
	public static final Phase phaseShuituTong;
	public static final Phase phaseYingyang;
	
	public static final Map<String, String> phaseNaYin;
	
	static {
		String jsonstr = FileUtility.getStringFromClassPath("spacex/astrostudy/helper/wuxingphase.json");
		Map<String, Object> json = JsonUtility.toDictionary(jsonstr);
		
		Map<String, Object> phase = (Map<String, Object>) json.get("huotutong");
		phaseHuotuTong = new Phase((Map<String, Object>)phase.get("ganzi"), 
					(Map<String, Object>)phase.get("ganphase"), 
					(Map<String, Object>)phase.get("wxzhi"),
					(Map<String, Object>)phase.get("wxphase")
				);
		
		phase = (Map<String, Object>) json.get("suitutong");
		phaseShuituTong = new Phase((Map<String, Object>)phase.get("ganzi"), 
				(Map<String, Object>)phase.get("ganphase"), 
				(Map<String, Object>)phase.get("wxzhi"),
				(Map<String, Object>)phase.get("wxphase")
			);

		phase = (Map<String, Object>) json.get("yingyang");
		phaseYingyang = new Phase((Map<String, Object>)phase.get("ganzi"), 
				(Map<String, Object>)phase.get("ganphase"), 
				(Map<String, Object>)phase.get("wxzhi"),
				(Map<String, Object>)phase.get("wxphase")
			);
		
		phase = (Map<String, Object>) json.get("nayin");
		phaseNaYin = (Map<String, String>)phase.get("wxzhi");

	}
	
	public static Phase getPhase(PhaseType phaseType) {
		if(phaseType == PhaseType.HuoTu) {
			return phaseHuotuTong;
		}else if(phaseType == PhaseType.ShuiTu) {
			return phaseShuituTong;
		}else {
			return phaseYingyang;
		}
	}
	
	public static String getPhase(PhaseType phaseType, String gan, String zi) {
		return getPhase(phaseType).getPhase(gan, zi);
	}
	
	public static String getPhaseZi(PhaseType phaseType, String gan, String phase) {
		return getPhase(phaseType).getPhaseZi(gan, phase);
	}
	
	public static String getPhase(PhaseType phaseType, FiveElement wx, String zi) {
		return getPhase(phaseType).getPhase(wx, zi);
	}
	
	public static String getPhaseZi(PhaseType phaseType, FiveElement wx, String phase) {
		return getPhase(phaseType).getPhaseZi(wx, phase);
	}
	
	public static String getNaYinPhase(FiveElement wx, String zi) {
		String key = String.format("纳音%s_%s", wx.toString(), zi);
		return phaseNaYin.get(key);
	}
}
