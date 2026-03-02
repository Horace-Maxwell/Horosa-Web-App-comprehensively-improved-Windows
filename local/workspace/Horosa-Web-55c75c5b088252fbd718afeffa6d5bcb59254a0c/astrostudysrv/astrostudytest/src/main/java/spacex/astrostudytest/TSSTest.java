package spacex.astrostudytest;

import java.io.File;

import boundless.exception.ErrorCodeException;
import boundless.io.FileUtility;
import boundless.utility.ProcessUtility;
import boundless.utility.StringUtility;

public class TSSTest {

	public static void main(String[] args) throws Exception{
		String txt = "夕阳还余了一丝挂在山麓，但天地间已是一片暮气沉沉，古朴而空旷的广场之上，一眼望不到边的青色石碑影子被最后一缕夕光扯得很长，交织在了一起，像是无尽的黑暗！";
		
		String name = StringUtility.getUUID();
		String file = String.format("/Users/Shared/file/aaa/%s.wav", name);
		String mp3file = String.format("/Users/Shared/file/aaa/%s.mp3", name);
		
		String cmd = String.format("/usr/local/Cellar/espeak/1.48.04_1/bin/espeak \"%s\" -w %s -g 1 -p 10 -s 180 -v zh", txt, file);
		ProcessUtility.execute(cmd);
		if(!FileUtility.exists(file)) {
			throw new ErrorCodeException(800002, "tts.fail");
		}
		
//		File mp3 = SoundUtility.wavToMp3(file, mp3file);
//		byte[] mp3raw = FileUtility.getBytesFromFile(mp3);

	}

}
