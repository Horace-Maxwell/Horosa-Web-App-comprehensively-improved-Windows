package boundless.net.http;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

import org.apache.http.HttpEntity;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.protocol.HttpClientContext;
import org.apache.http.entity.InputStreamEntity;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.util.EntityUtils;

import com.netflix.hystrix.HystrixCommand;
import com.netflix.hystrix.HystrixCommandGroupKey;

import boundless.exception.ErrorCodeException;
import boundless.spring.brave.BraveHelper;
import boundless.utility.IPUtility;
import boundless.utility.StringUtility;

public class PostStreamHystrixCommand extends HystrixCommand<String> {
	private String user;
	private String password;
	private String url;
	private InputStream ins;
	private Map<String, String> headers;
	private int timeoutMS;

	public PostStreamHystrixCommand(String user, String password, 
			String url, InputStream ins, 
			Map<String, String> headers, int timeoutMS){
		
		super(HystrixCommandGroupKey.Factory.asKey(StringUtility.getUri(url)));
		
		this.user = user;
		this.password = password;
		this.url = url;
		this.ins = ins;
		this.headers = headers;
		this.timeoutMS = timeoutMS;
	}
	

	@Override
	protected String run() throws Exception {
		return doCmd(user, password, url, ins, headers, timeoutMS);
	}
	
	@Override  
    protected String getFallback() {  
        return "";  
    }  
	
	public static String doCmd(String user, String password, 
			String url, InputStream ins, 
			Map<String, String> headers, int timeoutMS){
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
				entity = new InputStreamEntity(ins);
				post.setEntity(entity);
				CloseableHttpResponse response = client.execute(post, localContext);
				int statcode = response.getStatusLine().getStatusCode(); 
				if(statcode != 200){
					String reason = response.getStatusLine().getReasonPhrase();
					String errmsg = String.format("Failed : HTTP error code : %d\treason : %s", statcode, reason);
					throw new ErrorCodeException(statcode, errmsg);
				}
				HttpEntity respEntity = response.getEntity();
				String str = EntityUtils.toString(respEntity, "UTF-8");

				return str;
			}catch(Exception e){
				HttpClientUtility.log.error("请求{}失败, cause:{}", post.getURI().toString(), e.getMessage());
				throw e;
			}finally{
				try{
					client.close();
				}catch(Exception e){
				}
			}
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
}
