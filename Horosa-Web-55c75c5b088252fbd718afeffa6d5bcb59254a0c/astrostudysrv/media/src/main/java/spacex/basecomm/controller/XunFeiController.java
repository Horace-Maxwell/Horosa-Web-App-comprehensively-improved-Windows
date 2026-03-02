package spacex.basecomm.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.security.SecurityUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.StringUtility;
import spacex.basecomm.helper.XunFeiHelper;

@Controller
@RequestMapping("/xunfei")
public class XunFeiController {	
	private int Pitch = PropertyPlaceholder.getPropertyAsInt("xunfei.pitch", 50);
	private int Speed = PropertyPlaceholder.getPropertyAsInt("xunfei.speed", 50);
	private int Volume = PropertyPlaceholder.getPropertyAsInt("xunfei.volume", 50);
	
	@RequestMapping("/tts")
	@ResponseBody
	public void tts() {
		int pitch = TransData.getValueAsInt("Pitch", Pitch);
		int vol = TransData.getValueAsInt("Volume", Volume);
		int speed = TransData.getValueAsInt("Speed", Speed);
		boolean israw = TransData.getValueAsBool("IsRaw", false);
		String aue = XunFeiHelper.AUE.lame.toString();
		if(israw) {
			aue = XunFeiHelper.AUE.raw.toString();
		}
		
		String txt = TransData.getValueAsString("Text");
		if(StringUtility.isNullOrEmpty(txt)) {
			throw new ErrorCodeException(11001, "miss.text");
		}
		
		byte[] raw = XunFeiHelper.tts(txt, pitch, speed, vol, aue);
		String b64 = SecurityUtility.base64(raw);

		TransData.set("Audio", b64);
	}

	@RequestMapping("/iat")
	@ResponseBody
	public void iat() {
		boolean israw = TransData.getValueAsBool("IsRaw", false);
		String aue = XunFeiHelper.AUE.lame.toString();
		if(israw) {
			aue = XunFeiHelper.AUE.raw.toString();
		}

		String audio = TransData.getValueAsString("Audio");
		if(StringUtility.isNullOrEmpty(audio)) {
			throw new ErrorCodeException(11001, "miss.audio");
		}
		
		String txt = XunFeiHelper.iat(audio, aue);
		
		TransData.set("Text", txt);
		
	}

}
