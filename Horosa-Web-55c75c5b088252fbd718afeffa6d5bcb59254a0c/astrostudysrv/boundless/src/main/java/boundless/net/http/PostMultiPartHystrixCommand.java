package boundless.net.http;

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
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.protocol.HttpClientContext;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.mime.HttpMultipartMode;
import org.apache.http.entity.mime.MultipartEntityBuilder;
import org.apache.http.entity.mime.content.ByteArrayBody;
import org.apache.http.entity.mime.content.FileBody;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.util.EntityUtils;

import com.netflix.hystrix.HystrixCommand;
import com.netflix.hystrix.HystrixCommandGroupKey;

import boundless.exception.ErrorCodeException;
import boundless.net.http.HttpClientUtility.BinaryContent;
import boundless.net.http.HttpClientUtility.FileContent;
import boundless.net.http.HttpClientUtility.FormDataContent;
import boundless.net.http.HttpClientUtility.InputStreamContent;
import boundless.net.http.HttpClientUtility.MultiPartContent;
import boundless.net.http.HttpClientUtility.TextContent;
import boundless.spring.brave.BraveHelper;
import boundless.utility.IPUtility;
import boundless.utility.RandomUtility;
import boundless.utility.StringUtility;

public class PostMultiPartHystrixCommand extends HystrixCommand<byte[]> {
	private String user;
	private String password;
	private String url;
	private List<MultiPartContent> multiparts;
	private Map<String, String> headers;
	private Map<String, String> responseHeaders;
	private int timeoutMS;
	private HttpStatusCode status;

	public PostMultiPartHystrixCommand(String user, String password, 
			String url, List<MultiPartContent> multiparts, 
			Map<String, String> headers, Map<String, String> responseHeaders, 
			int timeoutMS, HttpStatusCode status){
		
		super(HystrixCommandGroupKey.Factory.asKey(StringUtility.getUri(url)));
		
		this.user = user;
		this.password = password;
		this.url = url;
		this.multiparts = multiparts;
		this.headers = headers;
		this.responseHeaders = responseHeaders;
		this.timeoutMS = timeoutMS;
		this.status = status;
	}
	

	@Override
	protected byte[] run() throws Exception {
		return doCmd(user, password, url, multiparts, headers, responseHeaders, timeoutMS, status);
	}
	
	@Override  
    protected byte[] getFallback() {  
        return new byte[0];  
    } 
	
	public static byte[] doCmd(String user, String password, 
			String url, List<MultiPartContent> multiparts, 
			Map<String, String> headers, Map<String, String> responseHeaders, 
			int timeoutMS, HttpStatusCode status){
		try{
			if(multiparts == null || multiparts.isEmpty()){
				return new byte[0];
			}

			RequestConfig requestConfig = RequestConfig.custom().setConnectTimeout(timeoutMS).setSocketTimeout(timeoutMS).setProxy(HttpClientUtility.getHttpHost()).build();
			HttpClientBuilder hbuilder = null;
			if(BraveHelper.existZipkin()){
				hbuilder = BraveHelper.getHttpClientBuilder(url);
			}else{
				hbuilder = HttpClientBuilder.create();
			}
			hbuilder.setDefaultRequestConfig(requestConfig);
			hbuilder.setSSLContext(HttpClientUtility.sslCtx);
			hbuilder.setSSLHostnameVerifier(HttpClientUtility.hostnameVerifier);
			CloseableHttpClient client = hbuilder.build();
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
			

			MultipartEntityBuilder builder = MultipartEntityBuilder.create();
			builder.setMode(HttpMultipartMode.STRICT);
			for(MultiPartContent multi : multiparts){
				if(multi instanceof BinaryContent){
					BinaryContent multipart = (BinaryContent) multi;
					builder.addBinaryBody(multipart.FieldName, multipart.bytes, ContentType.DEFAULT_BINARY, multipart.FileName);
				}else if(multi instanceof TextContent){
					TextContent multipart = (TextContent)multi;
					builder.addTextBody(multipart.FieldName, multipart.text, HttpClientUtility.TEXT_PLAIN);
				}else if(multi instanceof InputStreamContent){
					InputStreamContent multipart = (InputStreamContent) multi;
					builder.addBinaryBody(multipart.FieldName, multipart.Stream, ContentType.DEFAULT_BINARY, multipart.FileName);
				}else if(multi instanceof FileContent){
					FileContent multipart = (FileContent) multi;
					builder.addBinaryBody(multipart.FieldName, multipart.UpFile, ContentType.DEFAULT_BINARY, multipart.FileName);
				}else if(multi instanceof FormDataContent){
					FormDataContent multipart = (FormDataContent) multi;
					if(multipart.bytes != null && multipart.bytes.length > 0){
						ByteArrayBody body = new ByteArrayBody(multipart.bytes, ContentType.MULTIPART_FORM_DATA, multipart.FileName);
						builder.addPart(multipart.FieldName, body);
					}else if(multipart.UpFile != null){
						FileBody body = new FileBody(multipart.UpFile, ContentType.MULTIPART_FORM_DATA, multipart.FileName);
						builder.addPart(multipart.FieldName, body);
					}
//					String boundary = String.format("------------------------%s", RandomUtility.randomString(16));
//					builder.setBoundary(boundary);
				}
			}

			HttpEntity entity = builder.build();
			try {
				post.setEntity(entity);
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
					if(status != null){
						status.statCode = statcode;
						status.phase = reason;
					}
					HttpEntity respEntity = response.getEntity();
					byte[] raw = EntityUtils.toByteArray(respEntity);
					String resmsg = "";
					try{
						 resmsg = new String(raw, "UTF-8");
					}catch(Exception e){}
					String errmsg = String.format("Failed : HTTP error code : %d; reason : %s; responsemsg:%s", statcode, reason, resmsg);
					throw new ErrorCodeException(statcode, errmsg);
				}
				HttpEntity respEntity = response.getEntity();
				byte[] raw = EntityUtils.toByteArray(respEntity);
				return raw;
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
