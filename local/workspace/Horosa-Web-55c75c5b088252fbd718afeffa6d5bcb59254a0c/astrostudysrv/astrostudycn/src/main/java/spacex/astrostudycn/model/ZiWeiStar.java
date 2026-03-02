package spacex.astrostudycn.model;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import spacex.astrostudycn.helper.ZiWeiHelper;

public class ZiWeiStar {
	public String name;
	public String starlight;
	public String sihua;
	public String sihuaStarlight;
	public Map<String, Set<String>> sihuaGan;
	
	public ZiWeiStar() {
		
	}
	
	public ZiWeiStar(String name, String gan, String zi, Map<String, Map<String, String>> mySihua, Map<String, Map<String, Set<String>>> sihuaGan) {
		this.name = name;
		this.sihuaGan = ZiWeiHelper.getStarSihuaGan(name, sihuaGan);
		setup(gan, zi, mySihua);
	}
	
	public void setup(String gan, String zi, Map<String, Map<String, String>> mySihua) {
		ZiWeiHelper.setupSihua(gan, this, mySihua);
		if(this.sihua != null) {
			this.sihuaStarlight = ZiWeiHelper.getStarLight(this.sihua, zi);
		}
		this.starlight = ZiWeiHelper.getStarLight(this.name, zi);
	}
}
