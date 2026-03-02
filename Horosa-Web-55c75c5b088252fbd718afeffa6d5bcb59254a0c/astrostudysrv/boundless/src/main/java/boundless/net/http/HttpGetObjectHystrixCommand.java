package boundless.net.http;

import java.io.ObjectInputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

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

import com.google.common.net.HttpHeaders;
import com.netflix.hystrix.HystrixCommand;
import com.netflix.hystrix.HystrixCommandGroupKey;

import boundless.exception.ErrorCodeException;
import boundless.spring.brave.BraveHelper;
import boundless.utility.IPUtility;
import boundless.utility.StringUtility;

public class HttpGetObjectHystrixCommand extends HystrixCommand<Object>{
	private String user;
	private String password;
	private String url;
	private Map<String, String> headers;
	private int timeoutMS;
	
	public HttpGetObjectHystrixCommand(String user, String password, String url, Map<String, String> headers, int timeoutMS){
		super(HystrixCommandGroupKey.Factory.asKey(StringUtility.getUri(url)));
		
		this.user = user;
		this.password = password;
		this.url = url;
		this.headers = headers;
		this.timeoutMS = timeoutMS;
		
	}

	@Override
	protected Object run() throws Exception {
		return doCmd(user, password, url, headers, timeoutMS);
	}

	@Override  
    protected Object getFallback() {  
        return null;  
    }  
	
	
	public static Object doCmd(String user, String password, String url, Map<String, String> headers, int timeoutMS){
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

			HttpGet request = new HttpGet(url);
			request.setHeader(HttpHeaders.CONTENT_TYPE, "application/x-java-serialized-object");
			request.setHeader(HttpHeaders.ACCEPT, "application/x-java-serialized-object");
			Map<String, String> tmphead = headers;
			if(tmphead == null){
				tmphead = new HashMap<String, String>();
			}
			for(Entry<String, String> entry : tmphead.entrySet()){
				request.setHeader(entry.getKey(), entry.getValue());
			}
			try{
				String[] ips = IPUtility.getLocalIps();
				request.setHeader("LocalIp", ips[0]);
			}catch(Exception e){
			}
			
			try{
				CloseableHttpResponse response = client.execute(request, localContext);
				int statcode = response.getStatusLine().getStatusCode(); 
				if(statcode != 200){
					String reason = response.getStatusLine().getReasonPhrase();
					String errmsg = String.format("Failed : HTTP error code : %d\treason : %s", statcode, reason);
					throw new ErrorCodeException(statcode, errmsg);
				}
				ObjectInputStream in = new ObjectInputStream(response.getEntity().getContent());       	
				return in.readObject();
			}catch(Exception e){
				HttpClientUtility.log.error("{}, cause:{}", url, e.getMessage());
				throw e;
			}finally{
				try{
					client.close();
				}catch(Exception e){
					e.printStackTrace();
				}
			}
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}

}
