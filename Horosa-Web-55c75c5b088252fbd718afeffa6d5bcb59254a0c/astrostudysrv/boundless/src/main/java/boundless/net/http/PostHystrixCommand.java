package boundless.net.http;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

import org.apache.http.Header;
import org.apache.http.HttpEntity;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.entity.UrlEncodedFormEntity;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.protocol.HttpClientContext;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.message.BasicNameValuePair;
import org.apache.http.util.EntityUtils;

import com.google.common.net.HttpHeaders;
import com.netflix.hystrix.HystrixCommand;
import com.netflix.hystrix.HystrixCommandGroupKey;

import boundless.exception.ErrorCodeException;
import boundless.io.CompressUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.brave.BraveHelper;
import boundless.utility.ConsoleUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.IPUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class PostHystrixCommand extends HystrixCommand<String> {
	private String user;
	private String password;
	private String url;
	private Map<String, Object> params;
	private Map<String, String> headers;
	private Map<String, String> responseHeaders;
	private String contenttype;
	private int timeoutMS;

	public PostHystrixCommand(String user, String password, 
			String url, Map<String, Object> params, 
			Map<String, String> headers, Map<String, String> responseHeaders, String contenttype, int timeoutMS){
		
		super(HystrixCommandGroupKey.Factory.asKey(StringUtility.getUri(url)));
		
		this.user = user;
		this.password = password;
		this.url = url;
		this.params = params;
		this.headers = headers;
		this.responseHeaders = responseHeaders;
		this.contenttype = contenttype;
		this.timeoutMS = timeoutMS;
	}
	

	@Override
	protected String run() throws Exception {
		return doCmd(user, password, url, params, headers, this.responseHeaders, contenttype, timeoutMS);
	}
	
	@Override  
    protected String getFallback() {  
        return "";  
    }  
	
	public static String doCmd(String user, String password, 
			String url, Map<String, Object> params, 
			Map<String, String> headers, Map<String, String> responseHeaders, 
			String contenttype, int timeoutMS){
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
			if(StringUtility.isNullOrEmpty(contenttype)){
				post.setHeader(HttpHeaders.CONTENT_TYPE, "application/json; charset=UTF-8");
			}else{
				post.setHeader(HttpHeaders.CONTENT_TYPE, contenttype);
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
			
			List<BasicNameValuePair> postparams = new ArrayList<BasicNameValuePair>();
			if(params != null){
				for(Map.Entry<String, Object> param : params.entrySet()){
					Object val = param.getValue();
					if(val != null){
						BasicNameValuePair pair = new BasicNameValuePair(param.getKey(), ConvertUtility.getValueAsString(val));
						postparams.add(pair);
					}
				}
			}
			HttpEntity entity;
			try {
				if(!postparams.isEmpty()){
					entity = new UrlEncodedFormEntity(postparams, "UTF-8");
					post.setEntity(entity);
					post.setHeader(entity.getContentType());
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
					String reason = response.getStatusLine().getReasonPhrase();
					Header[] reqhd = post.getAllHeaders();
					Map<String, String> reqhdmap = new HashMap<String, String>();
					for(Header reqh : reqhd){
						reqhdmap.put(reqh.getName(), reqh.getValue());
					}
					String errmsg = String.format("\nFailed : HTTP error code : %d\nreason : %s\nrequest header: %s\nresponse header: %s\n", 
							statcode, reason, JsonUtility.encode(reqhdmap), JsonUtility.encode(responseHeaders));
					throw new ErrorCodeException(statcode, errmsg);
				}
				
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
				
				String str = null;
				if(isgzip){
					try{
						byte[] raw = EntityUtils.toByteArray(respEntity);
						raw = CompressUtility.decompressToBytes(raw);
						str = new String(raw, "UTF-8");
					}catch(Exception e){
						QueueLog.error(AppLoggers.ErrorLogger, e);
						str = ConsoleUtility.getStackTrace(e);
					}
					
				}else{
					str = EntityUtils.toString(respEntity, "UTF-8");
				}

				return str;
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
}
