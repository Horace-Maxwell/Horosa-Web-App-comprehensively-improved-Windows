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

public class HttpUriRequestBytesHystrixCommand extends HystrixCommand<byte[]> {
	private String user;
	private String password;
	private HttpUriRequest request;
	private Map<String, String> headers;
	private Map<String, String> responseHeaders;
	private String contenttype;
	private int timeoutMS;
	private byte[] data;

	public HttpUriRequestBytesHystrixCommand(String user, String password, HttpUriRequest request,
			Map<String, String> headers, byte[] data, Map<String, String> responseHeaders, String contenttype, int timeoutMS){
		
		super(HystrixCommandGroupKey.Factory.asKey(request.getURI().toString()));
		
		this.user = user;
		this.password = password;
		this.request = request;
		this.headers = headers;
		this.responseHeaders = responseHeaders;
		this.contenttype = contenttype;
		this.timeoutMS = timeoutMS;
		this.data = data;
	}
	

	@Override
	protected byte[] run() throws Exception {
		return doCmd(user, password, request, headers, data, responseHeaders, contenttype, timeoutMS);
	}
	
	@Override  
    protected byte[] getFallback() {  
        return new byte[0];  
    }  
	
	public static byte[] doCmd(String user, String password, HttpUriRequest request,
			Map<String, String> headers, byte[] data, Map<String, String> responseHeaders, String contenttype, int timeoutMS){
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
				if(responseHeaders != null){
					Header[] respheaders = response.getAllHeaders();
					for(Header resphead : respheaders){
						responseHeaders.put(resphead.getName(), resphead.getValue());
					}
				}
				int statcode = response.getStatusLine().getStatusCode(); 
				if(statcode != 200){
					String reason = response.getStatusLine().getReasonPhrase();
					String errmsg = String.format("Failed : HTTP error code : %d\treason : %s", statcode, reason);
					throw new ErrorCodeException(statcode, errmsg);
				}

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
				
				byte[] raw = EntityUtils.toByteArray(response.getEntity());
				if(isgzip){
					try{
						raw = CompressUtility.decompressToBytes(raw);
					}catch(Exception e){
						QueueLog.error(AppLoggers.ErrorLogger, e);
					}
				}
				return raw;
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
