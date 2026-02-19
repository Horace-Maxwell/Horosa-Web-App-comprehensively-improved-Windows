package boundless.spring.help.interceptor;

import java.io.Serializable;
import java.net.URLDecoder;
import java.util.HashMap;
import java.util.Map;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.security.DESUtility;
import boundless.security.SecurityUtility;
import boundless.utility.ConvertUtility;
import boundless.verification.ImeiUtility;

public class RequestHead implements Serializable {
	private static final long serialVersionUID = 5451337029677358629L;

	public String Sign; // md5(body+token+校验Key)
	public String Token;

	public Map<String, String> toMap(){
		Map<String, String> map = new HashMap<String, String>();
		map.put("Sign", Sign);
		map.put("Token", Token);
		
		return map;
	}
	
	public void setHead(String key, Object value){
		String k = key.toLowerCase();
		if(k.equals("sign")){
			Sign = k;
		}else if(k.equals("token")){
			Token = k;
		}
	}
		
}
