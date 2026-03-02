package spacex.astroreader.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.spring.help.interceptor.TransData;
import boundless.utility.StringUtility;
import spacex.astroreader.helper.RtmpHelper;

@Controller
@RequestMapping("/live")
public class RtmpController {

	@ResponseBody
	@RequestMapping("/beat")
	public void beat() {
		String name = TransData.getValueAsString("name");
		String[] parts = StringUtility.splitString(name, '_');
		String key = parts[0];
		RtmpHelper.checkPublishing(key);
	}
	
	@ResponseBody
	@RequestMapping("/finishrecord")
	public void finishrecord() {
		
	}
	
	@ResponseBody
	@RequestMapping("/onplay")
	public void onplay() {
		String key = TransData.getValueAsString("key");
		String ip = TransData.getValueAsString("addr");
		RtmpHelper.checkPlay(key, ip);
	}
	
	@ResponseBody
	@RequestMapping("/finishplay")
	public void finishplay() {
		String key = TransData.getValueAsString("key");
		RtmpHelper.finishPlay(key);		
	}
	
	@ResponseBody
	@RequestMapping("/onpublish")
	public void onpublish() {
		String key = TransData.getValueAsString("key");
		String ip = TransData.getValueAsString("addr");
		RtmpHelper.checkPublish(key, ip);		
	}
	
	@ResponseBody
	@RequestMapping("/finishpublish")
	public void finishpublish() {
		String key = TransData.getValueAsString("key");
		RtmpHelper.finishPublish(key);				
	}
	
	@ResponseBody
	@RequestMapping("/getstreams")
	public void getStreams() {
		TransData.set("List", RtmpHelper.getStreams());
	}
	
	@ResponseBody
	@RequestMapping("/playpath")
	public void getPlayPath() {
		String key = TransData.getValueAsString("key");
		TransData.set("Path", RtmpHelper.getPlayPath(key));
	}
	
}
