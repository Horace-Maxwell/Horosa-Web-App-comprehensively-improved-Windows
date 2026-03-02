package boundless.net.http;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClient.RequestBodyUriSpec;
import org.springframework.web.reactive.function.client.WebClient.ResponseSpec;


import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public class SseClientCommand {
	private static int DefaultTimeout = 120000;
	
	
	private String user;
	private String password;
	private String url;
	private Map<String, Object> params;
	private Map<String, String> headers;
	private Map<String, String> responseHeaders;
	private String contenttype;
	private int timeoutMS;

	public SseClientCommand(String user, String password, 
			String url, Map<String, Object> params, 
			Map<String, String> headers, Map<String, String> responseHeaders, String contenttype, int timeoutMS){
		
		this.user = user;
		this.password = password;
		this.url = url;
		this.params = params;
		this.headers = headers;
		this.responseHeaders = responseHeaders;
		this.contenttype = contenttype;
		this.timeoutMS = timeoutMS;
	}
	
	private static ResponseSpec _doCmd(String user, String password, 
			String url, Map<String, Object> params, 
			Map<String, String> headers, Map<String, String> responseHeaders, 
			String contenttype, int timeoutMS) {
		WebClient client = WebClient.create(url);
		RequestBodyUriSpec reqBody = client.post();
		if(headers != null) {
			for(Map.Entry<String, String> entry : headers.entrySet()) {
				reqBody.header(entry.getKey(), entry.getValue());
			}
		}
		if(StringUtility.isNullOrEmpty(contenttype)) {
			reqBody.contentType(MediaType.APPLICATION_JSON);
			reqBody.bodyValue(params);
		}else {
			String ct = contenttype.toLowerCase();
			if(ct.contains("x-www-form-urlencoded")) {
				MultiValueMap<String, Object> form = new LinkedMultiValueMap<String, Object>();
				for(Map.Entry<String, Object> entry : params.entrySet()) {
					form.put(entry.getKey(), Arrays.asList(entry.getValue()));
				}
				reqBody.bodyValue(form);
			}else {
				String[] parts = StringUtility.splitString(contenttype, '/');
				if(parts.length > 1) {
					reqBody.contentType(new MediaType(parts[0], parts[1]));
				}else {
					reqBody.contentType(new MediaType(contenttype));				
				}				
			}
		}
		
		ResponseSpec resp = reqBody.retrieve();
		
		return resp;
	}
	
	public static List<String> doCmd(String user, String password, 
			String url, Map<String, Object> params, 
			Map<String, String> headers, Map<String, String> responseHeaders, 
			String contenttype, int timeoutMS) {
		ResponseSpec resp = _doCmd(user, password, url, params, headers, responseHeaders, contenttype, timeoutMS);
		
		List<String> res = resp.bodyToFlux(String.class).collectList().block();		
		return res;
		
	}
	
	public static Flux<String> doCmdAsync(String user, String password, 
			String url, Map<String, Object> params, 
			Map<String, String> headers, Map<String, String> responseHeaders, 
			String contenttype, int timeoutMS) {
		ResponseSpec resp = _doCmd(user, password, url, params, headers, responseHeaders, contenttype, timeoutMS);
		
		Flux<String> res = resp.bodyToFlux(String.class);		
		return res;
		
	}
	
	public static List<String> postFormData(String url, Map<String, Object> params) {
		return doCmd(null, null, url, params, null, null, "application/x-www-form-urlencoded", DefaultTimeout);
	}
	
	public static Flux<String> postFormDataAsync(String url, Map<String, Object> params) {
		return doCmdAsync(null, null, url, params, null, null, "application/x-www-form-urlencoded", DefaultTimeout);
	}
	
	public static List<String> postFormData(String url, Map<String, Object> params, Map<String, String> headers) {
		return doCmd(null, null, url, params, headers, null, "application/x-www-form-urlencoded", DefaultTimeout);
	}
	
	public static Flux<String> postFormDataAsync(String url, Map<String, Object> params, Map<String, String> headers) {
		return doCmdAsync(null, null, url, params, headers, null, "application/x-www-form-urlencoded", DefaultTimeout);
	}
	
	public static List<String> postJson(String url, Map<String, Object> params, Map<String, String> headers) {
		return doCmd(null, null, url, params, headers, null, null, DefaultTimeout);
	}
	
	public static void main(String[] args) {
		String url = "https://chat-server.4utech.com/shiyou/chat";
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("text", "说个笑话");
		params.put("target_id", "shiyoukeji");
		params.put("source", "MAS");
		
		List<String> str = doCmd(null, null, url, params, null, null, "application/x-www-form-urlencoded", DefaultTimeout);
		System.out.println(JsonUtility.encodePretty(str));
	}

}
