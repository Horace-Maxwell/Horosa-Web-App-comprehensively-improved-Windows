package boundless.net.http;

import org.apache.http.Header;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.protocol.HttpClientContext;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;

import com.netflix.hystrix.HystrixCommand;
import com.netflix.hystrix.HystrixCommandGroupKey;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.brave.BraveHelper;
import boundless.utility.IPUtility;
import boundless.utility.StringUtility;

public class HttpResponseHeaderHystrixCommand extends HystrixCommand<String> {
	private String user;
	private String password;
	private String url;
	private String responseHeaderKey;
	private int timeoutMS;

	public HttpResponseHeaderHystrixCommand(String user, String password, String url, String responseHeaderKey, int timeoutMS){
		
		super(HystrixCommandGroupKey.Factory.asKey(StringUtility.getUri(url)));
		
		this.user = user;
		this.password = password;
		this.url = url;
		this.responseHeaderKey = responseHeaderKey;
		this.timeoutMS = timeoutMS;
	}
	

	@Override
	protected String run() throws Exception {
		return doCmd(user, password, url, responseHeaderKey, timeoutMS);
	}
	
	@Override  
    protected String getFallback() {  
        return "";  
    }  
	
	public static String doCmd(String user, String password, String url, String responseHeaderKey, int timeoutMS){
		try{
			RequestConfig requestConfig = RequestConfig.custom().setConnectTimeout(timeoutMS).setSocketTimeout(timeoutMS).setProxy(HttpClientUtility.getHttpHost()).build();
			HttpClientBuilder builder = null;
			if(BraveHelper.existZipkin()){
				builder = BraveHelper.getHttpClientBuilder(url);
			}else{
				builder = HttpClientBuilder.create();
			}
			builder.setDefaultRequestConfig(requestConfig);
			builder.setSSLContext(HttpClientUtility.sslCtx);
			builder.setSSLHostnameVerifier(HttpClientUtility.hostnameVerifier);
			CloseableHttpClient client = builder.build();
			HttpClientContext localContext = null;
			if(!StringUtility.isNullOrEmpty(password)){
				CredentialsProvider credentialsProvider = new BasicCredentialsProvider();
				credentialsProvider.setCredentials(AuthScope.ANY, new UsernamePasswordCredentials(user, password));
				localContext = HttpClientContext.create();
				localContext.setCredentialsProvider(credentialsProvider);
			}

			HttpGet get = new HttpGet(url);
			try{
				String[] ips = IPUtility.getLocalIps();
				get.setHeader("LocalIp", ips[0]);
			}catch(Exception e){
			}
			try {
				CloseableHttpResponse response = client.execute(get, localContext);
				Header respheaders = response.getFirstHeader(responseHeaderKey);
				if(respheaders != null){
					return respheaders.getValue();
				}else{
					return "";
				}
			}catch(Exception e){
				QueueLog.error(AppLoggers.ErrorLogger, "请求{}失败, cause:{}", get.getURI().toString(), e.getMessage());
				throw e;
			}finally{
				try{
					client.close();
				}catch(Exception e){
					QueueLog.error(AppLoggers.ErrorLogger, e.getMessage());
				}
			}
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
}
