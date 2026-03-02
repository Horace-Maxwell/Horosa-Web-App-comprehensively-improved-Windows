package boundless.spring.help.controller;

import java.io.File;

import javax.servlet.ServletException;
import javax.servlet.ServletInputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.io.FileUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HeartbeatController {

	@RequestMapping(value = "/heartbeat", method = RequestMethod.GET)
	protected String doGet(HttpServletRequest request, HttpServletResponse response) throws Exception {
		this.crossdomain(request, response);
		File file = new File(this.getPath(request));
		String shake = "ONLINE";
		if (file.exists()) {
			shake = FileUtils.readFileToString(file);
			if (shake == null || shake.isEmpty()) {
				shake = "ONLINE";
			}
		}

		return shake;
	}

	@RequestMapping(value = "/heartbeat", method = RequestMethod.PUT)
	public void doPut(HttpServletRequest request, HttpServletResponse response) throws Exception {
		this.crossdomain(request, response);
		ServletInputStream input = request.getInputStream();
		byte[] buf = new byte[1024];
		int len = input.read(buf);
		String content = new String(buf, 0, len, "utf-8");
		String[] body = content.split(";");
		String key = body[1];
		String status = body[0];
		if (!"c701e78243404508a08f021a4ac8966d".equals(key)) {
			throw new ServletException("invalid key");
		} else {
			FileUtils.writeStringToFile(new File(this.getPath(request)), status, "utf-8");
		}
	}

	@RequestMapping(value = "/heartbeat", method = RequestMethod.POST)
	public String doPost(HttpServletRequest request, HttpServletResponse response) throws Exception {
		return this.doGet(request, response);
	}

	
	@RequestMapping(value = "/heartbeat", method = RequestMethod.OPTIONS)
	public void doOptions(HttpServletRequest request, HttpServletResponse response) throws Exception {
		this.crossdomain(request, response);
	}

	private String getPath(HttpServletRequest request) {
		String healthy = "tomcat_" + request.getLocalPort() + "_"
				+ request.getServletContext().getContextPath().replace("/", "");
		return healthy;
	}

	private void crossdomain(HttpServletRequest request, HttpServletResponse response) {
		String origin = request.getHeader("Origin");
		if (origin != null && !origin.isEmpty()) {
			response.addHeader("Access-Control-Allow-Origin", origin);
		}

		String headers = request.getHeader("Access-Control-Request-Headers");
		if (headers != null && !headers.isEmpty()) {
			response.addHeader("Access-Control-Allow-Headers", headers);
		}

	}
	
}
