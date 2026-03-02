package boundless.io;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Random;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

import org.apache.commons.compress.archivers.ArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveInputStream;
import org.apache.commons.compress.archivers.zip.ZipArchiveOutputStream;

import boundless.console.OSinfo;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.security.SecurityUtility;
import boundless.types.FileType;
import boundless.utility.RandomUtility;
import boundless.utility.StringUtility;

/**
 * 压缩工具
 * @author zjf
 *
 */
public class CompressUtility {

	/**
	 * 解压缩字符串
	 * @param compressStr 压缩好的字符串
	 * @return 解压缩后的字符串
	 */
    public static String decompressFromString(String compressStr) throws Exception
    {
    	if(StringUtility.isNullOrEmpty(compressStr)){
    		return "";
    	}
		byte[] raw = SecurityUtility.fromBase64(compressStr);
		return CompressUtility.decompressFromBytes(raw);
    }

    /**
     * 解压缩字符串
     * @param compressBytes 压缩好的字节组
     * @return 解压缩后的字符串
     */
    public static String decompressFromBytes(byte[] compressBytes) throws Exception {
    	if(compressBytes == null || compressBytes.length == 0){
    		return "";
    	}
    	byte[] data = decompressToBytes(compressBytes);
    	return new String(data, "UTF-8");
    }
    
