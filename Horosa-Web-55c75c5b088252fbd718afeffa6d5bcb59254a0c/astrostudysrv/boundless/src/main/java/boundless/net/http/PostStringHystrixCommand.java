package boundless.net.http;

import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

import org.apache.http.Header;
import org.apache.http.HttpEntity;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.protocol.HttpClientContext;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.util.EntityUtils;

import com.google.common.net.HttpHeaders;
import com.netflix.hystrix.HystrixCommand;
import com.netflix.hystrix.HystrixCommandGroupKey;

import boundless.exception.ErrorCodeException;
import boundless.io.CompressUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.brave.BraveHelper;
import boundless.utility.IPUtility;
import boundless.utility.StringUtility;

public class PostStringHystrixCommand extends HystrixCommand<String> {
	private String user;
	private String password;
	private String url;
	private String params;
	private Map<String, String> headers;
	private Map<String, String> respHeaders;
	private String contenttype;
	private int timeoutMS;
	private HttpStatusCode status;

	public PostStringHystrixCommand(String user, String password, 
			String url, String params, 
			Map<String, String> headers, String contenttype, Map<String, String> responseHeaders, int timeoutMS, HttpStatusCode status){
		
		super(HystrixCommandGroupKey.Factory.asKey(StringUtility.getUri(url)));
		
		this.user = user;
		this.password = password;
		this.url = url;
		this.params = params;
		this.headers = headers;
		this.contenttype = contenttype;
		this.timeoutMS = timeoutMS;
		this.respHeaders = responseHeaders;
		this.status = status;
	}
	

	@Override
	protected String run() throws Exception {
		return doCmd(user, password, url, params, headers, contenttype, respHeaders, timeoutMS, status);
	}
	
	@Override  
    protected String getFallback() {  
        return "";  
    }  
	
	public static String doCmd(String user, String password, 
			String url, String params, 
			Map<String, String> headers, String contenttype, Map<String, String> responseHeaders, int timeoutMS, HttpStatusCode status){
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

			HttpPost post = new HttpPost(url);
			if(!StringUtility.isNullOrEmpty(contenttype)){
				post.setHeader(HttpHeaders.CONTENT_TYPE, contenttype);
			}else{
				post.setHeader(HttpHeaders.CONTENT_TYPE, "application/json; charset=UTF-8");
			}
			Map<String, String> tmphead = headers;
			if(tmphead == null){
				tmphead = new HashMap<String, String>();
			}
			for(Entry<String, String> entry : tmphead.entrySet()){
				post.setHeader(entry.getKey(), entry.getValue());
			}
			try{
				String[] ips = IPUtility.getLocalIps();
				post.setHeader("LocalIp", ips[0]);
			}catch(Exception e){
			}
			
			HttpEntity entity;
			try {
				if(!StringUtility.isNullOrEmpty(params)){
					entity = new StringEntity(params, "UTF-8");
					post.setEntity(entity);
				}
				CloseableHttpResponse response = client.execute(post, localContext);
				if(responseHeaders != null){
					Header[] respheaders = response.getAllHeaders();
					for(Header resphead : respheaders){
						responseHeaders.put(resphead.getName(), resphead.getValue());
					}
				}
				int statcode = response.getStatusLine().getStatusCode(); 
				if(statcode != 200){
					String errmsg = getResponseBody(response);
					String reason = response.getStatusLine().getReasonPhrase();
					if(status != null){
						status.statCode = statcode;
						status.phase = errmsg==null ? reason : errmsg;
					}
					if(StringUtility.isNullOrEmpty(errmsg)){
						errmsg = String.format("Failed : HTTP error code : %d\treason : %s", statcode, reason);
					}
					throw new ErrorCodeException(statcode, errmsg);
				}
				
				return getResponseBody(response);
			}catch(Exception e){
				HttpClientUtility.log.error("请求{}失败, cause:{}", post.getURI().toString(), e.getMessage());
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
	
	private static String getResponseBody(CloseableHttpResponse response) throws Exception{
		HttpEntity respEntity = response.getEntity();
		Header[] encoding = response.getHeaders("Content-Encoding");
		boolean isgzip = false;
		for(Header enc : encoding){
			if(enc.getValue().trim().equalsIgnoreCase("gzip")){
				isgzip = true;
				break;
			}
		}
		if(!isgzip){
			encoding = response.getHeaders("Transfer-Encoding");
			for(Header enc : encoding){
				if(enc.getValue().trim().equalsIgnoreCase("gzip")){
					isgzip = true;
					break;
				}
			}
		}
		
		if(isgzip){
			byte[] raw = EntityUtils.toByteArray(respEntity);
			try{
				raw = CompressUtility.decompressToBytes(raw);
				return new String(raw, "UTF-8");
			}catch(Exception e){
				QueueLog.error(AppLoggers.ErrorLogger, e);
				String str = EntityUtils.toString(respEntity, "UTF-8");
				return str;
			}
		}else{
			String str = EntityUtils.toString(respEntity, "UTF-8");
			return str;
		}
		
	}
	
}
