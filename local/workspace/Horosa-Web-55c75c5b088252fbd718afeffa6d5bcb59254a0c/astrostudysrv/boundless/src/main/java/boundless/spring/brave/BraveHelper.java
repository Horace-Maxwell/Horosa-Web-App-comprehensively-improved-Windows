package boundless.spring.brave;

import org.apache.http.impl.client.HttpClientBuilder;

public class BraveHelper {

	public static boolean existZipkin() {
		return false;
	}
	
	public static void shutdown() {
		
	}
	
	public static HttpClientBuilder getHttpClientBuilder(String url){
		return HttpClientBuilder.create();
	}
	
}
