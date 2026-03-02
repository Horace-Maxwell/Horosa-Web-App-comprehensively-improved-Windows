package boundless.utility.img;

import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.GraphicsDevice;
import java.awt.Image;
import java.awt.MouseInfo;
import java.awt.Robot;
import java.awt.font.FontRenderContext;
import java.awt.font.LineBreakMeasurer;
import java.awt.font.TextAttribute;
import java.awt.font.TextLayout;
import java.awt.geom.Rectangle2D;
import java.awt.image.BufferedImage;
import java.awt.image.DataBufferByte;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.AttributedCharacterIterator;
import java.text.AttributedString;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.awt.image.ImageObserver;

import javax.imageio.ImageIO;
import javax.imageio.stream.ImageOutputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;

import org.imgscalr.Scalr;
import org.opencv.core.CvType;
import org.opencv.core.KeyPoint;
import org.opencv.core.Mat;
import org.opencv.core.MatOfKeyPoint;
import org.opencv.core.MatOfPoint;
import org.opencv.core.Rect;
import org.opencv.core.Scalar;
import org.opencv.features2d.MSER;
import org.opencv.imgproc.Imgproc;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

import boundless.console.OSinfo;
import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.security.SecurityUtility;
import boundless.types.FileType;
import boundless.types.OutParameter;
import boundless.utility.ConvertUtility;
import boundless.utility.ProcessUtility;
import boundless.utility.StringUtility;


public class ImageUtility {
	private static boolean initOpenCVFlag = false;
	// Keep captcha font initialization JVM-safe: built-ins first, classpath fonts are optional.
	private static Font[] myFonts = new Font[]{
    		new Font("Serif", Font.BOLD, 8),
    		new Font("SansSerif", Font.BOLD, 8),
    		new Font("Dialog", Font.BOLD, 8),
    		new Font("Monospaced", Font.BOLD, 8)
    };
	
	public static final String QRCodeTitleSeperator = "__^title^__";
	
	static{
		String os = System.getProperty("os.name");
		String ver = System.getProperty("os.version");
		QueueLog.info(CustomOpenCV.logger, "os: {}, {}", os, ver);

		if(OSinfo.isLinux()){
			ProcessUtility.execute("ldd --version", null, (lines)->{
				try{
					String glibc = lines.get(0);
					String[] parts = StringUtility.splitString(glibc, ' ');
					double glibcver = ConvertUtility.getValueAsDouble(parts[parts.length-1]);
					QueueLog.info(CustomOpenCV.logger, "glibc: {}, glibcver:{}", glibc, glibcver);
					
					if(glibcver >= 2.17){
						QueueLog.info(CustomOpenCV.logger, "init opencv ...");
						initOpenCV();
					}
				}catch(Exception e){
					QueueLog.error(CustomOpenCV.logger, e);
				}
			});
		}else{
			QueueLog.info(CustomOpenCV.logger, "init opencv ...");
			initOpenCV();
		}
	}
	
	public static void initOpenCV(){
		if(initOpenCVFlag){
			return;
		}
		try{
			CustomOpenCV.loadLocally();
			initOpenCVFlag = true;
		}catch(Throwable e){
			QueueLog.error(CustomOpenCV.logger, e);
		}	
	}

	/**
	 * 按指定的宽度等比例缩放图片
	 * @param originalImageFile
	 * @param destImageFile
	 * @param width
	 */
    public static void scaleByWidth(String originalImageFile, String destImageFile, int width)
    {
        scale(imageFromFile(originalImageFile), destImageFile, width, 0, "W");
    }

    /**
     * 按指定的高度等比例缩放图片
     * @param originalImageFile
     * @param destImageFile
     * @param height
     */
    public static void scaleByHeight(String originalImageFile, String destImageFile, int height)
    {
        scale(imageFromFile(originalImageFile), destImageFile, 0, height, "H");
    }

    /**
     * 按指定的宽度、高度不等比例缩放图片
     * @param originalImageFile
     * @param destImageFile
     * @param width
     * @param height
     */
    public static void scale(String originalImageFile, String destImageFile, int width,int height)
    {
        scale(imageFromFile(originalImageFile), destImageFile, width, height, "HW");
    }

	/// <summary>
	/// 
	/// </summary>
	/// <param name="originalImageFile"></param>
	/// <param name="destImageFile"></param>
	/// <param name="width"></param>
	/// <param name="height"></param>
    /**
     * 按指定的宽度、高度截取图片
     * @param originalImageFile
     * @param destImageFile
     * @param width
     * @param height
     */
    public static void cut(String originalImageFile, String destImageFile, int width, int height)
    {
        scale(imageFromFile(originalImageFile), destImageFile, width, height, "Cut");
    }

    /**
     * 按指定的宽度等比例缩放图片
     * @param originalImage
     * @param destImageFile
     * @param width
     */
    public static void scaleByWidth(InputStream originalImage, String destImageFile, int width)
    {
        scale(imageFrom(originalImage), destImageFile, width, 0, "W");
    }

    /**
     * 按指定的高度等比例缩放图片
     * @param originalImage
     * @param destImageFile
     * @param height
     */
    public static void scaleByHeight(InputStream originalImage, String destImageFile, int height)
    {
        scale(imageFrom(originalImage), destImageFile, 0, height, "H");
    }

	/// <param name="height"></param>
    /**
     * 按指定的宽度、高度不等比例缩放图片
     * @param originalImage
     * @param destImageFile
     * @param width
     * @param height
     */
    public static void scale(InputStream originalImage, String destImageFile, int width, int height)
    {
        scale(imageFrom(originalImage), destImageFile, width, height, "HW");
    }

    /**
     * 按指定的宽度、高度截取图片
     * @param originalImage
     * @param destImageFile
     * @param width
     * @param height
     */
    public static void cut(InputStream originalImage, String destImageFile, int width, int height)
    {
        scale(imageFrom(originalImage), destImageFile, width, height, "Cut");
    }

    /**
     * 按指定的宽度等比例缩放图片
     * @param originalImageFile
     * @param destImage
     * @param width
     */
    public static void scaleByWidth(String originalImageFile, OutputStream destImage, int width)
    {
        scale(imageFromFile(originalImageFile), destImage, width, 0, "W");
    }

