package spacex.basecomm.model;

import java.util.Map;

public class BaiduIotConfig extends MqttConfig{
	public String ak;
	public String sk;
	public String tsdb;
	
	public BaiduIotConfig(){
		super();
	}
	
	public BaiduIotConfig(Map<String, Object> map){
		super(map);
		this.ak = (String) map.get("ak");
		this.sk = (String) map.get("sk");
		this.tsdb = (String) map.get("tsdb");
	}
	
	public MqttConfig newMqttConfig(){
		MqttConfig config = new MqttConfig();
		config.tcp = this.tcp;
		config.ssl = this.ssl;
		config.wss = this.wss;
		config.uploadUser = this.uploadUser;
		config.uploadKey = this.uploadKey;
		config.alertUser = this.alertUser;
		config.alertKey = this.alertKey;
		config.uploadTopic = this.uploadTopic;
		config.alertTopic = this.alertTopic;
		
		return config;
	}
	
	public void copyFrom(Map<String, Object> map){
		super.copyFrom(map);
		this.ak = (String) map.get("ak");
		this.sk = (String) map.get("sk");
		this.tsdb = (String) map.get("tsdb");
	}
	
}