    public static byte[] decompressToBytes(byte[] compressBytes) throws Exception{
    	if(compressBytes == null || compressBytes.length == 0){
    		return new byte[0];
    	}
    	GZIPInputStream gis = null;
    	ByteArrayOutputStream ops = null;
        try
        {
        	ByteArrayInputStream ins = new ByteArrayInputStream(compressBytes);
        	ops = new ByteArrayOutputStream();
        	gis = new GZIPInputStream(ins);
        	
        	byte[] data = new byte[compressBytes.length];
        	int count = gis.read(data);
        	while(count != -1){
        		ops.write(data, 0, count);
        		count = gis.read(data);
        	}
        	byte[] res = ops.toByteArray();
            return res;
        }
        finally
        {
            if (gis != null) {
            	gis.close();
            }
            if(ops != null){
            	ops.close();
            }
        }
    	
    }
    
 
    /**
     * 压缩字符串
     * @param str 要压缩的字符串
     * @return 压缩后的字符串
     */
    public static String compressToString(String str)
    {
    	if(StringUtility.isNullOrEmpty(str)){
    		return "";
    	}
    	try{
        	byte[] raw = compressToBytes(str.getBytes("UTF-8"));
        	return SecurityUtility.base64(raw);
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    /**
     * 压缩字符串
     * @param str 要压缩的字符串
     * @return 压缩后的字节数组
     */
    public static byte[] compressToBytes(byte[] buffer)
    {
    	if(buffer == null || buffer.length == 0){
    		return new byte[0];
    	}
    	
        GZIPOutputStream gops = null;
        try
        {
        	ByteArrayOutputStream ops = new ByteArrayOutputStream();
        	gops = new GZIPOutputStream(ops);
        	gops.write(buffer);
        	gops.finish();
        	gops.flush();
            return ops.toByteArray();
        } catch(Exception ex){
        	ex.printStackTrace();
        	return null;
        }
        finally
        {
            if (gops != null)
				try {
					gops.close();
				} catch (IOException e) {
				}
        }
    }
    
    public static byte[] compressToBytes(String str)
    {
    	if(StringUtility.isNullOrEmpty(str)){
    		return new byte[0];
    	}
        GZIPOutputStream gops = null;
        try
        {
        	byte[] buffer = str.getBytes("UTF-8");
            return compressToBytes(buffer);
        } catch(Exception ex){
        	ex.printStackTrace();
        	return null;
        }
        finally
        {
            if (gops != null)
				try {
					gops.close();
				} catch (IOException e) {
				}
        }
    }
    
    public static String compressToHexString(String str){
    	if(StringUtility.isNullOrEmpty(str)){
    		return "";
    	}
    	byte[] bin = compressToBytes(str);
    	return SecurityUtility.hexString(bin);
    }
    
    public static String decompressFromHexString(String str){
    	if(StringUtility.isNullOrEmpty(str)){
    		return "";
    	}
    	byte[] bin = SecurityUtility.fromHexString(str);
    	try {
			return decompressFromBytes(bin);
		} catch (Exception e) {
			e.printStackTrace();
			return "";
		}
    }

    
    private static boolean isZipFile(String filename){
    	byte[] head =FileUtility.getBytesFromFile(filename, 8);
    	FileType ft = FileType.fromBytes(head);
    	return ft == FileType.ZIP;    	
    }
    
    /**
     * 探测zip文件中的每个文件，当entryHandler返回true时，或所有文件探测完成，停止探测。
     * @param is
     * @param entryHandler
     */
    public static void probe(InputStream is, BiFunction<String, byte[], Boolean> entryHandler){
    	ZipArchiveInputStream zais = null;
    	try{
    		zais = new ZipArchiveInputStream(is);
    		ArchiveEntry archiveEntry = null;
    		boolean stop = false;
    		while((archiveEntry = zais.getNextEntry()) != null && !stop){
    			String entryFileName = archiveEntry.getName();
    			byte[] content = FileUtility.getBytesFromStreamNoClose(zais);
    			try{
    				stop = entryHandler.apply(entryFileName, content);    				
    			}catch(Exception e){
    				QueueLog.error(AppLoggers.ErrorLogger, e);
    			}
    		}
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}finally{
    		try{
    			if(zais != null){
    				zais.close();
    			}
    			if(is != null){
    				is.close();
    			}
    		}catch(Exception e){
    			QueueLog.error(AppLoggers.ErrorLogger, e);
    		}
    	}
    }
    
    public static void probe(String filename, BiFunction<String, byte[], Boolean> entryHandler){
    	InputStream ins = FileUtility.getInputStreamFromFile(filename);
    	probe(ins, entryHandler);
    }

    

    public static void unzip(InputStream is, BiConsumer<String, byte[]> entryHandler){
    	ZipArchiveInputStream zais = null;
    	try{
    		zais = new ZipArchiveInputStream(is);
    		ArchiveEntry archiveEntry = null;
    		while((archiveEntry = zais.getNextEntry()) != null){
    			String entryFileName = archiveEntry.getName();
    			byte[] content = FileUtility.getBytesFromStreamNoClose(zais);
    			try{
    				entryHandler.accept(entryFileName, content);
    			}catch(Exception e){
    				QueueLog.error(AppLoggers.ErrorLogger, e);
    			}
    		}
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}finally{
    		try{
    			if(zais != null){
    				zais.close();
    			}
    			if(is != null){
    				is.close();
    			}
    		}catch(Exception e){
    			QueueLog.error(AppLoggers.ErrorLogger, e);
    		}
    	}
    }

    public static void unzip(InputStream is, String toDir){
    	
    	String topath = toDir;
    	if(!topath.endsWith("/")){
    		topath = topath + "/";
    	}
    	FileUtility.createDirectory(toDir);
    	
    	ZipArchiveInputStream zais = null;
    	try{
    		zais = new ZipArchiveInputStream(is);
    		ArchiveEntry archiveEntry = null;
    		while((archiveEntry = zais.getNextEntry()) != null){
    			String entryFileName = archiveEntry.getName();
    			String entryFilePath = topath + entryFileName;
    			FileUtility.createDirectory(entryFilePath);
    			byte[] content = FileUtility.getBytesFromStreamNoClose(zais);
    			OutputStream os = null;
    			try{
    				File entryFile = new File(entryFilePath);
    				if(entryFile.isDirectory()){
    					if(!entryFile.exists()){
    						entryFile.mkdirs();
    					}
    				}else{
        				os = new FileOutputStream(entryFile);
        				os.write(content);
    				}
    			}catch(Exception e){
    				throw new IOException(e);
    			}finally {
    				if(os != null) {
    					os.flush();
    					os.close();
    				}
    			}
    		}
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}finally{
    		try{
    			if(zais != null){
    				zais.close();
    			}
    			if(is != null){
    				is.close();
    			}
    		}catch(Exception e){
    			QueueLog.error(AppLoggers.ErrorLogger, e);
    		}
    	}
    }
    
    public static void unzip(String filename, String toDir){
    	if(!isZipFile(filename)){
    		throw new RuntimeException("not.zipfile");
    	}
    	File file = new File(filename);
    	if(!file.exists()){
    		throw new RuntimeException("file.noexist");
    	}
    	String topath = toDir;
    	if(!topath.endsWith("/")){
    		topath = topath + "/";
    	}
    	FileUtility.createDirectory(toDir);
   	
    	InputStream is = null;
    	ZipArchiveInputStream zais = null;
    	try{
    		is = new FileInputStream(file);
    		zais = new ZipArchiveInputStream(is);
    		ArchiveEntry archiveEntry = null;
    		while((archiveEntry = zais.getNextEntry()) != null){
    			String entryFileName = archiveEntry.getName();
    			String entryFilePath = topath + entryFileName;
    			FileUtility.createDirectory(entryFilePath);
    			byte[] content = FileUtility.getBytesFromStreamNoClose(zais);
    			OutputStream os = null;
    			try{
    				File entryFile = new File(entryFilePath);
    				os = new FileOutputStream(entryFile);
    				os.write(content);
    			}catch(Exception e){
    				throw new IOException(e);
    			}finally {
    				if(os != null) {
    					os.flush();
    					os.close();
    				}
    			}
    		}
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}finally{
    		try{
    			if(zais != null){
    				zais.close();
    			}
    			if(is != null){
    				is.close();
    			}
    		}catch(Exception e){
    			QueueLog.error(AppLoggers.ErrorLogger, e);
    		}
    	}
    }
    
    public static void zip(String path, String zipfilename){
    	int parentpathlen = path.length();
    	char c = path.charAt(parentpathlen-1);
    	if(c != '/' && c != '\\'){
    		parentpathlen++;
    	}else{
    		if(OSinfo.isWindows()){
    			parentpathlen++;
    		}
    	}
    	final int dirlen = parentpathlen;
    	Map<String, File> files = new HashMap<String, File>();
    	FileUtility.iterateFiles(path, (file)->{
    		String abspath = file.getAbsolutePath();
    		String key = abspath.substring(dirlen);
    		key = key.replace('\\', '/');
    		files.put(key, file);
    	});
    	if(files.isEmpty()){
    		return;
    	}
    	
    	try{
    		FileUtility.createDirectory(zipfilename);
    		File out = new File(zipfilename);
    		ZipArchiveOutputStream zaos = new ZipArchiveOutputStream(out);
    		for(Entry<String, File> entry : files.entrySet()){
    			try{
        			File file = entry.getValue(); 
        			ZipArchiveEntry zae = new ZipArchiveEntry(file, entry.getKey()); 
        			zaos.putArchiveEntry(zae);
        			InputStream is = new FileInputStream(file); 
        			byte[] b = FileUtility.getBytesFromStream(is);
        			zaos.write(b, 0, b.length);
        			zaos.closeArchiveEntry(); 
    			}catch(Exception e){
    				QueueLog.error(AppLoggers.ErrorLogger, e);
    			}
    		}
    		zaos.finish();
    		zaos.close();
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}finally{
    		files.clear();
    	}
    	
    }
    
    
    public static void main(String[] args){
    	try{
//        	String org = RandomUtility.randomString(300);
//        	String compress = compressToHexString(org);
//        	String decompress = decompressFromHexString(compress);
//        	
//        	System.out.println(org);
//        	System.out.println(compress);
//        	System.out.println(decompress);
    		
//    		unzip("/file/tmp/theAutumn.apt", "/file/tmp/autumn/");
    		
//    		zip("/file/tmp/autumn/", "/file/tmp/test.apt");
//    		unzip("/file/tmp/test.apt", "/file/tmp/test/");
    		
    	}catch(Exception e){
    		e.printStackTrace();
    	}
    }
    
}
