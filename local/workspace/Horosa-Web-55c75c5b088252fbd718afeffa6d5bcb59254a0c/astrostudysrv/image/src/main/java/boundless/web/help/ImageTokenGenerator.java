package boundless.web.help;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.image.BufferedImage;
import java.io.OutputStream;
import java.util.Random;

import boundless.utility.img.ImageUtility;


public class ImageTokenGenerator {
	
	public static Color getRandColor(int i, int j){
		Random ran = new Random();
		if(i > 255){
			i = 255;
		}
		if(j > 255){
			j = 255;
		}
		int r = i + ran.nextInt(j - i);
		int g = i + ran.nextInt(j - i);
		int b = i + ran.nextInt(j - i);
		return new Color(r, g, b);
	}
	
	public static void createPic(OutputStream os, String s){
		ImageUtility.createRandomCodeImage(s, 200, 100, os);
	}

	public static void createPic0(OutputStream os, String s) throws Exception {
		int width = 15 * s.length() + 8;
		byte height = 25;
		BufferedImage bufferedImage = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
		Graphics g = bufferedImage.getGraphics();
		Random random = new Random();
		g.setColor(new Color(217, 217, 255));
		g.fillRect(0, 0, width, height);
		g.setFont(new Font("Comic San MS", 0, 18));
		g.setColor(getRandColor(160, 200));
		for(int j=0; j< 10; j++){
			int x = random.nextInt(width);
			int y = random.nextInt(height);
			int w = random.nextInt(12);
			int h = random.nextInt(12);
			g.drawOval(x, y, w, h);
		}
		for(int k = 0; k < s.length(); k++){
			char c = s.charAt(k);
			String cs = String.valueOf(c);
			g.setColor(new Color(20 + random.nextInt(110), 20 + random.nextInt(110), 20 + random.nextInt(110)));
			g.drawString(cs, 15 * k +6, 16);
		}
		
		g.dispose();

		ImageUtility.saveJPEG(bufferedImage, os);
	}
	
}
