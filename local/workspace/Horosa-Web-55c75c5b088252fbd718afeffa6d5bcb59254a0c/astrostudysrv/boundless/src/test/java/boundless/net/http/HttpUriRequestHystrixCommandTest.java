package boundless.net.http;

import static org.junit.Assert.assertEquals;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.Test;

public class HttpUriRequestHystrixCommandTest {

	@Test
	public void redactSensitiveHeadersMasksCredentialsKeepsOthers() {
		Map<String, String> headers = new LinkedHashMap<String, String>();
		headers.put("Authorization", "Bearer sk-secret-123");
		headers.put("x-api-key", "anth-secret");
		headers.put("X-Goog-Api-Key", "AIza-secret");
		headers.put("LocalIp", "192.168.2.83");
		headers.put("Content-Type", "application/json; charset=UTF-8");

		Map<String, String> redacted = HttpUriRequestHystrixCommand.redactSensitiveHeaders(headers);
		assertEquals(boundless.utility.SecretRedactor.MASK, redacted.get("Authorization"));
		assertEquals(boundless.utility.SecretRedactor.MASK, redacted.get("x-api-key"));
		assertEquals(boundless.utility.SecretRedactor.MASK, redacted.get("X-Goog-Api-Key"));
		assertEquals(boundless.utility.SecretRedactor.MASK, redacted.get("LocalIp"));
		assertEquals("application/json; charset=UTF-8", redacted.get("Content-Type"));
	}

	@Test
	public void stripQueryRemovesQueryString() {
		assertEquals("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
			HttpUriRequestHystrixCommand.stripQuery("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIza-secret"));
		assertEquals("https://api.openai.com/v1/chat/completions",
			HttpUriRequestHystrixCommand.stripQuery("https://api.openai.com/v1/chat/completions"));
		assertEquals("", HttpUriRequestHystrixCommand.stripQuery(null));
	}
}
