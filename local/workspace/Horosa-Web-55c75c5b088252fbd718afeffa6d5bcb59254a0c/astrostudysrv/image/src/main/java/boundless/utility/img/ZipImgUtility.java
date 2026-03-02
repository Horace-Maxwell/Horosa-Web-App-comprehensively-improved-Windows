package boundless.utility.img;

import java.io.File;

import boundless.io.CompressUtility;
import boundless.io.FileUtility;	
import boundless.types.FileType;

public class ZipImgUtility {

	public static long compressImages(String zipfile, String newzipfile){
		long st = System.currentTimeMillis();
		
		File destdir = FileUtility.createDirectory(newzipfile);
		String tmpname = String.format("tmp%d", System.currentTimeMillis());
		String tmppath = String.format("%s/%s", destdir.getAbsolutePath(), tmpname);
		
		CompressUtility.unzip(zipfile, tmppath);
		
		FileUtility.iterateFiles(tmppath, (file)->{
			FileType filetype = FileUtility.getFileType(file);
			if(filetype == FileType.JPEG){
				JPGUtility.compress(file.getAbsolutePath());
			}else if(filetype == FileType.PNG){
				PNGUtility.compressQuick(file.getAbsolutePath());
			}
		});
		
		CompressUtility.zip(tmppath, newzipfile);

		System.gc();
		try{
			FileUtility.deleteDirectory(tmppath);
		}catch(Exception e){
			e.printStackTrace();
		}
		
		return System.currentTimeMillis() - st;
	}
	
	public static long compressImages(String zipfile){
		return compressImages(zipfile, zipfile);
	}
	
	public static void main(String[] args){
//		long ms = compressImages("/file/tmp/theAutumn.apt");
		FileType ft = FileUtility.getFileType("/file/tmp/theAutumn.apt");
		
		System.out.println(ft.toString());
	}
	
}
