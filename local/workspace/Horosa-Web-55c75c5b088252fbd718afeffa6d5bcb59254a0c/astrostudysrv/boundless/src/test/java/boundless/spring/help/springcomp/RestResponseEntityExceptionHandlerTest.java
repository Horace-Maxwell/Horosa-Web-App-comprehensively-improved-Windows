package boundless.spring.help.springcomp;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class RestResponseEntityExceptionHandlerTest {
	@Test
	public void sanitizeRequestDataForLogRedactsSensitiveFields() {
		String raw = "{\n"
			+ "  \"head\": {\n"
			+ "    \"authorization\": \"Bearer secret-token\"\n"
			+ "  },\n"
			+ "  \"body\": {\n"
			+ "    \"apiKey\": \"sk-secret-value\",\n"
			+ "    \"providerOptions\": {\n"
			+ "      \"client_secret\": \"top-secret\"\n"
			+ "    }\n"
			+ "  }\n"
			+ "}";

		String sanitized = RestResponseEntityExceptionHandler.sanitizeRequestDataForLog(raw);

		assertFalse(sanitized.contains("sk-secret-value"));
		assertFalse(sanitized.contains("secret-token"));
		assertFalse(sanitized.contains("top-secret"));
		assertTrue(sanitized.contains(boundless.utility.SecretRedactor.MASK));
	}

	@Test
	public void sanitizeQueryStringForLogRedactsSecrets() {
		String raw = "providerType=deepseek&apiKey=sk-secret-value&token=abc123";
		String sanitized = RestResponseEntityExceptionHandler.sanitizeQueryStringForLog(raw);

		assertFalse(sanitized.contains("sk-secret-value"));
		assertFalse(sanitized.contains("abc123"));
		assertTrue(sanitized.contains(boundless.utility.SecretRedactor.MASK));
	}
}
