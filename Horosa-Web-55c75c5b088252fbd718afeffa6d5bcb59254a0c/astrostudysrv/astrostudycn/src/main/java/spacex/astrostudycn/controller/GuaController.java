package spacex.astrostudycn.controller;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.StringUtility;
import spacex.astrostudycn.helper.GuaHelper;

@Controller
@RequestMapping("/gua")
public class GuaController {

	@ResponseBody
	@RequestMapping("/desc")
	public void execute() {
		List<String> names = (List<String>) TransData.get("name");
		if(names == null) {
			throw new ErrorCodeException(810001, "miss.guanames");
		}
		
		for(String name : names) {
			if(StringUtility.isNullOrEmpty(name)) {
				continue;
			}
			Map<String, Object> map = GuaHelper.getGua(name);
			TransData.set(name, map);			
		}
	}
	
	@ResponseBody
	@RequestMapping("/meiyi")
	public void meiyi() {
		List<String> names = (List<String>) TransData.get("name");
		if(names == null) {
			throw new ErrorCodeException(810001, "miss.guanames");
		}
		
		for(String name : names) {
			if(StringUtility.isNullOrEmpty(name)) {
				continue;
			}
			Map<String, Object> map = GuaHelper.getMeiyiGua(name);
			TransData.set(name, map);			
		}
	}
	
}
