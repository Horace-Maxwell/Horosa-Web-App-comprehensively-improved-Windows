package spacex.astrodeeplearn.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.spring.help.interceptor.TransData;
import spacex.astrodeeplearn.helper.DeepLearnHelper;

@Controller
@RequestMapping("/deeplearn")
public class StatisDeepLearnController {

	@ResponseBody
	@RequestMapping("/count")
	public void count() {
		TransData.set("CountSample10000", DeepLearnHelper.countSample10000());
		TransData.set("CountSample20000", DeepLearnHelper.countSample20000());
		TransData.set("CountSample30000", DeepLearnHelper.countSample30000());
		TransData.set("CountSample40000", DeepLearnHelper.countSample40000());
	}
	
}
