package boundless.utility.img;

import java.io.File;
import java.util.Properties;

import org.gm4java.engine.GMConnection;
import org.gm4java.engine.GMService;
import org.gm4java.engine.GMServiceException;
import org.gm4java.engine.support.GMConnectionPoolConfig;
import org.gm4java.engine.support.PooledGMService;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.StringUtility;

public class GMUtility {
	private static String gmpath = "/usr/local/bin/gm";
	
	private static GMService service = null;
	
	public static void build(String proppath){
		close();
		
		Properties p = FileUtility.getProperties(proppath);
		String path = p.getProperty("path");
		if(!StringUtility.isNullOrEmpty(path)){
			gmpath = path;
		}
		
		GMConnectionPoolConfig config = new GMConnectionPoolConfig();
		config.setGMPath(gmpath);
		service = new PooledGMService(config);
		
	}
	
	public static void close(){
		if(service != null){
			service = null;
		}
	}
	
	public static long compressByProcess(String imgfile, String destfile){
		long start = System.currentTimeMillis();
		String outfile = destfile;
		if(StringUtility.isNullOrEmpty(destfile)){
			outfile = imgfile;
		}
		StringBuilder cmd = new StringBuilder(gmpath);
		try{
			cmd.append(" convert ").append(imgfile).append(" ").append(outfile);
			Process p = Runtime.getRuntime().exec(cmd.toString());
			p.waitFor();
			p.destroy();
			return System.currentTimeMillis() - start;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static long compressByApi(String imgfile, String destfile){
		long start = System.currentTimeMillis();
		
		String outfile = destfile;
		if(StringUtility.isNullOrEmpty(destfile)){
			outfile = imgfile;
		}
		
		String[] args = new String[]{
			imgfile, outfile
		};
		
		GMConnection connection = null;
		try{
			connection = service.getConnection();
			connection.execute("convert", args);
			long ms = System.currentTimeMillis() - start;
			return ms;
		}catch(Exception e){
			throw new RuntimeException(e);
		}finally{
			try {
				if(connection != null){
					connection.close();
				}
			} catch (GMServiceException e) {
				QueueLog.error(AppLoggers.ErrorLogger, e.getMessage());
			}
		}
		
	}	
	
	public static long compress(byte[] raw, String destfile){
		long start = System.currentTimeMillis();
		
		File dir = FileUtility.createDirectory(destfile);
		String tmp = String.format("%s/%d", dir.getAbsolutePath(), System.nanoTime());
		FileUtility.save(tmp, raw);
		compressByProcess(tmp, destfile);
		
		FileUtility.delete(tmp);
		
		return System.currentTimeMillis() - start;
	}
	
	public static long compress(String imgfile, String destfile, String args){
		long start = System.currentTimeMillis();
		String outfile = destfile;
		if(StringUtility.isNullOrEmpty(destfile)){
			outfile = imgfile;
		}
		StringBuilder cmd = new StringBuilder(gmpath);
		try{
			if(StringUtility.isNullOrEmpty(args)){
				cmd.append(" convert ").append(imgfile).append(" ").append(outfile);
			}else{
				cmd.append(" convert ").append(imgfile).append(" ").append(args).append(" ").append(outfile);
			}
			Process p = Runtime.getRuntime().exec(cmd.toString());
			p.waitFor();
			p.destroy();
			return System.currentTimeMillis() - start;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static void compress(byte[] raw, String destfile, String args){
		File dir = FileUtility.createDirectory(destfile);
		String tmp = String.format("%s/%d", dir.getAbsolutePath(), System.nanoTime());
		FileUtility.save(tmp, raw);

		compress(tmp, destfile, args);
		
		FileUtility.delete(tmp);
	}
	
	
	public static long convertByApi(String args[]){
		long start = System.currentTimeMillis();
		
		GMConnection connection = null;
		try{
			connection = service.getConnection();
			connection.execute("convert", args);
			long ms = System.currentTimeMillis() - start;
			return ms;
		}catch(Exception e){
			throw new RuntimeException(e);
		}finally{
			try {
				if(connection != null){
					connection.close();
				}
			} catch (GMServiceException e) {
				QueueLog.error(AppLoggers.ErrorLogger, e.getMessage());
			}
		}
		
	}
	

}
