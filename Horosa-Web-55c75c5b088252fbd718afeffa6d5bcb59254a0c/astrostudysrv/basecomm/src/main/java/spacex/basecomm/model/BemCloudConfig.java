package spacex.basecomm.model;

import java.util.Map;

public class BemCloudConfig {
	public String cloudRootUrl;
	public String devRtInfo;
	public String devRtAlert;
	public String devLogin;
	public String devCheckFirmware;
	
	public String signKey;
	
	public BemCloudConfig(){
		
	}
	
	public BemCloudConfig(Map<String, Object> map){
		this.devLogin = (String) map.get("devLogin");
		this.devRtInfo = (String) map.get("devRtInfo");		
		this.devRtAlert = (String) map.get("devRtAlert");		
		this.devCheckFirmware = (String) map.get("devCheckFirmware");		
	}
	
}
