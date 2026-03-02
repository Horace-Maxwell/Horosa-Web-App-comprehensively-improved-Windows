package boundless.utility.sound;

import java.io.File;

import boundless.io.FileUtility;
import boundless.security.SecurityUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import ws.schild.jave.encode.AudioAttributes;
import ws.schild.jave.Encoder;
import ws.schild.jave.encode.EncodingAttributes;
import ws.schild.jave.MultimediaObject;

public class SoundUtility {

	public static File convertMP3(String aufile, String mp3file, int sampleRate, int bitRate, int channel) {
		try {
			File source = new File(aufile);
			File target = new File(mp3file);

			// Audio Attributes
			AudioAttributes audio = new AudioAttributes();
			audio.setCodec("libmp3lame");
			audio.setSamplingRate(sampleRate);
			audio.setBitRate(bitRate);
			audio.setChannels(channel);

			// Encoding attributes
			EncodingAttributes attrs = new EncodingAttributes();
			attrs.setOutputFormat("mp3");
			attrs.setAudioAttributes(audio);

			// Encode
			Encoder encoder = new Encoder();
			encoder.encode(new MultimediaObject(source), target, attrs);
			return target;
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
	}
		
	public static File webmToMp3(String aufile, String mp3file) {
		return convertMP3(aufile, mp3file, 44100, 128000, 2);
	}
		
	public static File webmToMP3FromBase64(String base64, String dir) {
		try {
			String ran = StringUtility.getUUID();
			String org = String.format("%s/%s.webm", dir, ran);
			String dest = String.format("%s/%s.mp3", dir, ran);
			
			byte[] webmraw = SecurityUtility.fromBase64(base64);
			FileUtility.save(org, webmraw);
			
			return convertMP3(org, dest, 16000, 128000, 1);
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
		
	
	public static void main(String[] args) throws Exception {
		Encoder encoder = new Encoder();
		String[] enclist = encoder.getAudioEncoders();
		String[] declist = encoder.getAudioDecoders();
		
		System.out.println(JsonUtility.encodePretty(enclist));
		System.out.println(JsonUtility.encodePretty(declist));
		
		String b64file = "/Users/zjf/file/sound.txt";
		
		String sndb64 = FileUtility.getStringFromFile(b64file);
		sndb64 = sndb64.substring(23);
		
		webmToMP3FromBase64(sndb64, "/Users/zjf/file");
		
		System.out.println("finish");
	}

}
