package spacex.astroreader.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.spring.help.interceptor.TransData;
import spacex.astroreader.helper.FlvUrlHelper;
import spacex.astroreader.helper.RtmpHelper;

@Controller
@RequestMapping("/astroreader")
public class FlvUrlController {
	
	@ResponseBody
	@RequestMapping("/livepublishpath")
	public void livePublishPath() {
		String stream = TransData.getValueAsString("stream");
		String path = RtmpHelper.genPublishPath(stream);
		TransData.set("Path", path);
	}
	
	
	@ResponseBody
	@RequestMapping("/flvurl")
	public void flvUrl() {
		int idx = TransData.getValueAsInt("index", -1);
		TransData.set("Url", FlvUrlHelper.getUrl(idx));
	}
	
	@ResponseBody
	@RequestMapping("/removelive")
	public void removeLivePublish() {
		String key = TransData.getValueAsString("key");
		RtmpHelper.removeToken(key);
	}
	
	@ResponseBody
	@RequestMapping("/restartlive")
	public void restartLive() {
		FlvUrlHelper.restartBaobaoLive();
	}
	
	
}
