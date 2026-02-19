package boundless.spring.help.interceptor;

import java.lang.reflect.Field;
import java.util.UUID;

import javax.servlet.http.HttpServletRequest;


import boundless.exception.AppException;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;



public class RequestPacketFactory {
	
	public static RequestHead getRequestHead(HttpServletRequest request){
		RequestHead head = new RequestHead();
		head.Sign = request.getHeader(KeyConstants.Sign);
		head.Token = request.getHeader(KeyConstants.Token);
		return head;
	}

	public static RequestHead getRequestHead1(HttpServletRequest request){
		try{
			RequestHead head = new RequestHead();
			Field[] fields = RequestHead.class.getFields();
			for(Field fld : fields){
				String name = fld.getName();
				String value = request.getHeader(name);
				if(!StringUtility.isNullOrEmpty(value)){
					Class clz = fld.getType();
					Object obj = ConvertUtility.getPrimitiveValue(clz, value);
					fld.set(head, value);
				}
			}
			return head;
		}catch(Exception e){
			throw new AppException(e);
		}
	}

	public static RequestPacket newDefaultPacket(){
		RequestPacket packet = new RequestPacket();
		RequestHead head = new RequestHead();
		head.Sign = "";
		head.Token = "";
		
		packet.head = head;
		
		return packet;
	}
	
	
}
