package boundless.spring.help.mv;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

import org.springframework.web.servlet.ModelAndView;

import boundless.model.StateResult;
import boundless.spring.help.PropertyPlaceholder;
import boundless.types.KeyValuePair;
import boundless.utility.FormatUtility;


public class ErrorModelAndView {

	public static ModelAndView getDefaultJsonError(String msg, Map<String, String> data){
		ModelAndView mv = new ModelAndView("/views/Json");
		
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("msg", msg);
		map.put("date", FormatUtility.formatDateTime(new Date(), "yyyy-MM-dd HH:mm:ss.SSS"));
		
		List<KeyValuePair<String, String>> list = new ArrayList<KeyValuePair<String, String>>();
		if(data != null){
			for(Entry<String, String> entry : data.entrySet()){
				KeyValuePair<String, String> pair = new KeyValuePair<String, String>(entry.getKey(), entry.getValue());
				list.add(pair);
			}
		}
		
		map.put("addition", list);
		
		mv.addObject("data", map);

		return mv;
	}
	
	public static ModelAndView getDefaultJsonError(Map<String, Object> data){
		ModelAndView mv = new ModelAndView("/views/Json");
		mv.addObject("data", data);
		return mv;
	}
	
	public static ModelAndView getDefaultEmptyError(){
		ModelAndView mv = new ModelAndView("/views/String");
		return mv;
	}
	
	public static ModelAndView getDefaultStringError(String msg){
		ModelAndView mv = new ModelAndView("/views/String");

		String errmsg = PropertyPlaceholder.getProperty(msg);
		mv.addObject("data", errmsg);
		return mv;
	}

	public static ModelAndView getDefaultBytesError(byte[] raw){
		ModelAndView mv = new ModelAndView("/views/Bytes");
		mv.addObject("data", raw);
		return mv;
	}

	public static ModelAndView getDefaultStateResultError(String msg){
		ModelAndView mv = new ModelAndView("/views/StatePage");
		String errmsg = PropertyPlaceholder.getProperty(msg);
		StateResult res = StateResult.fail(errmsg);
		mv.addObject("data", res);
		
		return mv;
	}
	
}
