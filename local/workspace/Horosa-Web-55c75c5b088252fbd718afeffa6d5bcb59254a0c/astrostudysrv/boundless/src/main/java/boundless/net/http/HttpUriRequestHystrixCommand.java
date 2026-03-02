package boundless.net.http;

import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpUriRequest;
import org.apache.http.client.protocol.HttpClientContext;
import org.apache.http.conn.ssl.SSLConnectionSocketFactory;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.util.EntityUtils;

import com.google.common.net.HttpHeaders;
import com.netflix.hystrix.HystrixCommand;
import com.netflix.hystrix.HystrixCommandGroupKey;

import boundless.exception.ErrorCodeException;
import boundless.spring.brave.BraveHelper;
import boundless.utility.IPUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class HttpUriRequestHystrixCommand extends HystrixCommand<String> {
	private String user;
	private String password;
	private HttpUriRequest request;
	private Map<String, String> headers;
	private Map<String, String> respHeaders;
	private String contenttype;
	private int timeoutMS;
	private HttpStatusCode status;
	private SSLConnectionSocketFactory sslFactory;

	public HttpUriRequestHystrixCommand(String user, String password, HttpUriRequest request,
			Map<String, String> headers, String contenttype, int timeoutMS, HttpStatusCode status, SSLConnectionSocketFactory sslFactory){
		
		super(HystrixCommandGroupKey.Factory.asKey(request.getURI().toString()));
		
		this.user = user;
		this.password = password;
		this.request = request;
		this.headers = headers;
		this.contenttype = contenttype;
		this.timeoutMS = timeoutMS;
		this.status = status;
		this.sslFactory = sslFactory;
	}
	
	public HttpUriRequestHystrixCommand(String user, String password, HttpUriRequest request,
			Map<String, String> headers, String contenttype, int timeoutMS, HttpStatusCode status, Map<String, String> respHeaders,
			SSLConnectionSocketFactory sslFactory) {
		this(user, password, request, headers, contenttype, timeoutMS, status, sslFactory);
		this.respHeaders = respHeaders;
	}
	

	@Override
	protected String run() throws Exception {
		return doCmd(user, password, request, headers, contenttype, timeoutMS, status, respHeaders, sslFactory);
	}
	
	@Override  
    protected String getFallback() {  
        return "";  
    }  
	
	public static String doCmd(String user, String password, HttpUriRequest request,
			Map<String, String> headers, String contenttype, int timeoutMS, HttpStatusCode status, SSLConnectionSocketFactory sslFactory) {
		return doCmd(user, password, request, headers, contenttype, timeoutMS, status, null, sslFactory);
	}
	
	public static String doCmd(String user, String password, HttpUriRequest request,
			Map<String, String> headers, String contenttype, int timeoutMS, HttpStatusCode status, Map<String, String> respHeadMap, 
			SSLConnectionSocketFactory sslFactory){
		try{
			RequestConfig requestConfig = RequestConfig.custom().setConnectTimeout(timeoutMS).setSocketTimeout(timeoutMS).setProxy(HttpClientUtility.getHttpHost()).build();
			HttpClientBuilder builder = null;
			if(BraveHelper.existZipkin()){
				builder = BraveHelper.getHttpClientBuilder(request.getURI().toString());
			}else{
				builder = HttpClientBuilder.create();
			}
			builder.setDefaultRequestConfig(requestConfig);
			if(sslFactory == null) {
				builder.setSSLContext(HttpClientUtility.sslCtx).setSSLHostnameVerifier(HttpClientUtility.hostnameVerifier);				
			}else {
				builder.setSSLSocketFactory(sslFactory);
			}
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
				
				Map<String, String> headermap = HttpClientUtility.getHeadersMap(request.getAllHeaders());
				
				CloseableHttpResponse response = client.execute(request, localContext);
				Map<String, String> repsheaders = HttpClientUtility.getHeadersMap(response.getAllHeaders());
				if(respHeadMap != null) {
					respHeadMap.putAll(repsheaders);
				}
				int statcode = response.getStatusLine().getStatusCode(); 
				if(statcode != 200){
					String reason = response.getStatusLine().getReasonPhrase();
					if(status != null){
						status.statCode = statcode;
						status.phase = reason;
					}
					String jsonheads = JsonUtility.encode(repsheaders);
					String requestjsonhead = JsonUtility.encode(headermap);
					String str = "";
					try{
						str = EntityUtils.toString(response.getEntity(), "UTF-8");
					}catch(Exception e){
					}
					String errmsg = String.format("Failed : HTTP error code : %d; reason : %s, request-header:%s, response-headers:%s, response-body:%s", 
							statcode, reason, requestjsonhead, jsonheads, str);
					throw new ErrorCodeException(statcode, errmsg);
				}

				String charset = "utf-8";
				if(!StringUtility.isNullOrEmpty(contenttype)){
					String[] parts = StringUtility.splitString(contenttype, ';');
					for(String part : parts){
						if(part.contains("=")){
							String[] cparts = StringUtility.splitString(part, '=');
							if(cparts[0].trim().equalsIgnoreCase("charset") && cparts.length > 1){
								charset = cparts[1].trim();
								break;
							}
						}
					}
				}
				String str = EntityUtils.toString(response.getEntity(), charset);
				return str;
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
