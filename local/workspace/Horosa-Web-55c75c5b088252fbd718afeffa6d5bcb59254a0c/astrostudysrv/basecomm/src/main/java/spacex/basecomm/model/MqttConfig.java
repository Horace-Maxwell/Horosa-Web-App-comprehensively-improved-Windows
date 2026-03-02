package spacex.basecomm.model;

import java.util.Map;

import boundless.utility.ConvertUtility;

public class MqttConfig {
	public int pollPeriod = 60;
	public int loginPeriod = 180;
	public int checkMetricsPeriod = 180;
	public int uploadHisCounter = 100;  // 间隔时间达到poolPeriod*uploadHisCounter后才开始上送数据到百度IOT
	public String tcp;
	public String ssl;
	public String wss;
	public String uploadUser;
	public String uploadKey;
	public String alertUser;
	public String alertKey;
	public String uploadTopic = "/iot/upload";
	public String alertTopic = "/iot/alert";
	
	public MqttConfig(){
		
	}
	
	public MqttConfig(Map<String, Object> map){
		this.pollPeriod = ConvertUtility.getValueAsInt(map.get("pollPeriod"), 60);
		this.loginPeriod = ConvertUtility.getValueAsInt(map.get("loginPeriod"), 1800);
		this.checkMetricsPeriod = ConvertUtility.getValueAsInt(map.get("CheckMetricsPeriod"), 1800);
		this.tcp = (String) map.get("tcp");
		this.ssl = (String) map.get("ssl");
		this.wss = (String) map.get("wss");
		this.uploadUser = (String) map.get("uploadUser");
		this.uploadKey = (String) map.get("uploadKey");
		this.alertUser = (String) map.get("alertUser");
		this.alertKey = (String) map.get("alertKey");
		this.uploadTopic = (String) map.get("uploadTopic");
		this.alertTopic = (String) map.get("alertTopic");
	}
	
	public void copyFrom(Map<String, Object> map){
		this.pollPeriod = ConvertUtility.getValueAsInt(map.get("pollPeriod"), 60);
		this.loginPeriod = ConvertUtility.getValueAsInt(map.get("loginPeriod"), 1800);
		this.checkMetricsPeriod = ConvertUtility.getValueAsInt(map.get("CheckMetricsPeriod"), 1800);
		this.tcp = (String) map.get("tcp");
		this.ssl = (String) map.get("ssl");
		this.wss = (String) map.get("wss");
		this.uploadUser = (String) map.get("uploadUser");
		this.uploadKey = (String) map.get("uploadKey");
		this.alertUser = (String) map.get("alertUser");
		this.alertKey = (String) map.get("alertKey");
		this.uploadTopic = (String) map.get("uploadTopic");
		this.alertTopic = (String) map.get("alertTopic");
	}
	
}
