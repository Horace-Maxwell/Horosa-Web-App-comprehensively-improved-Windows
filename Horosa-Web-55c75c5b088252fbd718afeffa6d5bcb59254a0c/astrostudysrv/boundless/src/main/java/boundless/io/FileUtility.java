package boundless.io;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.RandomAccessFile;
import java.io.StringReader;
import java.io.UnsupportedEncodingException;
import java.net.JarURLConnection;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.FileTime;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Properties;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.regex.Pattern;

import org.apache.commons.io.FileUtils;
import org.apache.tika.detect.Detector;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.mime.MediaType;
import org.apache.tika.parser.AutoDetectParser;

import boundless.console.ApplicationUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.security.MD5Utility;
import boundless.types.FileType;
import boundless.types.OutParameter;
import boundless.utility.StringUtility;

public final class FileUtility {
		
	/**
	 * 合并路径
	 * @param path
	 * @return
	 */
	public static String combinePath(String ... path){
		StringBuilder sb = new StringBuilder();
		if(path.length >= 1){
			String str = path[0];
			char c = str.charAt(0);
			if(c == '\\' || c == '/'){
				sb.append('/');
			}
		}
		int cnt = 0;
		for(String str : path){
			int endIndex = str.length() - 1;
			for (; endIndex >= 0; endIndex--) {
				char c = str.charAt(endIndex);
				if (c != '/' && c != '\\')
					break;
			}
			if (endIndex != str.length() - 1)
				str = str.substring(0, endIndex + 1);
			
			int startIndex = 0;
			for (; startIndex < str.length(); startIndex++) {
				char c = str.charAt(startIndex);
				if (c != '/' && c != '\\')
					break;
			}
			if (startIndex != 0)
				str = str.substring(startIndex);
			
			sb.append(str);
			if(cnt < path.length - 1){
				sb.append("/");
			}
			cnt++;
		}
		
		return sb.toString();
	}
	
	/**
	 * 删除目录，如果目录非空，则删除目录下的所有文件，最后再把此目录删除
	 * @param dir
	 */
	public static void deleteDirectory(File dir){
		if(!dir.isDirectory() || !dir.exists()){
			return;
		}
		
		for(File file : dir.listFiles()){
			if(file.isFile()){
				Path path = Paths.get(file.getAbsolutePath());
				try {
					Files.delete(path);
				} catch (IOException e) {
					e.printStackTrace();
				}
			}else if(file.isDirectory()){
				deleteDirectory(file);
			}
		}
		dir.delete();
	}
	
	public static void deleteOnlyFiles(File dir){
		if(!dir.isDirectory() || !dir.exists()){
			return;
		}
		
		for(File file : dir.listFiles()){
			if(file.isFile()){
				Path path = Paths.get(file.getAbsolutePath());
				try {
					Files.delete(path);
				} catch (IOException e) {
					e.printStackTrace();
				}
			}else if(file.isDirectory()){
				deleteOnlyFiles(file);
			}
		}
	}
	
	public static void deleteOnlyFiles(String dir){
		if(StringUtility.isNullOrEmpty(dir)){
			return;
		}
		File dfile = new File(dir);
		deleteOnlyFiles(dfile);
	}
	
	/**
	 * 删除目录，如果目录非空，则删除目录下的所有文件，最后再把此目录删除
	 * @param dirName 目录名
	 */
	public static void deleteDirectory(String dirName){
		File dir  = new File(dirName);
		deleteDirectory(dir);
	}
	
