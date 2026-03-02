package boundless.spring.help.interceptor;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;

import javax.servlet.ReadListener;
import javax.servlet.ServletInputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletRequestWrapper;

import boundless.io.FileUtility;
import boundless.utility.StringUtility;

public class SafeHttpServletRequestWrapper extends HttpServletRequestWrapper {

    private final byte[] body;

    public SafeHttpServletRequestWrapper(HttpServletRequest request) throws IOException {
        super(request);
        String contype = request.getContentType();
        if(contype != null && contype.equalsIgnoreCase("application/json")) {
        	String plainbody = (String) request.getAttribute(KeyConstants.PlainBody);
        	if(StringUtility.isNullOrEmpty(plainbody)) {
                this.body = FileUtility.getBytesFromStream(request.getInputStream());        	        		
        	}else {
        		try {
        			this.body = plainbody.getBytes("UTF-8");
        		}catch(Exception e) {
        			throw new RuntimeException(e);
        		}
        	}
        }else {
        	this.body = null;
        }
    }
    
    @Override
    public BufferedReader getReader() throws IOException {
    	if(this.body == null) {
    		return super.getReader();
    	}
        return new BufferedReader(new InputStreamReader(getInputStream()));
    }

    @Override
    public ServletInputStream getInputStream() throws IOException {
    	if(this.body == null) {
    		return super.getInputStream();
    	}

        final ByteArrayInputStream innerBAIS = new ByteArrayInputStream(body);

        return new ServletInputStream() {

            @Override
            public boolean isFinished() {
                return false;
            }

            @Override
            public boolean isReady() {
                return false;
            }

            @Override
            public void setReadListener(ReadListener readListener) {

            }

            @Override
            public int read() throws IOException {
                return innerBAIS.read();
            }
        };
    }
}