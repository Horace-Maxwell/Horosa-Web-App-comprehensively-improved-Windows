package spacex.astrodeeplearn.controller;

import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.StringUtility;
import spacex.astrodeeplearn.helper.DeepLearnHelper;

@Controller
@RequestMapping("/deeplearn")
public class DeepLearnController {

	@ResponseBody
	@RequestMapping("/fateevents")
	public void fateevents(){
		String cid = TransData.getValueAsString("Cid");
		if(StringUtility.isNullOrEmpty(cid)) {
			throw new ErrorCodeException(600001, "miss.cid");
		}
		
		TransData.set("Cid", cid);
		
		Map<String, Object> fateevents = DeepLearnHelper.getDefFateEvents();
		TransData.setAll(fateevents);
		
		Map<String, Object> val10000 = DeepLearnHelper.getSample10000(cid);
		Map<String, Object> val20000 = DeepLearnHelper.getSample20000(cid);
		Map<String, Object> val30000 = DeepLearnHelper.getSample30000(cid);
		Map<String, Object> val40000 = DeepLearnHelper.getSample40000(cid);
		
		TransData.set("Val10000", val10000);
		TransData.set("Val20000", val20000);
		TransData.set("Val30000", val30000);
		TransData.set("Val40000", val40000);
		
	}
	
	@ResponseBody
	@RequestMapping("/train")
	public void train(){
		String cid = TransData.getValueAsString("Cid");
		if(StringUtility.isNullOrEmpty(cid)) {
			throw new ErrorCodeException(600002, "miss.cid");
		}
		
		Map<String, Object> val10000 = (Map<String, Object>) TransData.get("Val10000");
		Map<String, Object> val20000 = (Map<String, Object>) TransData.get("Val20000");
		Map<String, Object> val30000 = (Map<String, Object>) TransData.get("Val30000");
		Map<String, Object> val40000 = (Map<String, Object>) TransData.get("Val40000");
		DeepLearnHelper.setSample10000(cid, val10000);
		DeepLearnHelper.setSample20000(cid, val20000);
		DeepLearnHelper.setSample30000(cid, val30000);
		DeepLearnHelper.setSample40000(cid, val40000);
	}
	
	
}
