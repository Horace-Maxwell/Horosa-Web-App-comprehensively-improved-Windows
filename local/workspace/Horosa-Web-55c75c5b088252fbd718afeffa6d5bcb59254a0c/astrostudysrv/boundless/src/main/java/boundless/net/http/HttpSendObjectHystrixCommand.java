package boundless.net.http;

import java.io.InputStream;
import java.io.ObjectOutputStream;
import java.net.HttpURLConnection;
import java.net.Proxy;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLSession;

import com.netflix.hystrix.HystrixCommand;
import com.netflix.hystrix.HystrixCommandGroupKey;

import boundless.io.FileUtility;
import boundless.net.http.HttpClientUtility.HttpResult;
import boundless.security.SecurityUtility;
import boundless.utility.IPUtility;
import boundless.utility.StringUtility;

public class HttpSendObjectHystrixCommand extends HystrixCommand<HttpResult>{
	private String user;
	private String password;
	private String url;
	private Object data;
	private Map<String, String> headers;
	private String method;
	
	public HttpSendObjectHystrixCommand(String user, String password, String url, Object data, String method, Map<String, String> headers){
		super(HystrixCommandGroupKey.Factory.asKey(StringUtility.getUri(url)));
		
		this.user = user;
		this.password = password;
		this.url = url;
		this.headers = headers;
		this.data = data;
		this.method = method;
	}

	@Override
	protected HttpResult run() throws Exception {
		return doCmd(user, password, url, data, method, headers);
	}

	@Override  
    protected HttpResult getFallback() {  
		HttpResult res = new HttpResult();
        return res;  
    }  
	
	public static HttpResult doCmd(String user, String password, String url, Object data, String method, Map<String, String> headers){
		try{
			URL address = new URL(url);
			HttpURLConnection connection;
			Proxy proxy = HttpClientUtility.getProxy();
			if(proxy != null) {
				connection = (HttpURLConnection) address.openConnection(proxy);
			}else {
				connection = (HttpURLConnection) address.openConnection();
			}
			
			if(!StringUtility.isNullOrEmpty(password)){
				String userpass = String.format("%s:%s", user, password);
				String baseAuth = String.format("Basic %s", SecurityUtility.base64(userpass.getBytes("UTF-8")));
				connection.setRequestProperty("Authorization", baseAuth);
			}
			if(connection instanceof HttpsURLConnection){
				HttpsURLConnection conn = (HttpsURLConnection)connection;
				conn.setHostnameVerifier(new HostnameVerifier() {
					@Override
					public boolean verify(String hostname, SSLSession session) {
						return true;
					}
				});
			}
			connection.setRequestMethod(method);
			Map<String, String> tmphead = headers;
			if(tmphead == null){
				tmphead = new HashMap<String, String>();
			}
			for(Entry<String, String> entry : tmphead.entrySet()){
				connection.addRequestProperty(entry.getKey(), entry.getValue());
			}
			try{
				String[] ips = IPUtility.getLocalIps();
				connection.addRequestProperty("LocalIp", ips[0]);
			}catch(Exception e){
			}
			
			connection.setRequestProperty("Content-Type", "application/x-java-serialized-object");
			connection.setDoOutput(true);
			connection.setDoInput(true);

			ObjectOutputStream outputStreamWriter = new ObjectOutputStream(connection.getOutputStream());
			outputStreamWriter.writeObject(data);
			outputStreamWriter.flush();
			outputStreamWriter.close();

			connection.connect();

			HttpResult result = new HttpResult();

			result.responseCode = connection.getResponseCode();
			result.responseMsg = connection.getResponseMessage(); 

			if(result.responseCode == 200){
				InputStream ins = connection.getInputStream();
				result.body = FileUtility.getBytesFromStream(ins);
			}else{
				InputStream ins = connection.getErrorStream();
				result.body = FileUtility.getBytesFromStream(ins);
			}

			connection.disconnect();
			return result;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}

}
