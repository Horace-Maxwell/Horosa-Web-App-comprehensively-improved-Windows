package spacex.astrostudy.controller;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.helper.ClientAppHelper;

@Controller
@RequestMapping("/clientapp")
public class ThirdAppClientController {

	@RequestMapping("/list")
	@ResponseBody
	public void list() {
		List<Map<String, Object>> list = ClientAppHelper.getClientApps(null);
		for(Map<String, Object> map : list) {
			map.remove("privexp");
		}
		TransData.set("List", list);
	}

	@RequestMapping("/add")
	@ResponseBody
	public void add() {
		String app = (String) TransData.get("App");
		if(StringUtility.isNullOrEmpty(app)) {
			throw new ErrorCodeException(7000002, "miss.app.id");
		}
		
		Map<String, Object> map = ClientAppHelper.genClientApp(app);
		ClientAppHelper.updateClientApp(app, map);
		
		map.remove("privexp");
		TransData.set(map);
	}

	@RequestMapping("/update")
	@ResponseBody
	public void update() {
		String app = (String) TransData.get("App");
		if(StringUtility.isNullOrEmpty(app)) {
			throw new ErrorCodeException(7000003, "miss.app.id");
		}
		
		Map<String, Object> map = ClientAppHelper.getApp(app);
		if(TransData.containsParam("ReqEncrypt")) {
			map.put("reqencrypt", ConvertUtility.getValueAsBool(TransData.get("ReqEncrypt"), true));
		}
		if(TransData.containsParam("RspEncrypt")) {
			map.put("rspencrypt", ConvertUtility.getValueAsBool(TransData.get("RspEncrypt"), true));
		}
		if(TransData.containsParam("App")) {
			map.put("app", TransData.get("App"));
		}
		ClientAppHelper.updateClientApp(app, map);
		
		map.remove("privexp");
		TransData.set(map);
	}

	@RequestMapping("/delete")
	@ResponseBody
	public void delete() {
		String app = (String) TransData.get("App");
		if(StringUtility.isNullOrEmpty(app)) {
			throw new ErrorCodeException(7000004, "miss.app.id");
		}
		ClientAppHelper.delete(app);
	}

	@RequestMapping("/genrsa")
	@ResponseBody
	public void genrsa() {
		String app = (String) TransData.get("App");
		if(StringUtility.isNullOrEmpty(app)) {
			throw new ErrorCodeException(7000005, "miss.app.id");
		}
		Map<String, Object> map = ClientAppHelper.genRsaParam(app);
		TransData.set(map);
	}

	@RequestMapping("/gensigkey")
	@ResponseBody
	public void gensigkey() {
		String app = (String) TransData.get("App");
		if(StringUtility.isNullOrEmpty(app)) {
			throw new ErrorCodeException(7000005, "miss.app.id");
		}
		Map<String, Object> map = ClientAppHelper.genSigKey(app);
		TransData.set(map);
	}

	@RequestMapping("/setencrypt")
	@ResponseBody
	public void setencrypt() {
		String app = (String) TransData.get("App");
		if(StringUtility.isNullOrEmpty(app)) {
			throw new ErrorCodeException(7000006, "miss.app.id");
		}
		Map<String, Object> map = ClientAppHelper.getApp(app);
		if(map == null) {
			return;
		}
		
		boolean haschange = false;
		if(TransData.containsParam("ReqEncrypt")) {
			boolean enc = TransData.getValueAsBool("ReqEncrypt", false);
			haschange = true;
			map.put("reqencrypt", enc);
		}
		if(TransData.containsParam("RspEncrypt")) {
			boolean enc = TransData.getValueAsBool("RspEncrypt", false);
			haschange = true;
			map.put("rspencrypt", enc);
		}
		if(haschange) {
			ClientAppHelper.updateClientApp(app, map);			
		}
	}

}
