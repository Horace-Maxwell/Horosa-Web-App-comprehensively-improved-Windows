package boundless.net.http;

import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

import org.apache.http.Header;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpUriRequest;
import org.apache.http.client.protocol.HttpClientContext;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;

import com.google.common.net.HttpHeaders;
import com.netflix.hystrix.HystrixCommand;
import com.netflix.hystrix.HystrixCommandGroupKey;

import boundless.spring.brave.BraveHelper;
import boundless.utility.IPUtility;
import boundless.utility.StringUtility;

public class HttpUriRequestRespHeadHystrixCommand extends HystrixCommand<Map<String, String>> {
	private String user;
	private String password;
	private HttpUriRequest request;
	private Map<String, String> headers;
	private String contenttype;
	private int timeoutMS;

	public HttpUriRequestRespHeadHystrixCommand(String user, String password, HttpUriRequest request,
			Map<String, String> headers, String contenttype, int timeoutMS){
		
		super(HystrixCommandGroupKey.Factory.asKey(request.getURI().toString()));
		
		this.user = user;
		this.password = password;
		this.request = request;
		this.headers = headers;
		this.contenttype = contenttype;
		this.timeoutMS = timeoutMS;
		
	}
	

	@Override
	protected Map<String, String> run() throws Exception {
		return doCmd(user, password, request, headers, contenttype, timeoutMS);
	}
	
	@Override  
    protected Map<String, String> getFallback() {  
        return new HashMap<String, String>();  
    }  
	
	public static Map<String, String> doCmd(String user, String password, HttpUriRequest request,
			Map<String, String> headers, String contenttype, int timeoutMS){
		try{
			RequestConfig requestConfig = RequestConfig.custom().setConnectTimeout(timeoutMS).setSocketTimeout(timeoutMS).setProxy(HttpClientUtility.getHttpHost()).build();
			HttpClientBuilder builder = null;
			if(BraveHelper.existZipkin()){
				builder = BraveHelper.getHttpClientBuilder(request.getURI().toString());
			}else{
				builder = HttpClientBuilder.create();
			}
			builder.setDefaultRequestConfig(requestConfig);
			builder.setSSLContext(HttpClientUtility.sslCtx).setSSLHostnameVerifier(HttpClientUtility.hostnameVerifier);
			CloseableHttpClient client = builder.build();
			HttpClientContext localContext = null;
			if(!StringUtility.isNullOrEmpty(password)){
				CredentialsProvider credentialsProvider = new BasicCredentialsProvider();
				credentialsProvider.setCredentials(AuthScope.ANY, new UsernamePasswordCredentials(user, password));
				localContext = HttpClientContext.create();
				localContext.setCredentialsProvider(credentialsProvider);
			}

			try{
				if(!StringUtility.isNullOrEmpty(contenttype)){
					request.setHeader(HttpHeaders.CONTENT_TYPE, contenttype);
				}else{
					request.setHeader(HttpHeaders.CONTENT_TYPE, "application/json; charset=UTF-8");
				}
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
				
				CloseableHttpResponse response = client.execute(request, localContext);
				Map<String, String> map = new HashMap<String, String>();
				for(Header header : response.getAllHeaders()){
					map.put(header.getName(), header.getValue());
				}

				return map;
			}catch(Exception e){
				HttpClientUtility.log.error("请求{}失败, cause:{}", request.getURI().toString(), e.getMessage());
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
