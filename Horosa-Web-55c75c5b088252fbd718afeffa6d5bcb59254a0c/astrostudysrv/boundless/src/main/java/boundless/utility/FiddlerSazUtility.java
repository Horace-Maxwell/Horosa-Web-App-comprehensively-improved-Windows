package boundless.utility;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.io.CompressUtility;
import boundless.io.FileUtility;
import boundless.net.http.HttpClientUtility;
import boundless.types.OutParameter;

public class FiddlerSazUtility {
	
	private static class RequestObject{
		Map<String, String> head = new HashMap<String, String>();
		String body;
		String url;
		boolean isGet = false;
	}
	
	public static class ResponseObject{
		public Map<String, String> head = new HashMap<String, String>();
		public byte[] data;
	}

	public static List<byte[]> unzip(String sazfile){
		List<byte[]> list = new ArrayList<byte[]>();
		InputStream ins = FileUtility.getInputStreamFromFile(sazfile);
		
		CompressUtility.unzip(ins, (name, raw)->{
			if(name.endsWith("_c.txt") && !name.startsWith(".") && !name.startsWith("_")){
				list.add(raw);
			}
		});
		
		return list;
	}
	
	private static RequestObject getRequestObject(byte[] raw, String encoding){
		RequestObject reqobj = new RequestObject();
		
		ByteArrayInputStream bins = new ByteArrayInputStream(raw);
		OutParameter<Boolean> toRequestJson = new OutParameter<Boolean>();
		toRequestJson.value = false;
		StringBuilder sb = new StringBuilder();
		
		FileUtility.readText(bins, encoding, (line)->{
			if(line.startsWith("POST")){
				String[] parts = StringUtility.splitString(line, ' ');
				reqobj.url = parts[1];
				return;
			}else if(line.startsWith("GET")){
				String[] parts = StringUtility.splitString(line, ' ');
				reqobj.url = parts[1];
				reqobj.isGet = true;
				return;
			}else if(StringUtility.isNullOrEmpty(line) && toRequestJson.value == false){
				toRequestJson.value = true;
				return;
			}
			
			if(toRequestJson.value){
				sb.append(line);
			}else{
				String[] parts = line.split(": ");
				if(parts.length == 1){
					reqobj.head.put(parts[0], "");
				}else{
					reqobj.head.put(parts[0], parts[1]);
				}
			}

		});
		
		reqobj.body = sb.toString();
		
		return reqobj;
	}
	
	
	public static List<ResponseObject> postRequest(String sazfile, String encoding){
		List<ResponseObject> reslist = new ArrayList<ResponseObject>();
		
		List<byte[]> list = unzip(sazfile);
		for(byte[] raw : list){
			try{
				RequestObject reqobj = getRequestObject(raw, encoding);
				byte[] data = new byte[0];
				if(!StringUtility.isNullOrEmpty(reqobj.body)){
					data = reqobj.body.getBytes("UTF-8");
				}
				ResponseObject responseObj = new ResponseObject();
				System.out.println("request " + reqobj.url);
				
				if(reqobj.isGet){
					if(data.length == 0){
						responseObj.data = HttpClientUtility.getBytes(reqobj.url, reqobj.head, data, responseObj.head);
					}else{
						responseObj.data = HttpClientUtility.httpPostToBytes(reqobj.url, data, reqobj.head, responseObj.head);
					}
				}else{
					responseObj.data = HttpClientUtility.httpPostToBytes(reqobj.url, data, reqobj.head, responseObj.head);
				}
				
				reslist.add(responseObj);
			}catch(Exception e){
				e.printStackTrace();
			}
		}

		return reslist;
	}
	
	public static List<ResponseObject> postRequest(String sazfile){
		return postRequest(sazfile, "UTF-8");
	}
	
	
	public static void main(String[] args){
		String file = "/file/saz/2001.saz";
		unzip(file);
	}
}
