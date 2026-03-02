package spacex.astroreader.controller;


import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.io.FileUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.TransData;
import boundless.types.FileType;
import boundless.utility.ProcessUtility;
import boundless.utility.StringUtility;

@Controller
@RequestMapping("/astroreader")
public class TTSController {
	
	private static int TTSDefSpeed = PropertyPlaceholder.getPropertyAsInt("tts.speed", 160);
	private static String TTSTmpDir = PropertyPlaceholder.getProperty("tts.tmpdir", "/ttsfile");
	private static String TTSCmd = PropertyPlaceholder.getProperty("tts.cmd", "/usr/bin/espeak");

	@ResponseBody
	@RequestMapping("/tts")
	public void tts() {
		int speed = TransData.getValueAsInt("Speed", TTSDefSpeed);
		String txt = TransData.getValueAsString("Text");
		if(StringUtility.isNullOrEmpty(txt)) {
			throw new ErrorCodeException(800001, "miss.text");
		}
		
		txt = txt.trim();
		if(StringUtility.isNullOrEmpty(txt)) {
			throw new ErrorCodeException(800001, "miss.text");
		}

		String name = StringUtility.getUUID();
		String file = String.format("%s/%s.mp3", TTSTmpDir, name);
		
		int pitch = TransData.getValueAsInt("Pitch", 0);
		String voice = TransData.getValueAsString("Voice");
		if(StringUtility.isNullOrEmpty(voice)) {
			voice = "pinyin-huang";
		}
		
		int overlap = TransData.getValueAsInt("Overlap", 0);
		
		String cmd = String.format("%s -v %s -t mp3 --overlap %d -o %s -s %d -p %d \"%s\"", TTSCmd, voice, overlap, file, speed, pitch, txt);
		ProcessUtility.execute(cmd);
		if(!FileUtility.exists(file)) {
			throw new ErrorCodeException(800002, "tts.fail");
		}
		
		byte[] mp3raw = FileUtility.getBytesFromFile(file);
		
		FileUtility.delete(file);
		
		TransData.setRawData(mp3raw, FileType.MP3, String.format("%s.mp3", name));
	}
	
}
