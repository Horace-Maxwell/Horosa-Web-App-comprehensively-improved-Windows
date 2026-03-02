package boundless.utility.img;

import java.awt.image.BufferedImageOp;

import com.jhlabs.image.GaussianFilter;

public class ImageFilter {
	
	public static BufferedImageOp getGaussianBlurFilter(int radius){
		GaussianFilter filter = new GaussianFilter(radius);
		return filter;
	}

}
