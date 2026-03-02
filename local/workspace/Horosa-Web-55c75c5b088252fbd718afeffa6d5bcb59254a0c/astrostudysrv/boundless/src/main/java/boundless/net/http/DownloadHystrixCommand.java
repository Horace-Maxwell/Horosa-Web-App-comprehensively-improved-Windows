package boundless.net.http;

import java.io.File;
import java.net.URL;

import org.apache.commons.io.FileUtils;

import com.netflix.hystrix.HystrixCommand;
import com.netflix.hystrix.HystrixCommandGroupKey;

import boundless.utility.StringUtility;

public class DownloadHystrixCommand extends HystrixCommand<Long> {
	private String url;
	private String destfile;
	
	public DownloadHystrixCommand(String url, String destfile){
		super(HystrixCommandGroupKey.Factory.asKey(StringUtility.getUri(url)));
		this.url = url;
		this.destfile = destfile;
	}

	@Override
	protected Long run() throws Exception {
		return doCmd(this.destfile, this.url);
	}
	
	@Override  
    protected Long getFallback() {  
        return -1l;  
    }  

	public static long doCmd(String url, String destfile){
		try{
			File dest = new File(destfile);
			URL srcurl = new URL(url);
			FileUtils.copyURLToFile(srcurl, dest);
			return dest.length();
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
}