    /**
     * 按指定的高度等比例缩放图片
     * @param originalImageFile
     * @param destImage
     * @param height
     */
    public static void scaleByHeight(String originalImageFile, OutputStream destImage, int height)
    {
        scale(imageFromFile(originalImageFile), destImage, 0, height, "H");
    }

    /**
     * 按指定的宽度、高度不等比例缩放图片
     * @param originalImageFile
     * @param destImage
     * @param width
     * @param height
     */
    public static void scale(String originalImageFile, OutputStream destImage, int width, int height)
    {
        scale(imageFromFile(originalImageFile), destImage, width, height, "HW");
    }

    /**
     * 按指定的宽度、高度截取图片
     * @param originalImageFile
     * @param destImage
     * @param width
     * @param height
     */
    public static void cut(String originalImageFile, OutputStream destImage, int width, int height)
    {
        scale(imageFromFile(originalImageFile), destImage, width, height, "Cut");
    }

    /**
     * 按指定的宽度等比例缩放图片
     * @param originalImage
     * @param destImage
     * @param width
     */
    public static void scaleByWidth(InputStream originalImage, OutputStream destImage, int width)
    {
        scale(imageFrom(originalImage), destImage, width, 0, "W");
    }

    /**
     * 按指定的高度等比例缩放图片
     * @param originalImage
     * @param destImage
     * @param height
     */
    public static void scaleByHeight(InputStream originalImage, OutputStream destImage, int height)
    {
        scale(imageFrom(originalImage), destImage, 0, height, "H");
    }

    /**
     * 按指定的宽度、高度不等比例缩放图片
     * @param originalImage
     * @param destImage
     * @param width
     * @param height
     */
    public static void scale(InputStream originalImage, OutputStream destImage, int width, int height){
        scale(imageFrom(originalImage), destImage, width, height, "HW");
    }

    public static void scale(BufferedImage originalImage, OutputStream destImage, int width, int height){
        scale(originalImage, destImage, width, height, "HW");
    }

    /**
     * 按指定的宽度、高度截取图片
     * @param originalImage
     * @param destImage
     * @param width
     * @param height
     */
    public static void cut(InputStream originalImage, OutputStream destImage, int width, int height){
        scale(imageFrom(originalImage), destImage, width, height, "Cut");
    }
	
    public static void cut(BufferedImage originalImage, OutputStream destImage, int width, int height){
        scale(originalImage, destImage, width, height, "Cut");
    }
	
	
    public static void scale(BufferedImage originalImage, Object destImage, int width, int height, String mode){
        int towidth = width;
        int toheight = height;

        int x = 0;
        int y = 0;
        int ow = originalImage.getWidth();
        int oh = originalImage.getHeight();

        switch (mode)
        {
            case "HW"://指定高宽缩放（可能变形）                
                break;
            case "W"://指定宽，高按比例                    
                toheight = originalImage.getHeight() * width / originalImage.getWidth();
                break;
            case "H"://指定高，宽按比例
                towidth = originalImage.getWidth() * height / originalImage.getHeight();
                break;
            case "Cut"://指定高宽裁减（不变形）                
            	if(towidth > ow) towidth = ow;
            	if(toheight > oh) toheight = oh;
            	x = (ow - towidth) / 2;
            	y = (oh - toheight);
                break;
            default:
                break;
        }

        //新建一个bmp图片
        BufferedImage bitmap = new BufferedImage(towidth, toheight, BufferedImage.TYPE_INT_RGB);
        //新建一个画板
        Graphics2D g = bitmap.createGraphics();
        
        // 使得背景透明, 只能用于png图片
//        bitmap = g.getDeviceConfiguration().createCompatibleImage(towidth, toheight, Transparency.TRANSLUCENT);
//        g = bitmap.createGraphics();
        
        //设置高质量插值法
        //g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.High;

        //设置高质量,低速度呈现平滑程度
        //g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;


        //在指定位置并且按指定大小绘制原图片的指定部分
        BufferedImage resultImg = null;
        if(mode.equals("Cut")){
        	resultImg = originalImage.getSubimage(x, y, towidth, toheight);
        }else{
            g.drawImage(originalImage, 0, 0, towidth, toheight,
            		x, y, ow, oh,
            	new ImageObserver(){
    			@Override
    			public boolean imageUpdate(Image img, int infoflags, int x, int y, int width, int height) {
    				return false;
    			}            	
            });
            resultImg = bitmap;
        }

        try{
            //以jpg格式保存缩略图
        	saveImage(resultImg, destImage, "jpg");
        } finally {
            g.dispose();
        }
        
        
    }
	
	
	
	
	/**
	 * 创建随机代码图片
	 * @param width 产生的图片宽度
	 * @param height 产生的图片高度
	 * @param destImage 产生的图片输出流
	 * @return 随机代码
	 */
    public static String createRandomCodeImage(int width, int height, OutputStream destImage)
    {
        return createRandomCodeImage(null,width, height, destImage);
    }
	
	/**
	 * 创建随机代码图片
	 * @param width 产生的图片宽度
	 * @param height 产生的图片高度
	 * @param destImageFile 产生的图片输出路径
	 * @return 随机代码
	 */
    public static String createRandomCodeImage(int width, int height, String destImageFile)
    {
        return createRandomCodeImage(null, width, height, destImageFile);
    }

	/**
	 * 创建随机代码图片
	 * @param randomCode 随机代码
	 * @param width 产生的图片宽度
	 * @param height 产生的图片高度
	 * @param destImage 产生的图片输出流
	 * @return 随机代码
	 */
    public static String createRandomCodeImage(String randomCode, int width, int height, OutputStream destImage)
    {
        return innerCreateRandomCodeImage(randomCode,width, height, destImage);
    }

	/**
	 * 创建随机代码图片
	 * @param randomCode 随机代码
	 * @param width 产生的图片宽度
	 * @param height 产生的图片高度
	 * @param destImage 产生的图片输出路径
	 * @return 随机代码
	 */
    public static String createRandomCodeImage(String randomCode, int width, int height, String destImage)
    {
        return innerCreateRandomCodeImage(randomCode,width, height, destImage);
    }

