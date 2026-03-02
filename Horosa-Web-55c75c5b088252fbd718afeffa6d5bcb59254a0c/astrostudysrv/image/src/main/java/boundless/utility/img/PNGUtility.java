package boundless.utility.img;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStream;

import javax.imageio.ImageIO;
import org.pngquant.PngQuant;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.StringUtility;

public class PNGUtility {
	
	public static long compressQuick(String pngfile){
		return compressQuick(pngfile, null);
	}
	
	public static long compressQuick(String pngfile, String destFilename){
		return compress(pngfile, null, destFilename, null);
	}
	
	public static long compressQuick(String pngfile, Integer compressionLevel, String destFilename){
		return compress(pngfile, compressionLevel, destFilename, null);
	}
	
	public static long compress(String pngfile){
		return compress(pngfile, null);
	}
	
	public static long compress(String pngfile, String destFilename){
		return compress(pngfile, null, destFilename, "zopfli");
	}
	
	public static long compress(String pngfile, Integer compressionLevel, String destFilename){
		return compress(pngfile, compressionLevel, destFilename, "zopfli");
	}
	
	public static long compress(String pngfile, Integer compressionLevel, String destFilename, String compressor){
		try{
			long start = System.currentTimeMillis();

			String outputPath = destFilename;
			if(StringUtility.isNullOrEmpty(outputPath)){
				outputPath = pngfile;
			}
			
			Boolean removeGamma = false;
			String logLevel = "debug";
			Integer iterations = 32;

			PngOptimization optimizer = new PngOptimization(logLevel);
			optimizer.setCompressor(compressor, iterations);

			byte[] filedata = FileUtility.getBytesFromFile(pngfile);
			optimizer.optimize(filedata, outputPath, removeGamma, compressionLevel);
			
			long deltams = System.currentTimeMillis() - start;
			QueueLog.debug(AppLoggers.DebugLogger, String.format("Processed %d files in %d milliseconds, saving %d bytes", optimizer.getResults().size(), deltams, optimizer.getTotalSavings()));
			
			return deltams;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static long compressByQuantProcess(String quandcmdpath, String pngfile, String destFilename){
		long start = System.currentTimeMillis();
		StringBuilder cmd = new StringBuilder(quandcmdpath);
		try{
			if(StringUtility.isNullOrEmpty(destFilename)){
				cmd.append(" ").append(pngfile);
			}else{
				cmd.append(" -o ").append(destFilename).append(" ").append(pngfile);
			}
			Process p = Runtime.getRuntime().exec(cmd.toString());
			p.waitFor();
			p.destroy();
			return System.currentTimeMillis() - start;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
		
	}
	
	public static long compressByQuantProcess(String quandcmdpath, byte[] raw, String destFilename){
		long start = System.currentTimeMillis();
		File dir = FileUtility.createDirectory(destFilename);
		String tmp = String.format("%s/%d", dir.getAbsolutePath(), System.nanoTime());
		FileUtility.save(tmp, raw);

		compressByQuantProcess(quandcmdpath, tmp, destFilename);
		
		FileUtility.delete(tmp);
		
		return System.currentTimeMillis() - start;
	}
	
	public static long compressByQuantLib(String pngfile, String destFilename){
		long start = System.currentTimeMillis();
		String outputPath = destFilename;
		if(StringUtility.isNullOrEmpty(outputPath)){
			outputPath = pngfile;
		}
		
		try{
			byte[] raw = FileUtility.getBytesFromFile(pngfile);
			compressByQuantLib(raw, outputPath);
			
			return System.currentTimeMillis() - start;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static long compressByQuantLib(byte[] filedata, String destFilename){
		ByteArrayInputStream bis = new ByteArrayInputStream(filedata);
		return compressByQuantLib(bis, destFilename);
	}
	
	public static long compressByQuantLib(InputStream fileIns, String destFilename){
		long start = System.currentTimeMillis();
		
		try{
			BufferedImage orgimg = ImageIO.read(fileIns);
			
			PngQuant pngquant = new PngQuant();
			BufferedImage resimg = pngquant.getRemapped(orgimg);
			
			File outputfile = new File(destFilename);
			ImageIO.write(resimg, "png", outputfile);
			
			long deltams = System.currentTimeMillis() - start;
			return deltams;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static void main(String[] args){
		String pngfile = "/file/tmp/galaxy1.png";
		String destfile = "/file/tmp/galaxy3.png";
		compressQuick(pngfile, destfile);
	}
}
