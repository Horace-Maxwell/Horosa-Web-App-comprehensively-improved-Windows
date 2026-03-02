package boundless.net.http;

import java.io.File;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.function.Consumer;
import java.net.InetSocketAddress;
import java.net.Proxy;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.KeyManager;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import org.apache.http.Consts;
import org.apache.http.Header;
import org.apache.http.HttpHost;
import org.apache.http.client.methods.HttpDelete;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpHead;
import org.apache.http.client.methods.HttpOptions;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.methods.HttpPut;
import org.apache.http.client.methods.HttpUriRequest;
import org.apache.http.conn.ssl.SSLConnectionSocketFactory;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.ssl.SSLContexts;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.PropertyPlaceholder;
import boundless.types.KeyValuePair;
import boundless.utility.CalculatePool;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class HttpClientUtility {
	private static boolean needHystrix = PropertyPlaceholder.getPropertyAsBool("needhystrix", false);

	public static final String HttpMethodGet = "GET";
	public static final String HttpMethodDelete = "DELETE";
	public static final String HttpMethodPut = "PUT";
	public static final String HttpMethodUpdate = "UPDATE";
	public static final String HttpMethodPost = "POST";
	public static final String HttpMethodHead = "HEAD";
	public static final String HttpMethodTrace = "TRACE";
	public static final String HttpMethodOptions = "OPTIONS";

	static final ContentType TEXT_PLAIN = ContentType.create("text/plain", Consts.UTF_8);

	static final int DefaultTimeoutMS = 120000;
	
		
	public static HttpHost getHttpHost() {
    	String http_proxy = System.getenv("http_proxy");
    	String https_proxy = System.getenv("https_proxy");
    	String all_proxy = System.getenv("all_proxy");
		
    	HttpHost host = null;
    	if(http_proxy != null) {
    		host = new HttpHost(http_proxy);
    	}else if(https_proxy != null) {
    		host = new HttpHost(https_proxy);
    	}if(all_proxy != null) {
    		host = new HttpHost(all_proxy);
    	}
    	
    	return host;
	}
	
	public static Proxy getProxy() {
    	String http_proxy = System.getenv("http_proxy");
    	String https_proxy = System.getenv("https_proxy");
    	String all_proxy = System.getenv("all_proxy");
    	Proxy urlproxy = null;
    	InetSocketAddress sockAddr = null;
    	if(http_proxy != null) {
			String[] parts = StringUtility.splitString(http_proxy, ':');
			sockAddr = new InetSocketAddress(parts[1].substring(2), ConvertUtility.getValueAsInt(parts[2]));
    		urlproxy = new Proxy(Proxy.Type.HTTP, sockAddr);
    	}else if(https_proxy != null) {
			String[] parts = StringUtility.splitString(https_proxy, ':');
			sockAddr = new InetSocketAddress(parts[1].substring(2), ConvertUtility.getValueAsInt(parts[2]));
    		urlproxy = new Proxy(Proxy.Type.HTTP, sockAddr);
    	}else if(all_proxy != null) {
			String[] parts = StringUtility.splitString(all_proxy, ':');
			sockAddr = new InetSocketAddress(parts[1].substring(2), ConvertUtility.getValueAsInt(parts[2]));
    		urlproxy = new Proxy(Proxy.Type.HTTP, sockAddr);
    	}

    	return urlproxy;
	}


	private static class DefaultTrustManager implements X509TrustManager {
		@Override
		public void checkClientTrusted(X509Certificate[] arg0, String arg1) throws CertificateException {}

		@Override
		public void checkServerTrusted(X509Certificate[] arg0, String arg1) throws CertificateException {}

		@Override
		public X509Certificate[] getAcceptedIssuers() {
			return null;
		}
		
		
	}

	static Logger log = LoggerFactory.getLogger(HttpClientUtility.class);
	static HttpClientBuilder httpBuilder;
	static SSLContext sslCtx;
	static HostnameVerifier hostnameVerifier;
	static{
		System.setProperty("https.protocols", "TLSv1,TLSv1.1,TLSv1.2");
		try {
			sslCtx = SSLContext.getInstance("TLSv1.2");
			sslCtx.init(new KeyManager[0], new TrustManager[] {new DefaultTrustManager()}, new SecureRandom());
			SSLContext.setDefault(sslCtx);

			httpBuilder = HttpClientBuilder.create();
			httpBuilder.setSSLContext(sslCtx);
			hostnameVerifier = SSLConnectionSocketFactory.getDefaultHostnameVerifier();
			hostnameVerifier = new HostnameVerifier(){
				@Override
				public boolean verify(String arg0, SSLSession arg1) {
					return true;
				}
			};
			httpBuilder.setSSLHostnameVerifier(hostnameVerifier);
		} catch (Exception e) {
			QueueLog.error(log, e);
		}
	}
	
	public static SSLConnectionSocketFactory createSSLFactory(KeyStore keystore, String keyPwd) {
		try {
			SSLContext sslcontext = SSLContexts.custom().loadKeyMaterial(keystore, keyPwd.toCharArray()).build();	
			HostnameVerifier hostver = SSLConnectionSocketFactory.getDefaultHostnameVerifier();
			SSLConnectionSocketFactory sslsf = new SSLConnectionSocketFactory(sslcontext, hostver);
			return sslsf;
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}

	private static String httpRequest(HttpUriRequest request, String contenttype){
		return httpRequest(request, contenttype, DefaultTimeoutMS);
	}

	public static String httpRequest(HttpUriRequest request, Map<String, String> headers, String contenttype, SSLConnectionSocketFactory sslFactory){
		return httpRequest(null, null, request, headers, contenttype, DefaultTimeoutMS, null, sslFactory);
	}

	private static String httpRequest(HttpUriRequest request, String contenttype, int timeoutMS){
		return httpRequest(null, null, request, contenttype, timeoutMS);
	}
	
	private static String httpRequest(String user, String password, HttpUriRequest request, String contenttype, int timeoutMS){
		return httpRequest(user, password, request, null, contenttype, timeoutMS);
	}
	
	private static String httpRequest(String user, String password, HttpUriRequest request, Map<String, String> headers, String contenttype, int timeoutMS){
		return httpRequest(user, password, request, headers, contenttype, timeoutMS, null, null);
	}

	private static String httpRequest(String user, String password, HttpUriRequest request, Map<String, String> headers, String contenttype, int timeoutMS, HttpStatusCode status, SSLConnectionSocketFactory sslFactory){
		if(needHystrix){
			HttpUriRequestHystrixCommand cmd = new HttpUriRequestHystrixCommand(user, password, request, headers, contenttype, timeoutMS, status, sslFactory);
			return cmd.execute();
		}else{
			return HttpUriRequestHystrixCommand.doCmd(user, password, request, headers, contenttype, timeoutMS, status, sslFactory);
		}
	}

	private static byte[] httpRequest(String user, String password, HttpUriRequest request, Map<String, String> headers, byte[] data, Map<String, String> responseHeaders, String contenttype, int timeoutMS){
		if(needHystrix){
			HttpUriRequestBytesHystrixCommand cmd = new HttpUriRequestBytesHystrixCommand(user, password, request, headers, data, responseHeaders, contenttype, timeoutMS);
			return cmd.execute();
		}else{
			return HttpUriRequestBytesHystrixCommand.doCmd(user, password, request, headers, data, responseHeaders, contenttype, timeoutMS);
		}
	}

	private static Map<String, String> httpRequestResponseHead(String user, String password, HttpUriRequest request, Map<String, String> headers, String contenttype, int timeoutMS){
		if(needHystrix){
			HttpUriRequestRespHeadHystrixCommand cmd = new HttpUriRequestRespHeadHystrixCommand(user, password, request, headers, contenttype, timeoutMS);
			return cmd.execute();
		}else{
			return HttpUriRequestRespHeadHystrixCommand.doCmd(user, password, request, headers, contenttype, timeoutMS);
		}
	}

	private static HttpResult httpSendObject(String url, Object data, String method, Map<String, String> header){
		return httpSendObject(null, null, url, data, method, header);
	}

	private static HttpResult httpSendObject(String user, String password, String url, Object data, String method, Map<String, String> header){
		if(needHystrix){
			HttpSendObjectHystrixCommand cmd = new HttpSendObjectHystrixCommand(user, password, url, data, method, header);
			return cmd.execute();
		}else{
			return HttpSendObjectHystrixCommand.doCmd(user, password, url, data, method, header);
		}
	}

	/**
	 * 请求并返回String结果
	 * @param url
	 * @param parameters
	 * @return
	 */
	public static String getString(String url, KeyValuePair<String, String>[] parameters, int timeoutMS)
	{
		StringBuilder sb = new StringBuilder();
		boolean first = true;

		if(parameters != null && parameters.length > 0){
			for (KeyValuePair<String, String> p : parameters)
			{
				if (!first) sb.append('&');
				else first = false;
				try {
					sb.append(p.getKey() + "=" + URLEncoder.encode(p.getValue(), "UTF-8"));
				} catch (UnsupportedEncodingException e) {
					throw new RuntimeException(e);
				}
			}
			if (sb.length() > 0) url = url + "?" + sb.toString();
		}
		try {
			url = url.replace("|", URLEncoder.encode("|", "UTF-8"));
		} catch (Exception e) {
			QueueLog.error(log, e);
		}
		HttpGet request = new HttpGet(url);
		return httpRequest(request, null, timeoutMS);
	}

	public static String getString(String url, KeyValuePair<String, String>[] parameters){
		return getString(url, parameters, DefaultTimeoutMS);
	}

	public static String getString(String url, Map<String, String> parameters){
		return getString(url, parameters, null);
	}
	
	public static String getString(String url, Map<String, String> parameters, Map<String, String> header){
		return getString(url, parameters, header, DefaultTimeoutMS);
	}
	
	public static String getString(String url, Map<String, String> parameters, Map<String, String> header, int timeoutms){
		return getString(null, null, url, parameters, header, timeoutms);
	}
	
	public static String getString(String user, String pwd, String url, Map<String, String> parameters){
		return getString(user, pwd, url, parameters, null, DefaultTimeoutMS);
	}
	
	public static String getString(String user, String pwd, String url, Map<String, String> parameters, int timeoutms){
		return getString(user, pwd, url, parameters, null, timeoutms);
	}
	
	public static String getString(String user, String pwd, String url, Map<String, String> parameters, Map<String, String> header, int timeoutms){
		StringBuilder sb = new StringBuilder();
		boolean first = true;

		if(parameters != null && !parameters.isEmpty()){
			for (Entry<String, String> p : parameters.entrySet()){
				if (!first) sb.append('&');
				else first = false;
				try {
					sb.append(p.getKey() + "=" + URLEncoder.encode(p.getValue(), "UTF-8"));
				} catch (UnsupportedEncodingException e) {
					throw new RuntimeException(e);
				}
			}
			if (sb.length() > 0) url = url + "?" + sb.toString();
		}
		HttpGet request = new HttpGet(url);
		if(header != null && !header.isEmpty()){
			for(Entry<String, String> entry : header.entrySet()){
				request.setHeader(entry.getKey(), entry.getValue());
			}
		}
		return httpRequest(user, pwd, request, null, timeoutms);
		
	}

	public static String getString(String url, int timeoutMS,int retryCount){
		
			KeyValuePair<String, String>[] params = new KeyValuePair[0];
			try
			{
				return getString(url, params, timeoutMS);
			}
			catch(Exception ex)
			{
				QueueLog.error(AppLoggers.ErrorLogger, ex);
				retryCount--;
				if(retryCount>=0)
					return getString(url,timeoutMS,retryCount);
				else
					return "";
			}
	
		
	}
	public static String getString(String url, int timeoutMS){
		KeyValuePair<String, String>[] params = new KeyValuePair[0];
		return getString(url, params, timeoutMS);
	}

	public static String getString(String url){
		return getString(url, DefaultTimeoutMS);
	}

	public static String getString(String url, String contentType){
		HttpGet request = new HttpGet(url);
		return httpRequest(request, contentType);
	}

	public static void getStringAsync(String url, KeyValuePair<String, String>[] parameters){
		CalculatePool.queueUserWorkItem(()->{
			getString(url, parameters);
		}, (e)->{
			log.error("fail, msg:{}, url:{}", e.getMessage(), url);
			e.printStackTrace();
		});
	}

	public static void getStringAsync(String url, KeyValuePair<String, String>[] parameters, Consumer<String> consumer){
		CalculatePool.queueUserWorkItem(()->{
			String str = getString(url, parameters);
			if(consumer != null){
				consumer.accept(str);
			}
		}, (e)->{
			log.error("fail, msg:{}, url:{}", e.getMessage(), url);
			e.printStackTrace();
		});
	}

	public static void getStringAsync(String url, Map<String, String> parameters){
		CalculatePool.queueUserWorkItem(()->{
			getString(url, parameters);
		}, (e)->{
			log.error("fail, msg:{}, url:{}", e.getMessage(), url);
			e.printStackTrace();
		});
	}

	public static void getStringAsync(String url){
		CalculatePool.queueUserWorkItem(()->{
			getString(url);
		}, (e)->{
			log.error("fail, msg:{}, url:{}", e.getMessage(), url);
			e.printStackTrace();
		});
	}

	public static void getStringAsync(String url, Consumer<String> consumer){
		CalculatePool.queueUserWorkItem(()->{
			String str = getString(url);
			if(consumer != null){
				consumer.accept(str);
			}
		}, (e)->{
			log.error("fail, msg:{}, url:{}", e.getMessage(), url);
			e.printStackTrace();
		});
	}

	public static void getStringAsync(String url, Map<String, String> parameters, Consumer<String> consumer){
		CalculatePool.queueUserWorkItem(()->{
			String str = getString(url, parameters);
			if(consumer != null){
				consumer.accept(str);
			}
		}, (e)->{
			log.error("fail, msg:{}, url:{}", e.getMessage(), url);
			e.printStackTrace();
		});
	}

	
	public static byte[] getBytes(String url, Map<String, String> parameters, Map<String, String> header, Map<String, String> responseHeader){
		StringBuilder sb = new StringBuilder();
		boolean first = true;

		if(parameters != null && !parameters.isEmpty()){
			for (Entry<String, String> p : parameters.entrySet()){
				if (!first) sb.append('&');
				else first = false;
				try {
					sb.append(p.getKey() + "=" + URLEncoder.encode(p.getValue(), "UTF-8"));
				} catch (UnsupportedEncodingException e) {
					throw new RuntimeException(e);
				}
			}
			if (sb.length() > 0) url = url + "?" + sb.toString();
		}
		HttpGet request = new HttpGet(url);
		return httpRequest(null, null, request, header, null, responseHeader, null, DefaultTimeoutMS);
	}
	
	public static byte[] getBytes(String url, Map<String, String> parameters, Map<String, String> header, byte[] data, Map<String, String> responseHeader){
		StringBuilder sb = new StringBuilder();
		boolean first = true;

		if(parameters != null && !parameters.isEmpty()){
			for (Entry<String, String> p : parameters.entrySet()){
				if (!first) sb.append('&');
				else first = false;
				try {
					sb.append(p.getKey() + "=" + URLEncoder.encode(p.getValue(), "UTF-8"));
				} catch (UnsupportedEncodingException e) {
					throw new RuntimeException(e);
				}
			}
			if (sb.length() > 0) url = url + "?" + sb.toString();
		}
		HttpGet request = new HttpGet(url);
		return httpRequest(null, null, request, header, data, responseHeader, null, DefaultTimeoutMS);
	}
	
	public static byte[] getBytes(String url, Map<String, String> header, Map<String, String> responseHeader){
		return getBytes(url, null, header, responseHeader);
	}
	
	public static byte[] getBytes(String url, Map<String, String> header, byte[] data, Map<String, String> responseHeader){
		return getBytes(url, null, header, data, responseHeader);
	}
	
	private static KeyValuePair<String, String>[] toKeyValuePair(Map<String, Object> parameters){
		KeyValuePair<String, String>[] params = null;
		if(parameters != null){
			params = new KeyValuePair[parameters.size()];
		}
		if(params != null){
			int i = 0;
			for(Map.Entry<String, Object> entry : parameters.entrySet()){
				KeyValuePair<String, String> param = new KeyValuePair<String, String>(entry.getKey(), entry.getValue().toString());
				params[i++] = param;
			}
		}
		return params;
	}

	public static String httpPost(String url, KeyValuePair<String, String>[] parameters){
		return httpPost(null, null, url, parameters);
	}
	
	public static String httpPost(String url, Map<String, Object> parameters){
		return httpPost(url, parameters, null, (String)null);
	}
	
	public static String httpPost(String url, Map<String, Object> parameters, Map<String, String> headers){
		return httpPost(url, parameters, headers, (String)null, DefaultTimeoutMS);
	}

	public static String httpPost(String url, Map<String, Object> parameters, Map<String, String> headers, int timeout){
		return httpPost(url, parameters, headers, (String)null, timeout);
	}
	
	public static String httpPost(String url, Map<String, Object> parameters, Map<String, String> headers, String contenttype) {
		return httpPost(url, parameters, headers, contenttype, DefaultTimeoutMS);
	}

	public static String httpPost(String url, Map<String, Object> parameters, Map<String, String> headers, String contenttype, int timeout){
		KeyValuePair<String, String>[] params = toKeyValuePair(parameters);
		return httpPost(null, null, url, params, headers, null, contenttype, timeout);
	}

	public static String httpPost(String url, Map<String, Object> parameters, Map<String, String> headers, Map<String, String> responseHeaders){
		KeyValuePair<String, String>[] params = toKeyValuePair(parameters);
		return httpPost(null, null, url, params, headers, responseHeaders);
	}

	public static String httpPost(String user, String password, String url, KeyValuePair<String, String>[] parameters){
		return httpPost(user, password, url, parameters, null);
	}

	public static String httpPost(String url, KeyValuePair<String, String>[] parameters, Map<String, String> headers){
		return httpPost(null, null, url, parameters, headers);
	}

	public static String httpPost(String url, KeyValuePair<String, String>[] parameters, Map<String, String> headers, Map<String, String> responseHeaders){
		return httpPost(null, null, url, parameters, headers, responseHeaders);
	}

	public static String httpPost(String user, String password, String url, KeyValuePair<String, String>[] parameters, Map<String, String> headers, Map<String, String> responseHeaders){
		return httpPost(user, password, url, parameters, headers, responseHeaders, null, DefaultTimeoutMS);
	}
	
	public static String httpPost(String user, String password, String url, KeyValuePair<String, String>[] parameters, Map<String, String> headers){
		return httpPost(user, password, url, parameters, headers, null, null, DefaultTimeoutMS);
	}
	
	public static String httpPost(String user, String password, String url, KeyValuePair<String, String>[] parameters, Map<String, String> headers, String contenttype){
		return httpPost(user, password, url, parameters, headers, null, contenttype, DefaultTimeoutMS);
	}
	
	public static String httpPost(String user, String password, String url, KeyValuePair<String, String>[] parameters, Map<String, String> headers, Map<String, String> responseHeaders, String contenttype, int timeoutMS){
		Map<String, Object> map = new HashMap<String, Object>();
		for(KeyValuePair<String, String> kv : parameters){
			map.put(kv.getKey(), kv.getValue());
		}
		if(needHystrix){
			PostHystrixCommand cmd = new PostHystrixCommand(user, password, url, map, headers, responseHeaders, contenttype, timeoutMS);
			return cmd.execute();
		}else{
			return PostHystrixCommand.doCmd(user, password, url, map, headers, responseHeaders, contenttype, timeoutMS);
		}
	}
	
	public static String httpPost(String url){
		return httpPost(url, (String)null, (Map<String, String>)null);
	}

	public static String httpPost(String url, String params, Map<String, String> headers){
		return httpPost(url, params, headers, DefaultTimeoutMS);
	}

	public static String httpPost(String url, String params, Map<String, String> headers, String conttype, HttpStatusCode status){
		return httpPost(null, null, url, params, headers, conttype, null, DefaultTimeoutMS, status);
	}

	public static String httpPost(String url, String params, Map<String, String> headers, HttpStatusCode status){
		return httpPost(null, null, url, params, headers, null, null, DefaultTimeoutMS, status);
	}

	public static String httpPost(String url, String params, Map<String, String> headers, int timeoutMS){
		return httpPost(url, params, headers, null, timeoutMS);
	}

	public static String httpPost(String url, String params, Map<String, String> headers, String contenttype, int timeoutMS){
		return httpPost(null, null, url, params, headers, contenttype, null, timeoutMS, null);
	}

	public static String httpPost(String url, String params, Map<String, String> headers, String contenttype, Map<String, String> responseHeaders, int timeoutMS){
		return httpPost(null, null, url, params, headers, contenttype, responseHeaders, timeoutMS, null);
	}

	public static String httpPost(String user, String password, String url, String params, HttpStatusCode status){
		return httpPost(user, password, url, params, null, null, null, DefaultTimeoutMS, status);
	}
	
	public static String httpPost(String user, String password, String url, String params){
		return httpPost(user, password, url, params, null);
	}
	
	public static String httpPost(String user, String password, String url, String params, Map<String, String> headers, String contenttype, Map<String, String> responseHeaders, int timeoutMS, HttpStatusCode status){
		if(needHystrix){
			PostStringHystrixCommand cmd = new PostStringHystrixCommand(user, password, url, params, headers, contenttype, responseHeaders, timeoutMS, status);
			return cmd.execute();
		}else{
			return PostStringHystrixCommand.doCmd(user, password, url, params, headers, contenttype, responseHeaders, timeoutMS, status);
		}
	}

	public static String httpPost(String url, byte[] data, Map<String, String> headers){
		return httpPost(url, data, headers, "application/octet-stream");
	}

	public static String httpPost(String url, byte[] data, Map<String, String> headers, String contenttype){
		byte[] raw = httpPostToBytes(url, data, headers, contenttype, null);
		try {
			return new String(raw, "UTF-8");
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
	}

	public static byte[] httpPostToBytes(String url){
		return httpPostToBytes(url, null, null, null, null);
	}

	public static byte[] httpPostToBytes(String url, Map<String, String> responseHeaders){
		return httpPostToBytes(url, null, null, null, responseHeaders);
	}

	public static byte[] httpPostToBytes(String url, byte[] data, Map<String, String> headers){
		return httpPostToBytes(url, data, headers, "application/octet-stream", null);
	}

	public static byte[] httpPostToBytes(String url, byte[] data, Map<String, String> headers, Map<String, String> responseHeaders){
		return httpPostToBytes(url, data, headers, "application/octet-stream", responseHeaders);
	}

	public static byte[] httpPostToBytes(String url, byte[] data, Map<String, String> headers, String contenttype, Map<String, String> responseHeaders){
		return httpPostToBytes(url, data, headers, contenttype, responseHeaders, DefaultTimeoutMS);
	}

	public static byte[] httpPostToBytes(String url, byte[] data, Map<String, String> headers, String contenttype, Map<String, String> responseHeaders, int timeoutMS){
		return httpPostToBytes(null, null, url, data, headers, contenttype, responseHeaders, timeoutMS);
	}

	public static byte[] httpPostToBytes(String user, String password, String url, byte[] data, Map<String, String> headers, String contenttype, Map<String, String> responseHeaders, int timeoutMS){
		if(needHystrix){
			PostBytesHystrixCommand cmd = new PostBytesHystrixCommand(user, password, url, data, headers, responseHeaders, contenttype, timeoutMS);
			return cmd.execute();
		}else{
			return PostBytesHystrixCommand.doCmd(user, password, url, data, headers, responseHeaders, contenttype, timeoutMS);
		}
	}

	public static String httpResponseHeader(String url, String responseHeaderKey, int timeoutMS){
		return httpResponseHeader(null, null, url, responseHeaderKey, timeoutMS);
	}
	
	public static String httpResponseHeader(String user, String password, String url, String responseHeaderKey, int timeoutMS){
		if(needHystrix){
			HttpResponseHeaderHystrixCommand cmd = new HttpResponseHeaderHystrixCommand(user, password, url, responseHeaderKey, timeoutMS);
			return cmd.execute();
		}else{
			return HttpResponseHeaderHystrixCommand.doCmd(user, password, url, responseHeaderKey, timeoutMS);
		}
	}

	public static String httpPost(String url, InputStream ins, Map<String, String> headers){
		return httpPost(url, ins, headers, DefaultTimeoutMS);
	}

	public static String httpPost(String url, InputStream ins, Map<String, String> headers, int timeoutMS){
		return httpPost(null, null, url, ins, headers, timeoutMS);
	}

	public static String httpPost(String user, String password, String url, InputStream ins, Map<String, String> headers, int timeoutMS){
		if(needHystrix){
			PostStreamHystrixCommand cmd = new PostStreamHystrixCommand(user, password, url, ins, headers, timeoutMS);
			return cmd.execute();
		}else{
			return PostStreamHystrixCommand.doCmd(user, password, url, ins, headers, timeoutMS);
		}
	}

	public static String httpPost(String url, String params, int timeoutMS){
		return httpPost(url, params, null, null, timeoutMS);
	}

	public static String httpPost(String url, String params, String contenttype, int timeoutMS){
		return httpPost(url, params, null, contenttype, timeoutMS);
	}

	public static String httpPost(String url, String params, String contenttype){
		return httpPost(url, params, null, contenttype, DefaultTimeoutMS);
	}

	public static String httpPost(String url, String params){
		return httpPost(url, params, null, null, DefaultTimeoutMS);
	}

	public static void httpPostAsync(String url, KeyValuePair<String, String>[] parameters){
		CalculatePool.queueUserWorkItem(()->{
			httpPost(url, parameters);
		}, (e)->{
			log.error("fail, msg:{}, url:{}", e.getMessage(), url);
			e.printStackTrace();
		});
	}

	public static void httpPostAsync(String url, KeyValuePair<String, String>[] parameters, Consumer<String> consumer){
		CalculatePool.queueUserWorkItem(()->{
			String resp = httpPost(url, parameters);
			if(consumer != null){
				consumer.accept(resp);
			}
		}, (e)->{
			log.error("fail, msg:{}, url:{}", e.getMessage(), url);
			e.printStackTrace();
		});
	}
	
	public static Object getObject(String url){
		return getObject(null, null, url, null, DefaultTimeoutMS);
	}
	
	public static Object getObject(String url, int timeoutMS){
		return getObject(null, null, url, null, timeoutMS);
	}

	public static Object getObject(String user, String password, String url, Map<String, String> headers, int timeoutMS){
		if(needHystrix){
			HttpGetObjectHystrixCommand cmd = new HttpGetObjectHystrixCommand(user, password, url, headers, timeoutMS);
			return cmd.execute();
		}else{
			return HttpGetObjectHystrixCommand.doCmd(user, password, url, headers, timeoutMS);
		}
	}
	
	public static String uploadString(String url, Map<String, String> headers, String contenttype, String strData) {
		return uploadString(url, headers, contenttype, strData, null, null);
	}

	public static String uploadString(String url, String contenttype, String strData){
		return uploadString(url, null, contenttype, strData, null, null);
	}

	public static String uploadString(String url, Map<String, String> headers, String contenttype, String strData, SSLConnectionSocketFactory sslConnFactory){
		return uploadString(url, headers, contenttype, strData, null, sslConnFactory);
	}
	
	public static String uploadString(String url, Map<String, String> headers, String contenttype, String strData, Map<String, String> respHeadMap) {
		return uploadString(url, headers, contenttype, strData, respHeadMap, null);
	}

	public static String uploadString(String url, Map<String, String> headers, String contenttype, String strData, Map<String, String> respHeadMap, SSLConnectionSocketFactory sslConnFactory){
		HttpPost postRequest = new HttpPost(url);
		try {
			postRequest.setEntity(new StringEntity(strData, "UTF-8"));
		} catch (Exception e) {
			throw new RuntimeException(e);
		}

		if(needHystrix){
			HttpUriRequestHystrixCommand cmd = new HttpUriRequestHystrixCommand(null, null, postRequest, headers, contenttype, DefaultTimeoutMS, null, respHeadMap, sslConnFactory);
			return cmd.execute();
		}else{
			return HttpUriRequestHystrixCommand.doCmd(null, null, postRequest, headers, contenttype, DefaultTimeoutMS, null, respHeadMap, sslConnFactory);
		}
		
	}

	public static void uploadStringAsync(String url, String contenttype, String strData){
		CalculatePool.queueUserWorkItem(()->{
			uploadString(url, contenttype, strData);
		}, (e)->{
			log.error("fail, msg:{}, url:{}", e.getMessage(), url);
			e.printStackTrace();
		});
	}

	public static void uploadStringAsync(String url, String contenttype, String strData, Consumer<String> consumer){
		CalculatePool.queueUserWorkItem(()->{
			String str = uploadString(url, contenttype, strData);
			if(consumer != null){
				consumer.accept(str);
			}
		}, (e)->{
			log.error("fail, msg:{}, url:{}", e.getMessage(), url);
			e.printStackTrace();
		});
	}

	public static String uploadJson(String url, String jsonData){
		return uploadString(url, "application/json; charset=UTF-8", jsonData);
	}

	public static String uploadJson(String url, Map<String, Object> data){
		String jsonData = JsonUtility.encode(data);
		return uploadString(url, "application/json; charset=UTF-8", jsonData);
	}

	public static String uploadJson(String url, Map<String, String> headers, String jsonData){
		return uploadString(url, headers, "application/json; charset=UTF-8", jsonData);
	}

	public static String uploadJson(String url, Map<String, String> headers, Map<String, Object> data){
		String jsonData = JsonUtility.encode(data);
		return uploadString(url, headers, "application/json; charset=UTF-8", jsonData);
	}

	public static void uploadJsonAsync(String url, String jsonData){
		CalculatePool.queueUserWorkItem(()->{
			uploadJson(url, jsonData);
		}, (e)->{
			log.error("fail, msg:{}, url:{}", e.getMessage(), url);
			e.printStackTrace();
		});
	}

	public static void uploadJsonAsync(String url, String jsonData, Consumer<String> consumer){
		CalculatePool.queueUserWorkItem(()->{
			String str = uploadJson(url, jsonData);
			if(consumer != null){
				consumer.accept(str);
			}
		}, (e)->{
			log.error("fail, msg:{}, url:{}", e.getMessage(), url);
			e.printStackTrace();
		});
	}

	public static int httpPut(String url, Object data){
		return httpSendObject(url, data, HttpClientUtility.HttpMethodPut, null).responseCode;
	}

	public static HttpResult httpPostObject(String url, Object data){
		return httpSendObject(url, data, HttpClientUtility.HttpMethodPost, null);
	}

	public static int httpPut(String url, Object data, Map<String, String> header){
		return httpSendObject(url, data, HttpClientUtility.HttpMethodPut, header).responseCode;
	}

	public static int httpPostObject(String url, Object data, Map<String, String> header){
		return httpSendObject(url, data, HttpClientUtility.HttpMethodPost, header).responseCode;
	}



	public static String httpPut(String url){
		HttpPut request = new HttpPut(url);
		return httpRequest(request, null);
	}

	public static String httpPut(String url, String contenttype, String strData){
		HttpPut request = new HttpPut(url);
		try {
			request.setEntity(new StringEntity(strData));
		} catch (UnsupportedEncodingException e) {
			throw new RuntimeException(e);
		}
		return httpRequest(request, contenttype);
	}
	
	public static Map<String, String> httpHead(String url){
		return httpHead(url, DefaultTimeoutMS);
	}

	public static Map<String, String> httpHead(String url, int timeoutMS){
		HttpHead request = new HttpHead(url);
		return httpRequestResponseHead(null, null, request, null, null, timeoutMS);
	}

	public static String httpHead(String url, String key, int timeoutMS){
		HttpHead request = new HttpHead(url);
		Map<String, String> header = httpRequestResponseHead(null, null, request, null, null, timeoutMS);
		return header.get(key);
	}

	public static String httpOptions(String url){
		HttpOptions request = new HttpOptions(url);
		return httpRequest(request, null);
	}

	public static String httpDelete(String url){
		HttpDelete request = new HttpDelete(url);
		return httpRequest(request, null);
	}
	
	public static String httpDelete(String user, String password, String url){
		return httpDelete(user, password, url, null);
	}

	public static String httpDelete(String user, String password, String url, HttpStatusCode status){
		HttpDelete request = new HttpDelete(url);
		return httpRequest(user, password, request, null, null, DefaultTimeoutMS, status, null);
	}

	public static String httpDelete(String url, Map<String, String> headers){
		return httpDelete(url, headers, null);
	}
	
	public static String httpDelete(String url, Map<String, String> headers, HttpStatusCode status){
		HttpDelete request = new HttpDelete(url);
		return httpRequest(null, null, request, headers, null, DefaultTimeoutMS, status, null);
	}


	public static long download(String url, String destfile){
		byte[] data = httpGetBytes(url, 3600000);
		FileUtility.save(destfile, data);
		return FileUtility.getFileSize(destfile);
	}
	
	public static byte[] download(String url) {
		byte[] data = httpGetBytes(url, 3600000);
		return data;
	}
	
	public static byte[] httpGetBytes(String url){
		return httpGetBytes(null, null, url, null, DefaultTimeoutMS);
	}
	
	public static byte[] httpGetBytes(String url, int timeoutMS){
		return httpGetBytes(null, null, url, null, timeoutMS);
	}
	
	public static byte[] httpGetBytes(String url, int timeoutMS,String proxyHost,int proxyPort){
		return httpGetBytes(null, null, url, null, timeoutMS,proxyHost,proxyPort);
	}

	public static byte[] httpGetBytes(String url, Map<String, String> headers, int timeoutMS){
		return httpGetBytes(null, null, url, headers, timeoutMS);
	}

	public static byte[] httpGetBytes(String user, String password, String url, Map<String, String> headers, int timeoutMS){
		return httpGetBytes(user,password,url,headers,timeoutMS,null,0);
	}
	
	public static byte[] httpGetBytes(String user, String password, String url, Map<String, String> headers, int timeoutMS,
			String proxyHost,int proxyPort){
		if(needHystrix){
			HttpGetBytesHystrixCommand cmd = new HttpGetBytesHystrixCommand(user, password, url, headers, timeoutMS,
					proxyHost,proxyPort);
			return cmd.execute();
		}else{
			return HttpGetBytesHystrixCommand.doCmd(user, password, url, headers, timeoutMS,proxyHost,proxyPort);
		}
	}

	public static byte[] httpPostMultiPart(String url, List<MultiPartContent> multiparts){
		return httpPostMultiPart(url, DefaultTimeoutMS*multiparts.size(), multiparts);
	}

	public static byte[] httpPostMultiPart(String url, List<MultiPartContent> multiparts, Map<String, String> responseHeaders){
		return httpPostMultiPart(url, null, responseHeaders, DefaultTimeoutMS*multiparts.size(), multiparts);
	}

	public static byte[] httpPostMultiPart(String url, Integer timeoutMS, List<MultiPartContent> multiparts){
		return httpPostMultiPart(url, null, null, timeoutMS, multiparts);
	}

	public static byte[] httpPostMultiPart(String url, Map<String, String> headers, Map<String, String> responseHeaders, 
			Integer timeoutMS, List<MultiPartContent> multiparts){
		return httpPostMultiPart(null, null, url, headers, responseHeaders, timeoutMS, multiparts);
	}
	
	public static byte[] httpPostMultiPart(String url, Map<String, String> headers, Map<String, String> responseHeaders, List<MultiPartContent> multiparts){
		return httpPostMultiPart(null, null, url, headers, responseHeaders, DefaultTimeoutMS*multiparts.size(), multiparts);
	}
	
	public static byte[] httpPostMultiPart(String url, Map<String, String> headers, List<MultiPartContent> multiparts){
		return httpPostMultiPart(null, null, url, headers, null, DefaultTimeoutMS*multiparts.size(), multiparts);
	}
	
	public static byte[] httpPostMultiPart(String url, List<MultiPartContent> multiparts, Map<String, String> headers, HttpStatusCode status){
		return httpPostMultiPart(null, null, url, headers, null, DefaultTimeoutMS*multiparts.size(), multiparts, status);
	}
	
	public static byte[] httpPostMultiPart(String user, String password, String url, List<MultiPartContent> multiparts){
		return httpPostMultiPart(user, password, url, null, null, DefaultTimeoutMS*multiparts.size(), multiparts);
	}

	public static byte[] httpPostMultiPart(String user, String password, String url, Map<String, String> headers, List<MultiPartContent> multiparts){
		return httpPostMultiPart(user, password, url, headers, null, DefaultTimeoutMS*multiparts.size(), multiparts);
	}
	
	public static byte[] httpPostMultiPart(String user, String password, String url, Map<String, String> headers, Map<String, String> responseHeaders, 
			Integer timeoutMS, List<MultiPartContent> multiparts){
		return httpPostMultiPart(user, password, url, headers, responseHeaders, timeoutMS, multiparts, null);
	}

	public static byte[] httpPostMultiPart(String user, String password, String url, Map<String, String> headers, Map<String, String> responseHeaders, 
			Integer timeoutMS, List<MultiPartContent> multiparts, HttpStatusCode status){
		if(needHystrix){
			PostMultiPartHystrixCommand cmd = new PostMultiPartHystrixCommand(user, password, url, multiparts, headers, responseHeaders, timeoutMS, status);
			return cmd.execute();
		}else{
			return PostMultiPartHystrixCommand.doCmd(user, password, url, multiparts, headers, responseHeaders, timeoutMS, status);
		}
	}

	public static MultiPartContent createFormDataMultiPart(String fieldName, byte[] bytes, String fileName){
		FormDataContent bin = new FormDataContent();
		bin.FieldName = fieldName;
		bin.bytes = bytes;
		bin.FileName = fileName;
		return bin;
	}

	public static MultiPartContent createFormDataMultiPart(String fieldName, File file, String fileName){
		FormDataContent bin = new FormDataContent();
		bin.FieldName = fieldName;
		bin.UpFile = file;
		bin.FileName = fileName;
		return bin;
	}

	public static MultiPartContent createMultiPart(String fieldName, String text){
		TextContent txt = new TextContent();
		txt.FieldName = fieldName;
		txt.text = text;
		return txt;
	}

	public static MultiPartContent createMultiPart(String fieldName, byte[] bytes, String fileName){
		BinaryContent bin = new BinaryContent();
		bin.FieldName = fieldName;
		bin.bytes = bytes;
		bin.FileName = fileName;
		return bin;
	}

	public static MultiPartContent createMultiPart(String fieldName, byte[] bytes){
		BinaryContent bin = new BinaryContent();
		bin.FieldName = fieldName;
		bin.bytes = bytes;
		bin.FileName = fieldName;
		return bin;
	}

	public static MultiPartContent createMultiPart(String fieldName, InputStream ins, String fileName){
		InputStreamContent bin = new InputStreamContent();
		bin.FieldName = fieldName;
		bin.Stream = ins;
		bin.FileName = fileName;
		return bin;
	}

	public static MultiPartContent createMultiPart(String fieldName, InputStream ins){
		InputStreamContent bin = new InputStreamContent();
		bin.FieldName = fieldName;
		bin.Stream = ins;
		bin.FileName = fieldName;
		return bin;
	}

	public static MultiPartContent createMultiPart(String fieldName, File file, String fileName){
		FileContent bin = new FileContent();
		bin.FieldName = fieldName;
		bin.UpFile = file;
		bin.FileName = fileName;
		return bin;
	}

	public static MultiPartContent createMultiPart(String fieldName, File file){
		FileContent bin = new FileContent();
		bin.FieldName = fieldName;
		bin.UpFile = file;
		bin.FileName = file.getName();
		return bin;
	}

	public static abstract class MultiPartContent{
		public String FieldName;
	}

	public static class FormDataContent extends MultiPartContent{
		public byte[] bytes;
		public File UpFile;
		public String FileName;
	}

	public static class BinaryContent extends MultiPartContent{
		public byte[] bytes;
		public String FileName;
	}

	public static class InputStreamContent extends MultiPartContent{
		public InputStream Stream;
		public String FileName;
	}

	public static class FileContent extends MultiPartContent{
		public File UpFile;
		public String FileName;
	}

	public static class TextContent extends MultiPartContent{
		public String text;
	}


	public static class HttpResult{
		public int responseCode = -1;
		public String responseMsg;
		public byte[] body;
	}
	
	public static Map<String, String> getHeadersMap(Header[] headers){
		Map<String, String> map = new HashMap<String, String>();
		if(headers == null || headers.length == 0){
			return map;
		}
		for(Header header :headers){
			map.put(header.getName(), header.getValue());
		}
		return map;
	}

	public static void main(String[] args){
		String res = httpPut("http://localhost:8080/ehcache-server-1.0.0/rest/cachtestxxx");
		System.out.println(res);

		Map map = new HashMap();
		map.put("test", "test value");
		int code = httpPut("http://localhost:8080/ehcache-server-1.0.0/rest/cachtestxxx/test", map);
		System.out.println(code);

		Object obj = getObject("http://localhost:8080/ehcache-server-1.0.0/rest/cachtestxxx/test");
		System.out.println(obj);

		res = getString("http://localhost:8080/ehcache-server-1.0.0/rest/");
		System.out.println(res);
	}

}