	/**
	 * 删除文件
	 * @param filename 文件名
	 * 
	 */
	public static void deleteFile(String filename){
		Path path = Paths.get(filename);
		
		try {
			Files.delete(path);
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	/**
	 * 删除文件或目录
	 * @param filename
	 */
	public static void delete(String filename){
		if(StringUtility.isNullOrEmpty(filename)){
			return;
		}
		File file = new File(filename);
		if(file.isFile()){
			file.delete();
			return;
		}
		deleteDirectory(filename);
	}
	
	/**
	 * 获取文件中的字串
	 * @param fileName 完整的文件路径
	 * @return
	 */
    public static String getStringFromFile(String fileName)
    {
        return getStringFromFile(fileName, "UTF-8");
    }
	
    /**
     * 获取文件中的字串
     * @param fileName 完整的文件路径
     * @param encoding 读取文件的编码方式
     * @return
     */
    public static String getStringFromFile(String fileName, String encoding)
    {
    	File file = new File(fileName);
        if (!file.exists()) return "";
        
        try{
        	byte[] res = getBytesFromFile(fileName);
        	return new String(res, encoding);
        }catch(Exception e) { 
        	return ""; 
        }
    }
    
    public static String getStringFromFile(File file, String encoding) {
        if (!file.exists()) return "";
        
        try{
        	byte[] res = getBytesFromFile(file.getAbsolutePath());
        	return new String(res, encoding);
        }catch(Exception e) { 
        	return ""; 
        }
    	
    }
    
    public static String getStringFromPath(String path, String encoding){
    	try{
        	byte[] raw = getBytesFromPath(path);
        	return new String(raw, encoding);
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    public static String getStringFromPath(String path){
    	return getStringFromPath(path, "UTF-8");
    }
    
    public static String getStringFromClassPath(String path, String encoding){
    	try{
        	byte[] raw = getBytesFromClassPath(path);
        	return new String(raw, encoding);
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static String getStringFromClassPath(String path){
    	return getStringFromClassPath(path, "UTF-8");
    }
    
    public static boolean exists(String fileName){
    	File file = new File(fileName);
    	return file.exists();
    }
	
    public static long getFileSize(String fileName){
    	File file = new File(fileName);
    	if(file.isDirectory()) {
    		return FileUtils.sizeOfDirectory(file);
    	}
    	
    	return file.length();
    }
    
    public static long getFileSize(File file){
    	if(file.isDirectory()) {
    		return FileUtils.sizeOfDirectory(file);
    	}
    	
    	return file.length();
    }
    
    public static void readTextFile(String fileName, String encoding, Consumer<String> lineconsumer){
    	BufferedReader reader = null;
    	try{
    		if(!exists(fileName)){
    			QueueLog.warn(AppLoggers.WarnLogger, "no find file: {}", fileName);
    			return;
    		}
    		FileInputStream fis = new FileInputStream(fileName); 
    		InputStreamReader isr = new InputStreamReader(fis, encoding); 
    		reader = new BufferedReader(isr);
    		String line = null;
    		while((line = reader.readLine()) != null){
    			try{
        			lineconsumer.accept(line);
    			}catch(Exception e){
    				QueueLog.error(AppLoggers.ErrorLogger, e);
    			}
    		}
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}finally{
    		if (reader != null){
    			try {
					reader.close();
				} catch (IOException e) {
					QueueLog.error(AppLoggers.ErrorLogger, e);
				}
    		}
    	}
    }
    
    public static void readTextFile(String fileName, Consumer<String> lineconsumer){
    	readTextFile(fileName, "UTF-8", lineconsumer);
    }
    
    public static void readText(InputStream ins, String encoding, Consumer<String> lineconsumer){
       	BufferedReader reader = null;
    	try{
    		InputStreamReader isr = new InputStreamReader(ins, encoding); 
    		reader = new BufferedReader(isr);
    		String line = null;
    		while((line = reader.readLine()) != null){
    			try{
        			lineconsumer.accept(line);
    			}catch(Exception e){
    				QueueLog.error(AppLoggers.ErrorLogger, e);
    			}
    		}
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}finally{
    		if (reader != null){
    			try {
					reader.close();
				} catch (IOException e) {
					QueueLog.error(AppLoggers.ErrorLogger, e);
				}
    		}
    	}
    }
    
    public static void readTextFileFromClassPath(String classpath, String encoding, Consumer<String> lineconsumer){
       	BufferedReader reader = null;
    	try{
        	InputStream ins = getInputStreamFromClassPath(classpath); 
        	readText(ins, encoding, lineconsumer);
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}finally{
    		if (reader != null){
    			try {
					reader.close();
				} catch (IOException e) {
					QueueLog.error(AppLoggers.ErrorLogger, e);
				}
    		}
    	}
    }
    
    public static void readTextFileFromClassPath(String classpath, Consumer<String> lineconsumer){
    	readTextFileFromClassPath(classpath, "UTF-8", lineconsumer);
    }
    
    /**
     * 从文件读取字节
     * @param fileName 完整的文件路径
     * @return
     */
    public static byte[] getBytesFromFile(String fileName){
        FileInputStream fs = null;
        try
        {
        	File file = new File(fileName);
            fs = new FileInputStream(file);
            int len = (int) file.length();
            byte[] result = new byte[len];
            fs.read(result, 0, result.length);
            return result;
        }catch(Exception e){
        	throw new RuntimeException(e);
        }finally{
            if (fs != null){
            	try{
                	fs.close();
            	}catch(Exception e){
            		QueueLog.error(AppLoggers.ErrorLogger, e);
            	}
            }
        }
    }
    
    public static byte[] getBytesFromFile(String fileName, int length){
        FileInputStream fs = null;
        try
        {
        	File file = new File(fileName);
            fs = new FileInputStream(file);
            int len = (int) file.length();
            byte[] result = new byte[len > length ? length : len];
            fs.read(result, 0, result.length);
            return result;
        }catch(Exception e){
        	throw new RuntimeException(e);
        }finally{
            if (fs != null){
            	try{
                	fs.close();
            	}catch(Exception e){
            		QueueLog.error(AppLoggers.ErrorLogger, e);
            	}
            }
        }
    }
    
    public static byte[] getBytesFromFile(File file){
        FileInputStream fs = null;
        try{
            fs = new FileInputStream(file);
            int len = (int) file.length();
            byte[] result = new byte[len];
            fs.read(result, 0, result.length);
            return result;
        }catch(Exception e){
        	throw new RuntimeException(e);
        }finally{
            if (fs != null){
            	try{
                	fs.close();
            	}catch(Exception e){
            		QueueLog.error(AppLoggers.ErrorLogger, e);
            	}
            }
        }
    }
    
    public static byte[] getBytesFromStreamNoClose(InputStream inStream) throws Exception{
    	if(inStream == null){
    		return new byte[0];
    	}
	    ByteArrayOutputStream outSteam = new ByteArrayOutputStream();  
	    try
	    {
		    byte[] buffer = new byte[10240];  
		    int len = -1;  
		    while ((len = inStream.read(buffer)) != -1) {  
		        outSteam.write(buffer, 0, len);  
		    }  
	    }finally{
	    	outSteam.close();  
	    }
	  
	    return outSteam.toByteArray();  
    }
    
    public static byte[] getBytesFromStream(InputStream inStream){
    	try{
        	byte[] res = getBytesFromStreamNoClose(inStream);
        	inStream.close();
        	
        	return res;
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    private static ClassLoader getClassLoader(){
    	ClassLoader loader = FileUtility.class.getClassLoader();
//    	ClassLoader loader = ApplicationUtility.getMainClass().getClassLoader();    		
    	return loader;
    }
    
    public static byte[] getBytesFromClassPath(String classpath) throws Exception{
		String protocol = "";
		String path = "";
		if(classpath.contains(":")){
			String[] parts = classpath.split(":");
			protocol = parts[0];
			path = parts[1];
		}else{
			path = classpath;
		}
		
		if(path.startsWith("/")){
			path = path.substring(1);
		}
		
		ClassLoader loader = getClassLoader();
		InputStream in = loader.getResourceAsStream(path);
		return getBytesFromStream(in);
    }
    
    public static InputStream getInputStreamFromClassPath(String classpath){
    	try{
    		String protocol = "";
    		String path = "";
    		if(classpath.contains(":")){
    			String[] parts = classpath.split(":");
    			protocol = parts[0];
    			path = parts[1];
    		}else{
    			path = classpath;
    		}
    		
    		if(path.startsWith("/")){
    			path = path.substring(1);
    		}
    		
    		ClassLoader loader = getClassLoader();
    		InputStream in = loader.getResourceAsStream(path);
    		return in;
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static InputStream getInputStreamFromFile(String filename){
    	try{
    		File file = new File(filename);
    		InputStream ins = new FileInputStream(file);
    		return ins;
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static byte[] getBytesFromPath(String cfpath) throws Exception{
		String protocol = "";
		String path = "";
		if(cfpath.contains(":")){
			String[] parts = cfpath.split(":");
			protocol = parts[0];
			path = parts[1];
		}else{
			path = cfpath;
		}
		
		InputStream in;
		if("classpath".equalsIgnoreCase(protocol)){
			if(path.startsWith("/")){
				path = path.substring(1);
			}
			ClassLoader loader = getClassLoader();
			in = loader.getResourceAsStream(path);
		}else{
			in = new BufferedInputStream(new FileInputStream(path));
		}
		
		return getBytesFromStream(in);
    }
    
    /**
     * 创建文件所在的文件夹
     * @param filename
     * @return 目录对应的java.io.File对象
     */
    public static File createDirectory(String filename){
        if (filename == null || filename.trim() == ""){
            return null;
        }
        if(filename.endsWith("/")){
        	File dir = new File(filename);
        	if(!dir.exists()){
        		dir.mkdirs();
        	}
        	return dir;
        }
        
        String dir = getDirectory(filename);
        if(dir == null || dir.equals("")){
        	return null;
        }
        
        File file = new File(dir);
        if(!file.exists()){
        	file.mkdirs();
        }
        
        return file;
    }
    
    /**
     * 获得文件所在目录
     * @param filename
     * @return
     */
    public static String getDirectory(String filename)
    {
        if (filename == null || filename.trim() == "")
            return "";
        
        int index1 = filename.lastIndexOf("\\");
        int index2 = filename.lastIndexOf("/");
        if (index1 < index2) index1 = index2;
        
        return filename.substring(0, index1);
    }

    /**
     * 保存文件。如果文件存在会覆盖，如果不存在会新增
     * @param filename 文件名(含全路径)
     * @param data 数据
     */
    public static void save(String filename, String data)
    {
        save(filename, data, "UTF-8");
    }
    
    /**
     * 保存字符串到指定的文件
     * @param filename 文件名(含全路径)
     * @param data 数据
     * @param encode 编码方式
     */
    public static void save(String filename, String data, String encode) 
    {
        createDirectory(filename);
        byte[] raw = null;
		try {
			raw = data.getBytes(encode);
		} catch (UnsupportedEncodingException e) {
			throw new RuntimeException(e);
		}
        save(filename, raw);
    }
    
    public static void save(String filename, InputStream inStream){
    	createDirectory(filename);
    	File destfile = new File(filename);
    	BufferedOutputStream outSteam = null;
	    try{
	    	outSteam = new BufferedOutputStream( new FileOutputStream(destfile) );  
		    byte[] buffer = new byte[10240];  
		    int len = -1;  
		    while ((len = inStream.read(buffer)) != -1) {  
		        outSteam.write(buffer, 0, len);  
		    }  
		    outSteam.flush();
	    }catch(Exception e){
	    	throw new RuntimeException(e);
	    }finally{
	    	try{
	    		if(outSteam != null){
	    	    	outSteam.close();  
	    		}
	    		inStream.close();
	    	}catch(Exception e){
	    	}
	    }
   	
    }
 
    /**
     * 保存数据到指定的文件
     * @param filename 文件名(含全路径)
     * @param data 数据
     */
    public static void save(String filename, byte[] data)
    {
    	if(data == null){
    		return;
    	}
        FileOutputStream fs = null;
        try
        {
            createDirectory(filename);
            fs = new FileOutputStream(new File(filename));
            fs.write(data, 0, data.length);
            fs.flush();
            fs.close();
        }
        catch (Exception ex)
        {
            if (fs != null)
            {
                try {
					fs.flush();
				} catch (IOException e) {
					e.printStackTrace();
				}
            }
        }finally{
        	if(fs != null){
        		try {
					fs.close();
				} catch (IOException e) {
					e.printStackTrace();
				}
        	}
        }
    }

    /**
     * 获得文件扩展名
     * @param fileName
     * @return
     */
    public static String getExtName(String fileName)
    {
        int index = fileName.lastIndexOf(".");
        if (index <= 0 || index == fileName.length() - 1) return "";
        return fileName.substring(index + 1);
    }


    /**
     * 去掉路径，仅留文件名
     * @param fileName
     * @return
     */
    public static String trimFilePath(String fileName)
    {
        if (fileName == null || fileName.trim().equals("")) return "";
        
        int index1 = fileName.lastIndexOf("\\");
        int index2 = fileName.lastIndexOf("/");
        if (index1 < index2) index1 = index2;
        if (index1 < 0) return fileName;
        return fileName.substring(index1 + 1, fileName.length() - index1 - 1);
    }
    
    /**
     * 判断文件是否是图片类型的文件
     * @param fileName
     * @return
     */
    public static boolean isImageFile(String fileName)
    {
        String extName = getExtName(fileName).toUpperCase();
        return extName.equals("BMP") || extName.equals("JPG") || extName.equals("JPEG") ||
            extName.equals("GIF") || extName.equals("PNG") || extName.equals("TIF");
    }

    /**
     * 使文件名合法化
     * @param fileName 文件名
     * @param replaceStr 不合法符号的替换字符串
     * @return 合法化后的文件名
     */
    public static String makeFileNameLegal(String fileName, String replaceStr)
    {
        char[] errorChars = new char[] { '\\', '/', ':', '*', '?', '"', '<', '>', '|', '\t', '\r', '\n' };
        for (int i = 0; i < errorChars.length; i++) 
        	fileName = fileName.replace(errorChars[i] + "", replaceStr);
        
        if (fileName == "") return "_";
        if (fileName.indexOf('.') == 0) return "_" + fileName;
        return fileName;
    }

    /**
     * 获取目录下的指定扩展名的文件列表
     * @param path 指定目录
     * @param fileExt 文件扩展名，不含'.'号
     * @return
     */
    public static File[] getFiles(String path, String fileExt){
    	File dir = new File(path);
    	if(!dir.exists()){
    		dir.mkdirs();
    	}
    	File[] res = dir.listFiles((dirFile, fileName) -> {
    		return fileName.endsWith("." + fileExt);
    	});
    	
    	return res;
    }
    
    public static String getFileNameWithoutExtension(File file){
    	String name = file.getName();
    	String[] parts = name.split("\\.");
    	if(parts.length >= 1){
    		return parts[0];
    	}else if(parts.length == 0){
    		return "";
    	}
    	return "";
    }
    
    public static String getFileNameWithoutExtension(String fileName){
    	return getFileNameWithoutExtension(new File(fileName));
    }
    
    /**
     * 查找文件夹下匹配的文件名称列表
     * @param path 文件夹
     * @param searchPattern 匹配方式
     * @return 文件名称列表(不好好路径)
     */
    public static String[] searchFiles(String path, String searchPattern){
    	searchPattern = searchPattern.replace('.', '#');  
    	searchPattern = searchPattern.replaceAll("#", "\\\\."); 
    	searchPattern = searchPattern.replace('*', '#');  
    	searchPattern = searchPattern.replaceAll("#", ".*"); 
    	searchPattern = searchPattern.replace('?', '#');  
    	searchPattern = searchPattern.replaceAll("#", ".?"); 
    	searchPattern = "^" + searchPattern + "$"; 
        
        Pattern p = Pattern.compile(searchPattern); 
        return new File(path).list((File paramFile, String paramString)->{
        	return p.matcher(paramString).matches(); 
        });
    }

    public static String[] listFileName(String path, String regex){
    	Pattern p = Pattern.compile(regex); 
        return new File(path).list((File paramFile, String paramString)->{
        	return p.matcher(paramString).matches(); 
        });
    }
    

    /**
     * 获得文件夹下的子文件夹列表
     * @param path
     * @return 子文件夹绝对路径列表
     */
    public static String[] getSubdirectories(String path){
    	List<String> list=new ArrayList<String>();
    	for(File f: new File(path).listFiles()){
    		if (f.isDirectory()) list.add(f.getAbsolutePath());
    	}
    	String[] result=new String[list.size()];
    	list.toArray(result);
    	return result;
    }
    
    public static void append(String filename, byte[] data){
    	if(data == null || data.length == 0){
    		return;
    	}
    	RandomAccessFile raf = null;
    	try{
            createDirectory(filename);
            File file=new File(filename);
            raf = new RandomAccessFile(file,"rw");
            raf.seek(raf.length());
            raf.write(data);
            
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}finally{
    		if(raf != null) {
    			try {
					raf.close();
				} catch (IOException e1) {
					e1.printStackTrace();
				}
    		}
    	}
    }

    public static void append(String filename, byte[] data, int offset, int length){
    	if(data == null || data.length == 0 || offset >= data.length){
    		return;
    	}
    	RandomAccessFile raf = null;
    	try{
            createDirectory(filename);
            File file=new File(filename);
            raf = new RandomAccessFile(file,"rw");
            raf.seek(raf.length());
            raf.write(data, offset, length);
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}finally{
    		if(raf != null) {
    			try {
					raf.close();
				} catch (IOException e1) {
					e1.printStackTrace();
				}
    		}
    	}
    }
    
    public static Properties getProperties(String proppath){
    	return getProperties(proppath, getClassLoader());
    }
    
    public static Properties getProperties(String proppath, ClassLoader loader){
    	return getProperties(proppath, loader, "UTF-8");
    }
    
    public static Properties getProperties(String proppath, ClassLoader loader, String encoding){
    	try{
    		Properties p = new Properties();
    		InputStream in = null;
    		String protocol = "";
    		String path = proppath;
    		String tmpstr = proppath.toLowerCase();
    		if(tmpstr.startsWith("classpath:")) {
    			protocol = "classpath";
    			path = path.substring("classpath:".length());    			
    		}else if(tmpstr.startsWith("file:")) {
    			protocol = "file";
    			path = path.substring("file:".length());    			
    		}
    		
    		if("classpath".equalsIgnoreCase(protocol)){
    			if(path.startsWith("/")){
    				path = path.substring(1);
    			}
    			in = loader.getResourceAsStream(path);
    		}else{
    			in = new FileInputStream(path);
    		}
    		byte[] raw = getBytesFromStream(in);
    		String txt = new String(raw, encoding);
    		StringReader reader = new StringReader(txt);
    		p.load(reader);
    		return p;
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }

    public static void iterateFiles(File file, Consumer<File> filefun, Consumer<File> dirfun){
		if(!file.exists()){
			return;
		}
    	if(file.isFile()){
    		if(filefun != null){
        		filefun.accept(file);
    		}
    		return;
    	}
    	for(File f : file.listFiles()){
    		if(f.isDirectory()){
    			if(dirfun != null){
	    			dirfun.accept(f);
    			}
    			if(f.exists()){
        			iterateFiles(f, filefun, dirfun);
    			}
    		}else if(f.isFile()){
        		if(filefun != null){
            		filefun.accept(f);
        		}
    		}
    	}
    }
    
    private static void iterateFiles(File file, Consumer<File> filefun, Consumer<File> dirfun, int level, int currentLevel){
		if(!file.exists()){
			return;
		}
    	if(file.isFile()){
    		if(filefun != null){
        		filefun.accept(file);
    		}
    		return;
    	}
    	for(File f : file.listFiles()){
    		if(f.isDirectory()){
    			if(dirfun != null){
	    			dirfun.accept(f);
    			}
    			if(f.exists() && currentLevel < level){
        			iterateFiles(f, filefun, dirfun, level, currentLevel+1);
    			}
    		}else if(f.isFile()){
        		if(filefun != null){
            		filefun.accept(f);
        		}
    		}
    	}
    }
    
    public static void iterateFiles(File file, Consumer<File> filefun, Consumer<File> dirfun, int level) {
    	iterateFiles(file, filefun, dirfun, level, 1);
    }
    
    public static void iterateFilesByFunc(String path, Function<File, Boolean> filefun){
    	iterateFilesByFunc(path, filefun, null);
    }
    
    public static void iterateFilesByFunc(String path, Function<File, Boolean> filefun, Function<File, Boolean> dirfun){
    	File file = new File(path);
    	if(file.exists()){
    		iterateFilesByFunc(file, filefun, dirfun);
    	}
    }
    
    public static void iterateFilesByFunc(File file, Function<File, Boolean> filefun, Function<File, Boolean> dirfun){
    	if(!file.exists()){
    		return;
    	}
    	if(file.isFile()){
    		if(filefun != null){
        		filefun.apply(file);
    		}
    		return;
    	}
    	boolean stop = false;
    	for(File f : file.listFiles()){
    		if(stop){
    			continue;
    		}
    		if(f.isDirectory()){
    			if(dirfun != null){
	    			stop = dirfun.apply(f);
    			}
    			if(!stop && f.exists()){
        			iterateFilesByFunc(f, filefun, dirfun);
    			}
    		}else if(f.isFile()){
        		if(filefun != null){
            		stop = filefun.apply(f);
        		}
    		}
    	}
    	
    	
    }

    public static void iterateJarFiles(String prefix, JarFile file, Function<String, Boolean> classfun, Function<String, Boolean> pkgfun){
    	Enumeration<JarEntry> jarEntries = file.entries(); 
    	String pkgname = prefix;
    	if(!pkgname.endsWith("/")) {
    		pkgname = pkgname + "/";
    	}
    	QueueLog.debug(AppLoggers.InfoLogger, "jarfile:{}", file.getName());
    	try {
            while (jarEntries.hasMoreElements()) {  
                JarEntry jarEntry = jarEntries.nextElement(); 
                String jarEntryName = jarEntry.getName();  
                if(!jarEntryName.startsWith(pkgname) || jarEntryName.equals(pkgname)) {
                	continue;
                }
                QueueLog.debug(AppLoggers.InfoLogger, "pkgname:{}, entryName:{}", pkgname, jarEntryName);
                
            	boolean stop = false;
                if(!jarEntry.isDirectory()) {
                	if(classfun	!= null) {
                		stop = classfun.apply(jarEntryName);  
                	}                	
                }else {
                	if(pkgfun != null) {
                		stop = pkgfun.apply(jarEntryName);
                	}
                }
                if(stop) {
                	return;
                }
            }  
    		
    	}catch(Exception e) {
    		throw new RuntimeException(e);
    	}

    	
    }
    
    public static void iteratePackage(String classpath, Function<Object, Boolean> filefun) {
    	iteratePackage(classpath, filefun, null);
    }
        
    public static void iteratePackage(String classpath, Function<Object, Boolean> filefun, Function<Object, Boolean> dirfun) {
    	ClassLoader classLoader = getClassLoader();
    	URL url = classLoader.getResource(classpath.replace(".", "/"));
    	String protocol = url.getProtocol(); 
    	QueueLog.debug(AppLoggers.InfoLogger, "url: {}", url.toString());
    	try {
        	if ("file".equals(protocol)) {    
        		File file = new File(url.toURI());  
        		iterateFilesByFunc(file, (fileobj)->{
        			boolean stop = false;
        			if(filefun != null) {
        				stop = filefun.apply(fileobj);
        			}
        			return stop;
        		}, (fileobj)->{
        			boolean stop = false;
        			if(dirfun != null) {
        				stop = dirfun.apply(fileobj);
        			}
        			return stop;
        		});  
            } else if ("jar".equals(protocol)) {   
            	JarURLConnection jarURLConnection  = (JarURLConnection )url.openConnection();  
            	JarFile jarFile = jarURLConnection.getJarFile();
            	iterateJarFiles(classpath, jarFile, (classPath)->{
            		boolean stop = false;
            		if(filefun != null) {
            			stop = filefun.apply(classPath);
        			}  
            		return stop;
            	}, (classPath)->{
            		boolean stop = false;
        			if(dirfun != null) {
        				stop = dirfun.apply(classPath);
        			}
        			return stop;
            	});
            }       		
    	}catch(Exception e) {
    		throw new RuntimeException(e);
    	}
    }
    
    public static void iterateFiles(String path, Consumer<File> filefun, Consumer<File> dirfun){
    	File file = new File(path);
    	if(file.exists()){
			iterateFiles(file, filefun, dirfun);
    	}else{
    		QueueLog.error(AppLoggers.ErrorLogger, "file no exists");
    	}
    }
    
    public static void iterateFiles(String path, Consumer<File> filefun, Consumer<File> dirfun, int level){
    	File file = new File(path);
    	if(file.exists()){
			iterateFiles(file, filefun, dirfun, level);
    	}else{
    		QueueLog.error(AppLoggers.ErrorLogger, "file no exists");
    	}
    }
    
    public static void iterateFiles(File file, Consumer<File> filefun){
    	iterateFiles(file, filefun, null);
    }
    
    public static void iterateFiles(String path, Consumer<File> filefun){
    	iterateFiles(path, filefun, null);
    }
    
    public static FileType getFileType(String filename){
    	File file = new File(filename);
    	return getFileType(file);
    }
    
    public static FileType getFileType(File file){
    	if(!file.exists()){
    		throw new RuntimeException("file not exists");
    	}
    	if(file.isDirectory()){
    		return FileType.DIR;
    	}
    	InputStream ins = null;
    	try{
    		ins = new FileInputStream(file);
    		byte[] b = new byte[4];
    		ins.read(b);
    		return FileType.fromBytes(b);
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}finally{
    		if(ins != null){
    			try {
					ins.close();
				} catch (IOException e) {
					e.printStackTrace();
				}
    		}
    	}
    }
    
    public static void moveFile(String orgfile, String destfile){
    	try{
    		createDirectory(destfile);
    		File orgf = new File(orgfile);
    		File destf = new File(destfile);
    		if(orgf.isDirectory()){
        		FileUtils.moveDirectory(new File(orgfile), new File(destfile));
    		}else{
    			FileUtils.moveFile(orgf, destf);
    		}
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static void copyFile(String orgfile, String destfile){
    	try{
    		createDirectory(destfile);
    		File orgf = new File(orgfile);
    		File destf = new File(destfile);
    		
    		if(orgf.isDirectory()){
    			FileUtils.copyDirectory(orgf, destf);
    		}else{
    			FileUtils.copyFile(orgf, destf);
    		}
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static String getFileMD5(String filename){
    	byte[] raw = getBytesFromFile(filename);
    	return MD5Utility.encryptAsString(raw);
    }
    
    public static String getFileMD5(File file){
    	byte[] raw = getBytesFromFile(file);
    	return MD5Utility.encryptAsString(raw);
    }
    
    public static String getContentType(String filename){
    	InputStream is = getInputStreamFromFile(filename);
    	return getContentType(is);
    }
    
    public static String getContentType(byte[] data){
    	InputStream ins = new ByteArrayInputStream(data);
    	return getContentType(ins);
    }
    
    public static String getContentType(InputStream ins){
    	BufferedInputStream bis = new BufferedInputStream(ins);
    	AutoDetectParser parser = new AutoDetectParser();
    	Detector detector = parser.getDetector();
    	Metadata md = new Metadata();
    	try{
        	MediaType mediaType = detector.detect(bis, md);
        	return mediaType.toString();
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}finally{
    		try {
				bis.close();
			} catch (IOException e) {
			}
    	}
    }
    
    public static String getParentDir(String path, String filename){
    	OutParameter<String> res = new OutParameter<String>();
    	res.value = null;
    	
    	FileUtility.iterateFilesByFunc(path, (file)->{
    		if(res.value != null){
    			return true;
    		}
    		String abspath = file.getAbsolutePath();
    		int idx = abspath.indexOf(filename); 
    		if(idx > 0){
    			res.value = abspath.substring(0, idx);
    			return true;
    		}
    		return false;
    	});
    	
    	return res.value;
    }
    public static boolean fileCopy(File source,File target)
    {
    	 FileInputStream fi = null;

         FileOutputStream fo = null;

         FileChannel in = null;

         FileChannel out = null;

         try {

             fi = new FileInputStream(source);

             fo = new FileOutputStream(target);

             in = fi.getChannel();//得到对应的文件通道

             out = fo.getChannel();//得到对应的文件通道

             in.transferTo(0, in.size(), out);//连接两个通道，并且从in通道读取，然后写入out通道
             
             return true;

         } catch (IOException e) {

             e.printStackTrace();
             QueueLog.error(AppLoggers.ErrorLogger, e);
             return false;

         } finally {

             try {

                 fi.close();

                 in.close();

                 fo.close();

                 out.close();

             } catch (IOException e) {

                 e.printStackTrace();

             }

         }
    }
    
    public static String getFileSuffixWithDot(String filePath)
    {
    	 int  dotIndex = filePath.lastIndexOf(".");
		 
         String suffix = filePath.substring(dotIndex,filePath.length());
         
         return suffix;
    }
    public static String getFileSuffixNoDot(String filePath)
    {
    	 int  dotIndex = filePath.lastIndexOf(".");
		 
         String suffix = filePath.substring(dotIndex+1,filePath.length());
         
         return suffix;
    }
    
    public static String getFileMimeType(String suffix)
    {
    	  String contentType = "";
    	  suffix = suffix.toLowerCase();
          switch (suffix)
          {
	          case ".svg":
	          case ".txt":
	          case ".json":
	        	  contentType = "text/plain";
	        	  break;
	          case ".b":
	        	  contentType = "image/jpeg";
	        	  break;
	          case ".a":
	        	  contentType =  "image/png";
	        	  break;
              case ".png":
                  contentType = "image/png";
                  break;
              case ".jpg":
              case ".jpeg":
                  contentType = "image/jpeg";
                  break;
              case ".bmp":
                  contentType = "image/bmp";
                  break;
              case ".gif":
                  contentType = "image/gif";
                  break;
              case ".tiff":
                  contentType = "image/tiff";
                  break;
              case ".rar":
                  contentType = "application/x-rar-compressed";
                  break;
              case ".zip":
                  contentType = "application/zip";
                  break;
              case ".apk":
              case ".apt":
                  contentType = "application/vnd.android.package-archive";
                  break;
              case ".ipa":
                  contentType = "application/vnd.iphone";
                  break;
          }
          return contentType;
    	
    }
    
    public static long getFileCreateTime(File file){
    	try{
        	Path path = Paths.get(file.getAbsolutePath());
        	BasicFileAttributes attr = Files.readAttributes(path, BasicFileAttributes.class);
        	FileTime ft = attr.creationTime();
        	return ft.toMillis();
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static long getLastModifyTime(File file){
    	try{
        	Path path = Paths.get(file.getAbsolutePath());
        	BasicFileAttributes attr = Files.readAttributes(path, BasicFileAttributes.class);
        	FileTime ft = attr.lastModifiedTime();
        	return ft.toMillis();
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static void main(String[] args) {
    	String jar = "/Users/zjf/file/zjd/zjdapp.jar";
    }
}