	/**
	 * 创建随机验证码
	 * @return 随机代码
	 */
    public static String createRandomCode(){
        String randomCode = "";
        Random rnd = new Random();
        if (StringUtility.isNullOrEmpty(randomCode)){
            //验证码的字符集，去掉了一些容易混淆的字符 
            char[] character = { '2', '3', '4', '5', '6', '8', '9', 
            		'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'm', 'n', 'p', 'r', 's', 't', 'w', 'x', 'y',
            		'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'W', 'X', 'Y' };
            //生成验证码字符串 
            for (int i = 0; i < 4; i++){
                randomCode += character[rnd.nextInt(character.length)];
            }
        }
        return randomCode;
    }

    /**
     * 创建随机代码图片
     * @param randomCode 随机代码
     * @param width 产生的图片宽度
     * @param height 产生的图片高度
     * @param destImage 产生的图片存放路径或输出流
     * @param imgFormat 图片格式
     * @return 随机代码
     */
    private static String innerCreateRandomCodeImage(String randomCode, int width, int height, Object destImage, String imgFormat){
        //颜色列表，用于验证码、噪线、噪点 
        Color[] color = { Color.black, Color.red, Color.blue, Color.green, Color.orange, Color.darkGray, Color.cyan, Color.magenta };
        
        if (StringUtility.isNullOrEmpty(randomCode)){
            randomCode = createRandomCode();
        }

        BufferedImage bufferedimage = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics g = bufferedimage.createGraphics();;
        g.clearRect(0, 0, width, height);
        g.setColor(Color.white);
        g.fillRect(0, 0, width, height);
        
        Random rnd = new Random();
        //随机输出噪点
        for (int i = 0; i < 50; i++) {
            int x = rnd.nextInt(bufferedimage.getWidth());
            int y = rnd.nextInt(bufferedimage.getHeight());
            g.setColor(Color.lightGray);
            g.drawRect(x, y, 1, 1);
        }
        
        int part = width / randomCode.length();
        int marginX = 3;
        int marginY = 5;
        //画验证码字符串 
        for (int i = 0; i < randomCode.length(); i++){
            Color clr = color[rnd.nextInt(color.length)];
            g.setColor(clr);
            String str = String.valueOf(randomCode.charAt(i));
            Font ft = getFont(str, g, part, height, marginX, marginY);
            g.setFont(ft);
            int fontW = g.getFontMetrics().stringWidth(str);
            int fontH = g.getFontMetrics().getHeight();
            int fontX = (part - fontW) / 2 ;
            int fontY = (height + fontH) / 2 - marginY*3;
            g.drawString(str, i * part + fontX, fontY);
        }
        
        //画噪点 
        for (int i = 0; i < 100; i++)
        {
            int x = rnd.nextInt(bufferedimage.getWidth());
            int y = rnd.nextInt(bufferedimage.getHeight());
            Color clr = color[rnd.nextInt(color.length)];
            bufferedimage.setRGB(x, y, clr.getRGB());;
        }
        
        g.dispose();

        try {
        	if(StringUtility.isNullOrEmpty(imgFormat)){
                //以jpg格式保存缩略图
            	saveJPEG(bufferedimage, destImage);
        	}else{
        		saveImage(bufferedimage, destImage, imgFormat);
        	}
        } catch(Exception e) { 
        	
        } finally{
        	g.dispose();        	
        }
        
        return randomCode;
    }
 
    /**
     * 创建随机代码图片
     * @param randomCode 随机代码
     * @param width 产生的图片宽度
     * @param height 产生的图片高度
     * @param destImage 产生的图片存放路径或输出流
     * @param imgFormat 图片格式
     * @return 随机代码
     */
    public static String createRandomCodeImage(String randomCode, int width, int height, Object destImage, String imgFormat)
    {
    	return innerCreateRandomCodeImage(randomCode, width, height, destImage, imgFormat);
    }
    
    /**
     * 创建随机代码图片
     * @param randomCode 随机代码
     * @param width 产生的图片宽度
     * @param height 产生的图片高度
     * @param destImage 产生的图片存放路径或输出流
     * @return 随机代码
     */
    private static String innerCreateRandomCodeImage(String randomCode, int width, int height, Object destImage)
    {
    	return innerCreateRandomCodeImage(randomCode, width, height, destImage, "jpg");
    }
    
    private static Font getFontFromClass(String font){
    	try(InputStream ins = FileUtility.getInputStreamFromClassPath(font)){
    		if(ins == null){
    			return null;
    		}
    		return Font.createFont(Font.TRUETYPE_FONT, ins);
    	}catch(Throwable e){
    		return null;
    	}
    }

    private static Font safeClassFont(String classPath, String fallbackName, int style, float size){
    	try{
    		Font f = getFontFromClass(classPath);
    		if(f != null){
    			return f.deriveFont(style).deriveFont(size);
    		}
    	}catch(Throwable e){
    		QueueLog.warn(AppLoggers.ErrorLogger, "load font from classpath failed: {}", classPath);
    	}
    	try{
    		return new Font(fallbackName, style, Math.round(size));
    	}catch(Throwable e){
    		return new Font("Dialog", style, Math.round(size));
    	}
    }
    
    private static Font getFont(String str, Graphics g, int width, int height, int marginX, int marginY){
        //字体列表，用于验证码 
        int fontSize = 8;
        Random rnd = new Random(System.nanoTime());
		int idx = rnd.nextInt(myFonts.length);
        Font font = myFonts[idx];
    	int fontH = g.getFontMetrics(font).getHeight();
    	int fontW = g.getFontMetrics(font).stringWidth(str);
    	int limH = height - marginY * 2;
    	int limW = width - marginX * 2;
    	Font tmpfont = font;
    	while(fontH < limH && fontW < limW){
    		idx = rnd.nextInt(myFonts.length);
    		fontSize++;
    		tmpfont = myFonts[idx].deriveFont((float)fontSize);
        	fontH = g.getFontMetrics(tmpfont).getHeight();
        	fontW = g.getFontMetrics(tmpfont).stringWidth(str);
        	if(fontH < limH && fontW < limW){
        		font = tmpfont;
        	}
    	}
    	return font;
    }
    
    public static BufferedImage imageFrom(InputStream inStream) {
		try {
			return ImageIO.read(inStream);
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
    }
    
    public static BufferedImage imageFromFile(String filename){
    	File file = new File(filename);
    	FileInputStream fin = null;
    	try {
			fin = new FileInputStream(file);
			return imageFrom(fin);
		} catch (Exception e) {
			throw new RuntimeException(e);
		}finally{
			if(fin != null)
				try {
					fin.close();
				} catch (IOException e) {
				}
		}
    }
    
    public static BufferedImage imageFromBase64(String b64){
    	try {
    		byte[] raw = SecurityUtility.fromBase64(b64);
    		ByteArrayInputStream bin = new ByteArrayInputStream(raw);
			return imageFrom(bin);
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
    }
    
    public static void saveImage(BufferedImage image, Object destImage, String imgFormat){
    	if(StringUtility.isNullOrEmpty(imgFormat)){
    		imgFormat = "jpg";
    	}
        if (destImage instanceof OutputStream){
        	OutputStream outputstream = (OutputStream) destImage;
        	try {
        		ImageOutputStream imgos = new MemoryCacheImageOutputStream(outputstream);
        		ImageIO.write(image, imgFormat, imgos);
			} catch (Exception e) {
				e.printStackTrace();
			}
        }else {
            String destFile = destImage + "";
            if (!destFile.toLowerCase().endsWith("." + imgFormat.toLowerCase())){
            	destFile += "." + imgFormat;
            }
            File file = new File(destFile);
            FileOutputStream fos = null;
            try{
            	fos = new FileOutputStream(file);
            	ImageIO.write(image, imgFormat, fos);
            }catch(Exception e){
            	e.printStackTrace();
            }finally{
            	try {
            		if(fos != null)
            			fos.close();
				} catch (IOException e) {
					e.printStackTrace();
				}            	
            }
        }
    	
    }
    
    public static void saveJPEG(BufferedImage image, Object destImage){
    	saveImage(image, destImage, "jpg");
    }

    /**
     * 创建屏幕截图
     * @return
     */
    public static byte[] createScreenshot() {
    	ByteArrayOutputStream byteos = new ByteArrayOutputStream();
    	try{
    		createScreenshot(byteos);
    		return byteos.toByteArray();
    	}catch(Exception e){
    		e.printStackTrace();
    		return new byte[0];
    	}finally{
    		try {
    			byteos.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
    	}
    }
    
    /**
     * 创建屏幕截图
     * @param filename
     */
    public static void createScreenshot(String filename){
    	File file = new File(filename);
    	FileOutputStream fops = null;
    	try {
			fops = new FileOutputStream(file);
			createScreenshot(fops);
		} catch (Exception e) {
			e.printStackTrace();
		}finally{
			if(fops != null) {
				try {
					fops.close();
				} catch (IOException e) {
					e.printStackTrace();
				}
			}
			
		}
    }
    
    /**
     * 创建屏幕截图
     * @param ops
     * @param imgFormat 图片格式
     * @throws Exception
     */
    public static void createScreenshot(OutputStream ops, String imgFormat) throws Exception{
    	String fmt = imgFormat;
    	if(StringUtility.isNullOrEmpty(imgFormat)){
    		fmt = "png";
    	}
    	ImageOutputStream imgos = new MemoryCacheImageOutputStream(ops);
    	Robot robot = new Robot();
    	GraphicsDevice currentDevice = MouseInfo.getPointerInfo().getDevice();
		BufferedImage exportImage = robot.createScreenCapture(currentDevice.getDefaultConfiguration().getBounds());

		ImageIO.write(exportImage, fmt, imgos);
    }
    
    public static void createScreenshot(OutputStream ops) throws Exception {
    	createScreenshot(ops, "png");
    }
    
	public static BufferedImage resize(BufferedImage src, int width, int height){
		BufferedImage img = Scalr.resize(src, Scalr.Mode.FIT_EXACT, width, height);
		return img;
	}
	
	public static void resize(String orgfile, int width, int height, String destfile){
		try{
			File input = new File(orgfile);
			File output = new File(destfile);
			
			int lastidx = destfile.lastIndexOf('.');
			String ext = destfile.substring(lastidx);
			
			BufferedImage src = ImageIO.read(input);
			BufferedImage newimg = Scalr.resize(src, Scalr.Mode.FIT_EXACT, width, height);
			ImageIO.write(newimg, ext, output);
		}catch(Exception e){
			
		}
	}

	public static int getFontPixelFromSize(int sz){
//		double n = 1.0 * sz / 72 * 96;
//		return ConvertUtility.getValueAsInt(n);
		return sz;
	}
	
	public static int getChineseFontPixelWidth(Font font){
		BufferedImage bufimg = new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
		Graphics2D g = bufimg.createGraphics();
		FontMetrics metrics = g.getFontMetrics(font);
		Rectangle2D rect = metrics.getStringBounds("辰", g);
		int w = ConvertUtility.getValueAsInt(rect.getWidth());
		g.dispose();
		return w;
	}
	
	private static int calcMultilineTextHeight(Graphics2D g2d, String text, int width, Integer rowlimit, OutParameter<Integer> maxwidth){
	    Font ft = g2d.getFont();
	    AttributedString txt = new AttributedString(text);
		txt.addAttribute(TextAttribute.FONT, ft);

		AttributedCharacterIterator paragraph = txt.getIterator();
	    int paragraphStart = paragraph.getBeginIndex();
	    int paragraphEnd = paragraph.getEndIndex();
	    FontRenderContext frc = g2d.getFontRenderContext();
	    LineBreakMeasurer lineMeasurer = new LineBreakMeasurer(paragraph, frc);
	    
	    float breakWidth = (float)width;
	    float drawPosY = 0;
	    
	    float ydelta = 0;
	    
	    int rowcnt = 0;
	    double maxw = 0;
	    lineMeasurer.setPosition(paragraphStart);
	    while (lineMeasurer.getPosition() < paragraphEnd) {
	        TextLayout layout = lineMeasurer.nextLayout(breakWidth);
	        ydelta = layout.getAscent() + layout.getDescent() + layout.getLeading();
	        drawPosY += ydelta;
	        double w = layout.getBounds().getWidth();
	        if(w > maxw){
	        	maxw = w;
	        }
	        rowcnt++;
	        if(rowlimit != null && rowcnt >= rowlimit.intValue()){
	        	break;
	        }
	    }
	    if(maxwidth != null){
	    	if(maxw > 0){
		    	maxwidth.value = ConvertUtility.getValueAsInt(maxw);
	    	}else{
	    		maxwidth.value = width;
	    	}
	    }
	    int height = ConvertUtility.getValueAsInt(drawPosY) + 1;
	    return height;
	}
	
	public static int calcMultilineTextHeight(Font font, String text, int width, Integer rowlimit, OutParameter<Integer> maxwidth){
		BufferedImage bufimg = new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
		Graphics2D g = bufimg.createGraphics();
		g.setFont(font);

		int h = calcMultilineTextHeight(g, text, width, rowlimit, maxwidth);
		g.dispose();
		
		return h;
	}
	
	public static int calcMultilineTextHeight(Font font, String text, int width){
		return calcMultilineTextHeight(font, text, width, null, null);
	}
	
	private static BufferedImage drawMultilineText(Graphics2D g2d, String text, int width, Integer rowlimit, OutParameter<Integer> maxwidth){
	    float breakWidth = (float)width;
	    float drawPosY = 0;

	    int height = calcMultilineTextHeight(g2d, text, width, rowlimit, maxwidth);
	    if(width == 0 || height == 0){
	    	QueueLog.error(AppLoggers.ErrorLogger, "width:{}, height:{} for text:{}", width, height, text);
	    }
	    
	    BufferedImage bufimg = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
	    Graphics2D g = bufimg.createGraphics();
	    g.setColor(g2d.getColor());
	    g.setFont(g2d.getFont());
	    
	    Font ft = g2d.getFont();
	    AttributedString txt = new AttributedString(text);
		txt.addAttribute(TextAttribute.FONT, ft);
		
	    AttributedCharacterIterator paragraph = txt.getIterator();
	    int paragraphStart = paragraph.getBeginIndex();
	    int paragraphEnd = paragraph.getEndIndex();
	    FontRenderContext frc = g2d.getFontRenderContext();
	    LineBreakMeasurer lineMeasurer = new LineBreakMeasurer(paragraph, frc);
	    
	    int rowcnt = 0;
	    lineMeasurer.setPosition(paragraphStart);
	    while (lineMeasurer.getPosition() < paragraphEnd) {
	        TextLayout layout = lineMeasurer.nextLayout(breakWidth);

	        float drawPosX = layout.isLeftToRight() ? 0 : breakWidth - layout.getAdvance();
	        drawPosY += layout.getAscent();

	        layout.draw(g, drawPosX, drawPosY);

	        drawPosY += layout.getDescent() + layout.getLeading();
	        
	        rowcnt++;
	        if(rowlimit != null && rowcnt >= rowlimit.intValue()){
	        	break;
	        }
	    }
	    g.dispose();
	    
	    return bufimg;
	}
	
	public static BufferedImage drawMultilineText(Font font, Color color, String text, int width, Integer rowlimit, OutParameter<Integer> maxwidth){
		BufferedImage bufimg = new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
		Graphics2D g = bufimg.createGraphics();
		g.setFont(font);
		g.setColor(color);
		
		BufferedImage img = drawMultilineText(g, text, width, rowlimit, maxwidth);
		
		g.dispose();
		return img;
	}
	
	public static BufferedImage drawMultilineText(Font font, Color color, String text, int width){
		return drawMultilineText(font, color, text, width, null, null);
	}
	
	public static int calcTextLineWidth(Font font, String text){
		BufferedImage bufimg = new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
		Graphics2D g = bufimg.createGraphics();
		FontMetrics metrics = g.getFontMetrics(font);
		int w = metrics.stringWidth(text);
		g.dispose();
		return w;
	}
	
	public static int calcHeight(Font font, String text){
		BufferedImage bufimg = new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
		Graphics2D g = bufimg.createGraphics();
		FontMetrics metrics = g.getFontMetrics(font);
		Rectangle2D rect = metrics.getStringBounds(text, g);
		int h = ConvertUtility.getValueAsInt(rect.getHeight());
		g.dispose();
		return h;
	}
	
	public static int calcHeight(Font font, String text, OutParameter<Integer> descend, OutParameter<Integer> ascend){
		BufferedImage bufimg = new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
		Graphics2D g = bufimg.createGraphics();
		FontMetrics metrics = g.getFontMetrics(font);
		Rectangle2D rect = metrics.getStringBounds(text, g);
		int h = ConvertUtility.getValueAsInt(rect.getHeight());
		descend.value = metrics.getDescent();
		ascend.value = metrics.getAscent();
		g.dispose();
		
		return h;
	}
	
	public static float calcChineseTracking(Font font, int margin, String text){
		BufferedImage bufimg = new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
		Graphics2D g = bufimg.createGraphics();
		FontMetrics metrics = g.getFontMetrics(font);
		Rectangle2D sigrect = metrics.getStringBounds(text, 0, 1, g);
		
		double track = margin / sigrect.getWidth();
		g.dispose();
		
		return (float) track;
	}
	
	public static void compress(String fileImg, String destFilename){
		FileType filetype = FileUtility.getFileType(fileImg);
		if(filetype == FileType.JPEG){
			JPGUtility.compress(fileImg, destFilename);
		}else if(filetype == FileType.PNG){
			PNGUtility.compressQuick(fileImg, destFilename);
		}
	}
	
	public static void compress(String fileImg, float JPEGcompression, String destFilename){
		FileType filetype = FileUtility.getFileType(fileImg);
		if(filetype == FileType.JPEG){
			JPGUtility.compress(fileImg, JPEGcompression, destFilename);
		}else if(filetype == FileType.PNG){
			PNGUtility.compressQuick(fileImg, destFilename);
		}
	}
	
	public static void compress(String fileImg){
		FileType filetype = FileUtility.getFileType(fileImg);
		if(filetype == FileType.JPEG){
			JPGUtility.compress(fileImg);
		}else if(filetype == FileType.PNG){
			PNGUtility.compressQuick(fileImg);
		}
	}
	
	public static void compress(String fileImg, float JPEGcompression){
		FileType filetype = FileUtility.getFileType(fileImg);
		if(filetype == FileType.JPEG){
			JPGUtility.compress(fileImg, JPEGcompression);
		}else if(filetype == FileType.PNG){
			PNGUtility.compressQuick(fileImg);
		}
	}
	
	public static byte[] compressJpg(String fileImg, float JPEGcompression) {
		byte[] raw = FileUtility.getBytesFromFile(fileImg);
		return JPGUtility.compress(raw, JPEGcompression);
	}
	
	public static byte[] compressJpgFromBase64(String imgBase64, float JPEGcompression) {
		try {
			byte[] raw = SecurityUtility.fromBase64(imgBase64);
			return JPGUtility.compress(raw, JPEGcompression);
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
		
	}

	public static Mat img2Mat(BufferedImage in) {
        Mat out;
        byte[] data;
        int r, g, b;

        if (in.getType() == BufferedImage.TYPE_INT_RGB) {
            out = new Mat(in.getHeight(), in.getWidth(), CvType.CV_8UC3);
            data = new byte[in.getWidth() * in.getHeight() * (int) out.elemSize()];
            int[] dataBuff = in.getRGB(0, 0, in.getWidth(), in.getHeight(), null, 0, in.getWidth());
            for (int i = 0; i < dataBuff.length; i++) {
                data[i * 3] = (byte) ((dataBuff[i] >> 0) & 0xFF);
                data[i * 3 + 1] = (byte) ((dataBuff[i] >> 8) & 0xFF);
                data[i * 3 + 2] = (byte) ((dataBuff[i] >> 16) & 0xFF);
            }
        } else {
            out = new Mat(in.getHeight(), in.getWidth(), CvType.CV_8UC1);
            data = new byte[in.getWidth() * in.getHeight() * (int) out.elemSize()];
            int[] dataBuff = in.getRGB(0, 0, in.getWidth(), in.getHeight(), null, 0, in.getWidth());
            for (int i = 0; i < dataBuff.length; i++) {
                r = (byte) ((dataBuff[i] >> 0) & 0xFF);
                g = (byte) ((dataBuff[i] >> 8) & 0xFF);
                b = (byte) ((dataBuff[i] >> 16) & 0xFF);
                data[i] = (byte) ((0.21 * r) + (0.71 * g) + (0.07 * b));
            }
        }
        out.put(0, 0, data);
        return out;
    }
	
	public static BufferedImage toGray(BufferedImage bi){
		Mat mat = img2Mat(bi);
		Mat mGray = new Mat(mat.size(), CvType.CV_8UC4);
		Imgproc.cvtColor(mat, mGray, Imgproc.COLOR_BGR2GRAY);
		
		BufferedImage gray = new BufferedImage(mGray.width(), mGray.height(), BufferedImage.TYPE_BYTE_GRAY);
		byte[] data = ((DataBufferByte) gray.getRaster().getDataBuffer()).getData();
		mGray.get(0, 0, data);
		return gray;
	}
	
	public static List<Mat> detectText(Mat img) {
		Mat mRgba = img.clone();
		Mat mGray = new Mat(img.size(), CvType.CV_8UC4);
		Imgproc.cvtColor(img, mGray, Imgproc.COLOR_BGR2GRAY);// 转化成灰度图

		Scalar CONTOUR_COLOR = new Scalar(255);
		
	    MatOfKeyPoint keypoint = new MatOfKeyPoint();
	    List<KeyPoint> listpoint = new ArrayList<KeyPoint>();
	    KeyPoint kpoint = new KeyPoint();
	    Mat mask = Mat.zeros(mGray.size(), CvType.CV_8UC1);
	    int rectanx1;
	    int rectany1;
	    int rectanx2;
	    int rectany2;

	    Scalar zeos = new Scalar(0, 0, 0);
	    List<MatOfPoint> contour2 = new ArrayList<MatOfPoint>();
	    Mat kernel = new Mat(1, 50, CvType.CV_8UC1, Scalar.all(255));
	    Mat morbyte = new Mat();
	    Mat hierarchy = new Mat();

	    Rect rectan3 = new Rect();//
	    int imgsize = mRgba.height() * mRgba.width();
		//
	    MSER detector = MSER.create();
        detector.detect(mGray, keypoint);
        listpoint = keypoint.toList();
        //
        for (int ind = 0; ind < listpoint.size(); ind++) {
            kpoint = listpoint.get(ind);
            rectanx1 = (int) (kpoint.pt.x - 0.5 * kpoint.size);
            rectany1 = (int) (kpoint.pt.y - 0.5 * kpoint.size);
            rectanx2 = (int) (kpoint.size);
            rectany2 = (int) (kpoint.size);
            if (rectanx1 <= 0)
                rectanx1 = 1;
            if (rectany1 <= 0)
                rectany1 = 1;
            if ((rectanx1 + rectanx2) > mGray.width())
                rectanx2 = mGray.width() - rectanx1;
            if ((rectany1 + rectany2) > mGray.height())
                rectany2 = mGray.height() - rectany1;
            Rect rectant = new Rect(rectanx1, rectany1, rectanx2, rectany2);
            Mat roi = new Mat(mask, rectant);
            roi.setTo(CONTOUR_COLOR);
        }
       
        Imgproc.morphologyEx(mask, morbyte, Imgproc.MORPH_DILATE, kernel);
        Imgproc.findContours(morbyte, contour2, hierarchy, Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_NONE);
        
        List<Mat> areas = new LinkedList<Mat>();
        for (int ind = 0; ind < contour2.size(); ind++) {
            rectan3 = Imgproc.boundingRect(contour2.get(ind));
            if(rectan3.area() > 0.5 * imgsize || rectan3.area() < 100 || rectan3.width / rectan3.height < 2) {
                Mat roi = new Mat(morbyte, rectan3);
                roi.setTo(zeos);
            }else{
            	Imgproc.rectangle(mRgba, rectan3.br(), rectan3.tl(), CONTOUR_COLOR);
            	Rect rectCrop = new Rect(rectan3.x, rectan3.y, rectan3.width, rectan3.height);
            	Mat crop = new Mat(mRgba, rectCrop);
            	areas.add(crop);
            }
        }
		
		return areas;
	}
	
	public static int getBright(int c){
		int  r   = (c & 0x00ff0000) >> 16;
		int  g = (c & 0x0000ff00) >> 8;
		int  b  =  c & 0x000000ff;
		int tmp = (int) Math.sqrt(0.241 * r * r + 0.691 * g * g + 0.068 * b * b);
		return tmp;
	}
	
	public static boolean isLight(BufferedImage image){
		int light = 0;
		int dark = 0;
		
		for(int x=0; x<image.getWidth(); x++){
			for(int y=0; y<image.getHeight(); y++){
				int c = image.getRGB(x, y);
				int tmp = getBright(c);
				if(tmp < 130){
					dark++;
				}else{
					light++;
				}
			}
		}
		
		if(light > dark){
			return true;
		}
		
		return false;
	}
	
	public static BufferedImage jointImageByVertical(int gap, BufferedImage... imgs) {
		if(imgs == null) {
			return null;
		}
		int h = 0;
		int w = 0;
		for(BufferedImage img : imgs) {
			if(w < img.getWidth()) {
				w = img.getWidth();
			}
			h = h + gap + img.getHeight();
		}
		Graphics2D graphics = null;
		try {
	    	BufferedImage resimg = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
	    	resimg.createGraphics();
	    	graphics = (Graphics2D) resimg.getGraphics();
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, w, h);
	    	int y = 0;
	    	for(BufferedImage img : imgs) {
	    		int imgh = img.getHeight();
	    		int imgw = img.getWidth();	 
	    		int x = (w-imgw) / 2;
	    		graphics.drawImage(img, x, y, imgw, imgh, null);
	    		y = y + imgh + gap;
	    	}
			return resimg;
		}catch(Exception e) {
			throw new RuntimeException(e);
		}finally{
			if(graphics != null){
				graphics.dispose();
			}
		}
	}
	
	public static BufferedImage jointImage(int gap, int pageWidth, BufferedImage... imgs) {
		if(imgs == null) {
			return null;
		}
		int h = gap;
		int w = gap;
		int twid = gap;
		for(int i=0; i<imgs.length; i++) {
			BufferedImage img = imgs[i];
			int imgw = img.getWidth();
			int imgh = img.getHeight();
			twid = twid + imgw;
			if(twid >= pageWidth) {
				twid = gap + imgw;
				h = h + gap + imgh;
			}else {
				twid = twid + gap;
				if(h == gap) {
					h = h + imgh + gap;
				}
			}
			if(twid > w) {
				w = twid;					
			}
		}
		Graphics2D graphics = null;
		try {
	    	BufferedImage resimg = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
	    	resimg.createGraphics();
	    	graphics = (Graphics2D) resimg.getGraphics();
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, w, h);
	    	int y = gap;
	    	int x = gap;
	    	for(BufferedImage img : imgs) {
	    		int imgh = img.getHeight();
	    		int imgw = img.getWidth();	 
	    		int tmpw = x + imgw;
	    		if(tmpw > pageWidth) {
		    		y = y + imgh + gap;	    
		    		x = gap;
	    		}
	    		graphics.drawImage(img, x, y, imgw, imgh, null);
	    		x = x + imgw + gap ;
	    	}
			return resimg;
		}catch(Exception e) {
			throw new RuntimeException(e);
		}finally{
			if(graphics != null){
				graphics.dispose();
			}
		}		
	}
	
	public static BufferedImage createQRCode(String txt, int size, boolean showStr){
		return createQRCode(txt, size, (BufferedImage)null, showStr);
	}
	
	public static BufferedImage createQRCode(String txt, int size, BufferedImage logo, boolean showStr){
		String codetxt = txt;
		String title = txt;
		int idx = txt.indexOf(QRCodeTitleSeperator);
		if(idx > -1) {
			codetxt = txt.substring(0, idx);	
			title = txt.substring(idx + QRCodeTitleSeperator.length());
		}
		Graphics2D graphics = null;
		try{
            Map<EncodeHintType, Object> hintMap = new HashMap<EncodeHintType, Object>();
            hintMap.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.H);
            hintMap.put(EncodeHintType.CHARACTER_SET, "utf-8");
            hintMap.put(EncodeHintType.MARGIN, 0);
            MultiFormatWriter multiFormatWriter = new MultiFormatWriter();
            BitMatrix byteMatrix = multiFormatWriter.encode(codetxt, BarcodeFormat.QR_CODE, size, size, hintMap);
            int CrunchifyWidth = byteMatrix.getWidth();
            int imgH = CrunchifyWidth;
            BufferedImage image = new BufferedImage(CrunchifyWidth, imgH, BufferedImage.TYPE_INT_RGB);
            image.createGraphics();
            
            graphics = (Graphics2D) image.getGraphics();
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, CrunchifyWidth, CrunchifyWidth);
            graphics.setColor(Color.BLACK);
 
            for (int i = 0; i < CrunchifyWidth; i++) {
                for (int j = 0; j < CrunchifyWidth; j++) {
                    if (byteMatrix.get(i, j)) {
                        graphics.fillRect(i, j, 1, 1);
                    }
                }
            }
            
            if(logo != null){
            	int w = size / 5;
            	graphics.drawImage(logo, w*2, w*2, w, w, null);
            }
            
            if(showStr) {
            	Font font = graphics.getFont().deriveFont((float)30);
            	int strwidth = calcTextLineWidth(font, codetxt);
            	int txtw = strwidth > CrunchifyWidth ? CrunchifyWidth : strwidth;
            	BufferedImage txtImg = ImageUtility.drawMultilineText(font, graphics.getColor(), title, txtw);
            	BufferedImage resimg = jointImageByVertical(20, image, txtImg);
            	return resimg;
            }
            
			return image;
		}catch(Exception e){
			throw new RuntimeException(e);
		}finally{
			if(graphics != null){
				graphics.dispose();
			}
		}
	}
	
	public static BufferedImage createQRCode(String txt, int size, byte[] logo, boolean showStr){
		ByteArrayInputStream ins = new ByteArrayInputStream(logo);
		BufferedImage logoimg = imageFrom(ins);
		return createQRCode(txt, size, logoimg, showStr);
	}
	
	public static BufferedImage createQRCode(String txt, int size, String logofile, boolean showStr){
		if(StringUtility.isNullOrEmpty(logofile)) {
			return createQRCode(txt, size, (BufferedImage)null, showStr);
		}else {
			BufferedImage logoimg = imageFromFile(logofile);
			return createQRCode(txt, size, logoimg, showStr);			
		}
	}
	
	public static BufferedImage createQRCodeWithBase64Logo(String txt, int size, String logob64, boolean showStr){
		if(StringUtility.isNullOrEmpty(logob64)) {
			return createQRCode(txt, size, (BufferedImage)null, showStr);
		}else {
			BufferedImage logoimg = imageFromBase64(logob64);
			return createQRCode(txt, size, logoimg, showStr);			
		}
	}
	
	public static byte[] getQRCode(String txt, int size, String logo, boolean showStr){
		if(StringUtility.isNullOrEmpty(logo)){
			return getQRCode(txt, size, (byte[])null, showStr);
		}else{
			byte[] logoraw = FileUtility.getBytesFromFile(logo);
			return getQRCode(txt, size, logoraw, showStr);
		}
	}
	
	public static byte[] getQRCode(String txt, int size, byte[] logo, boolean showStr){
		try(ByteArrayOutputStream os = new ByteArrayOutputStream()){
			BufferedImage img;
			if(logo != null && logo.length > 0){
				ByteArrayInputStream ins = new ByteArrayInputStream(logo);
				BufferedImage logoimg = imageFrom(ins);
				img = createQRCode(txt, size, logoimg, showStr);
			}else{
				img = createQRCode(txt, size, showStr);
			}
			saveImage(img, os, "png");
			return os.toByteArray();
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] getQRCode(String txt, int size, boolean showStr){
		return getQRCode(txt, size, (byte[])null, showStr);
	}
	
	public static byte[] imageToBytes(BufferedImage img) {
		try(ByteArrayOutputStream os = new ByteArrayOutputStream()){
			saveImage(img, os, "png");
			return os.toByteArray();
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] getQRCode(List<String> txts, int size, String logo, int gap, boolean showStr) {
		if(txts == null || txts.isEmpty()) {
			return null;
		}
		String[] strs = new String[txts.size()];
		txts.toArray(strs);
		return getQRCode(strs, size, logo, gap, showStr);
	}
	
	public static byte[] getQRCode(List<String> txts, int size, String logo, int gap, int pageWidth, boolean showStr) {
		if(txts == null || txts.isEmpty()) {
			return null;
		}
		String[] strs = new String[txts.size()];
		txts.toArray(strs);
		return getQRCode(strs, size, logo, gap, pageWidth, showStr);
	}
	
	public static byte[] getQRCode(String[] txts, int size, String logo, int gap, boolean showStr) {
		BufferedImage[] imgs = new BufferedImage[txts.length];
		int i = 0;
		for(String str : txts) {
			imgs[i] = createQRCode(str, size, logo, showStr);
			i++;
		}
		
		BufferedImage resimg = jointImageByVertical(gap, imgs);
		return imageToBytes(resimg);		
	}
	
	public static byte[] getQRCode(String[] txts, int size, String logo, int gap, int pageWidth, boolean showStr) {
		BufferedImage[] imgs = new BufferedImage[txts.length];
		int i = 0;
		for(String str : txts) {
			imgs[i] = createQRCode(str, size, logo, showStr);
			i++;
		}
		
		BufferedImage resimg = jointImage(gap, pageWidth, imgs);
		return imageToBytes(resimg);		
	}
	
	public static byte[] getQRCodeWithLogoBase64(String[] txts, int size, String logoB64, int gap, int pageWidth, boolean showStr) {
		BufferedImage[] imgs = new BufferedImage[txts.length];
		int i = 0;
		for(String str : txts) {
			imgs[i] = createQRCodeWithBase64Logo(str, size, logoB64, showStr);
			i++;
		}
		
		BufferedImage resimg = jointImage(gap, pageWidth, imgs);
		return imageToBytes(resimg);		
	}
	
    public static String getQRCodeToBase64(String txt, int size, boolean showStr){
    	try{
    		byte[] raw = ImageUtility.getQRCode(txt, size, showStr);
    		return SecurityUtility.base64(raw);
    	}catch(Exception e){
    		e.printStackTrace();
    		return "";
    	}
    }
    
    public static String getQRCodeToBase64(String txt, int size, byte[] logoimg, boolean showStr){
    	try{
    		byte[] raw = ImageUtility.getQRCode(txt, size, logoimg, showStr);
    		return SecurityUtility.base64(raw);
    	}catch(Exception e){
    		e.printStackTrace();
    		return "";
    	}
    }
	
    public static void main(String[] args){
    	createRandomCodeImage(200, 100, "/Users/Shared/file/token");
    	scale("/Users/Shared/file/token.jpg", "/Users/Shared/file/token0", 400, 400);
//    	scaleByHeight("/Users/Shared/file/token.jpg", "/Users/Shared/file/token1", 50);
//    	scaleByWidth("/Users/Shared/file/token.jpg", "/Users/Shared/file/token2", 300);
//    	cut("/Users/Shared/file/token.jpg", "/Users/Shared/file/token3", 160, 80);
    	
//    	createScreenshot("/Users/Shared/file/tsc.png");
    	
    	String[] txt = new String[] {
    			"WLYHXWHYSDE0591DDC-D-4-1", "WLYHXWHYSDE0591DDC-D-WD-5__^title^__现场控制器", "wlyhxwhzx0D0591DDC_D_WD_5"
    	};
    	
    	int sz = 100;
    	String[] strs = new String[sz];
    	for(int i=0; i<sz; i++) {
    		strs[i] = String.format("%s-%d", StringUtility.getUUID(), i);
    	}
    	long ms = System.currentTimeMillis();
    	byte[] qrimg = getQRCode(strs, 600, "/Users/Shared/file/token0.jpg", 40, 2000, true);
    	long ms1 = System.currentTimeMillis();
    	FileUtility.save("/Users/Shared/file/qrimg.png", qrimg);
    	System.out.println(String.format("ms: %d", ms1 - ms));    	
    	    	
    }
    
}
