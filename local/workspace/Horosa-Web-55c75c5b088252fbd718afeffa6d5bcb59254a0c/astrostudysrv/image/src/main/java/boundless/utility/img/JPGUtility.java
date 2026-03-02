package boundless.utility.img;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageTypeSpecifier;
import javax.imageio.ImageWriter;
import javax.imageio.metadata.IIOMetadata;
import javax.imageio.plugins.jpeg.JPEGImageWriteParam;
import javax.imageio.stream.ImageOutputStream;

import com.twelvemonkeys.imageio.plugins.jpeg.JPEGImageWriter;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.StringUtility;


public class JPGUtility {
	
	public static long compress(String jpgfile){
		return compress(jpgfile, 1.0f, null);
	}
	
	public static long compress(String jpgfile, String destFilename){
		return compress(jpgfile, 1.0f, destFilename);
	}
	
	public static long compress(String jpgfile, float JPEGcompression){
		return compress(jpgfile, JPEGcompression, null);
	}

	public static long compress(String jpgfile, float JPEGcompression, String destFilename){
		try{
			long st = System.currentTimeMillis();
			byte[] filedata = FileUtility.getBytesFromFile(jpgfile);
			long delta = System.currentTimeMillis() - st;
			return compress(filedata, jpgfile, JPEGcompression, destFilename) + delta;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static long compress(byte[] filedata, String jpgfile, float JPEGcompression, String destFilename){
		ByteArrayInputStream bis = new ByteArrayInputStream(filedata);
		return compress(bis, filedata.length, jpgfile, JPEGcompression, destFilename);
	}
	
	public static long compress(InputStream fileIns, long filesz, String jpgfile, float JPEGcompression, String destFilename){
		long start = System.currentTimeMillis();
		
		String outputPath = destFilename;
		if(StringUtility.isNullOrEmpty(outputPath)){
			outputPath = jpgfile;
		}
		
		String tmpfile = outputPath;
		FileOutputStream fos = null;
		JPEGImageWriter imageWriter = null;
		ImageOutputStream ios = null;
		try{
			fos = new FileOutputStream(tmpfile);
			BufferedImage image = ImageIO.read(fileIns);
			
			ImageWriter iw = ImageIO.getImageWritersBySuffix("jpg").next();
			imageWriter =  (JPEGImageWriter) iw;
			ios  =  ImageIO.createImageOutputStream(fos);
			imageWriter.setOutput(ios);
			IIOMetadata imageMetaData  =  imageWriter.getDefaultImageMetadata(new ImageTypeSpecifier(image), null);
			
            if(JPEGcompression >= 0 && JPEGcompression <= 1f){
                JPEGImageWriteParam jpegParams  =  (JPEGImageWriteParam) imageWriter.getDefaultWriteParam();
                jpegParams.setCompressionMode(JPEGImageWriteParam.MODE_EXPLICIT);
                jpegParams.setCompressionQuality(JPEGcompression);
            }
            
            imageWriter.write(imageMetaData, new IIOImage(image, null, null), null);
            ios.close();
            imageWriter.dispose();
            
            ios = null;
            imageWriter = null;
            
            File tmp = new File(tmpfile);
            
            long filelen = filesz;
            long tmplen = tmp.length();
            long deltasz = filelen - tmplen;
            double ratio = deltasz * 100.0 / filelen;

            long deltams = System.currentTimeMillis() - start;
			QueueLog.debug(AppLoggers.DebugLogger, String.format("%.2f%% : %dB -> %dB ( %dB saved) - %s", ratio, filelen, tmplen, deltasz, outputPath));
			QueueLog.debug(AppLoggers.DebugLogger, String.format("Processed in %d milliseconds, saving %d bytes", deltams, deltasz));
			
			return deltams;
		}catch(Exception e){
			throw new RuntimeException(e);
		}finally{
			if(ios != null){
				try{
					ios.close();
				}catch(Exception e){
				}
			}
			if(imageWriter != null){
				try{
					imageWriter.dispose();
				}catch(Exception e){
				}
			}
		}
	}
	
	
	public static byte[] compress(byte[] filedata, float JPEGcompression){
		long start = System.currentTimeMillis();
		
		int filesz = filedata.length;
		ByteArrayOutputStream fos = new ByteArrayOutputStream(filesz);
		ByteArrayInputStream fileIns = new ByteArrayInputStream(filedata);
		JPEGImageWriter imageWriter = null;
		ImageOutputStream ios = null;
		try{
			BufferedImage image = ImageIO.read(fileIns);
			
			ImageWriter iw = ImageIO.getImageWritersBySuffix("jpg").next();
			imageWriter =  (JPEGImageWriter) iw;
			ios  =  ImageIO.createImageOutputStream(fos);
			imageWriter.setOutput(ios);
			IIOMetadata imageMetaData  =  imageWriter.getDefaultImageMetadata(new ImageTypeSpecifier(image), null);
			
            if(JPEGcompression >= 0 && JPEGcompression <= 1f){
                JPEGImageWriteParam jpegParams  =  (JPEGImageWriteParam) imageWriter.getDefaultWriteParam();
                jpegParams.setCompressionMode(JPEGImageWriteParam.MODE_EXPLICIT);
                jpegParams.setCompressionQuality(JPEGcompression);
            }
            
            imageWriter.write(imageMetaData, new IIOImage(image, null, null), null);
            
            ios.close();
            imageWriter.dispose();
            
            ios = null;
            imageWriter = null;
            
            byte[] res = fos.toByteArray();
            long tmplen = res.length;
            long filelen = filesz;
            long deltasz = filelen - tmplen;
            
            long deltams = System.currentTimeMillis() - start;
			QueueLog.debug(AppLoggers.DebugLogger, String.format("Processed in %d milliseconds, saving %d bytes", deltams, deltasz));
			
			return res;
		}catch(Exception e){
			throw new RuntimeException(e);
		}finally{
			if(ios != null){
				try{
					ios.close();
				}catch(Exception e){
				}
			}
			if(imageWriter != null){
				try{
					imageWriter.dispose();
				}catch(Exception e){
				}
			}
		}
	}
	
	public static byte[] compressFile(String file, float compressRatio) {
		byte[] raw = FileUtility.getBytesFromFile(file);
		byte[] res = compress(raw, compressRatio);
		return res;
	}
	
	public static void main(String[] args){
		String jpgfile = "/Users/Shared/file/face.jpg";
		byte[] res = compressFile(jpgfile, 0.1f);
		System.out.println(res.length);
	}
	
}
