package spacex.astrostudy.controller;

import java.util.LinkedList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.spring.help.interceptor.TransData;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.astrostudy.helper.PrivilegeHelper;

@Controller
public class AllowedChartController {

	@ResponseBody
	@RequestMapping("/allowedcharts")
	public void execute(){
		String creator = null;
		String token = TransData.getToken();
		if(token != null && !token.equalsIgnoreCase("null")) {
			IUser user = PrivilegeHelper.getUser(token);
			if(user != null) {
				creator = user.getLoginId();
			}
		}
		String tag = TransData.getValueAsString("tag");
		String name = TransData.getValueAsString("name");
		List<Map<String, Object>> list = new LinkedList<Map<String, Object>>();
		if(StringUtility.isNullOrEmpty(name) || name.equalsIgnoreCase("null")) {
			if(!StringUtility.isNullOrEmpty(creator)) {
				list = AstroCacheHelper.getChartsByCreator(tag, creator);
			}
		}else {
			list = AstroCacheHelper.getCharts(tag, name, creator);			
		}
		
		if(TransData.hasPagination()) {
			int total = list.size();
			list = TransData.getParties(list);
			TransData.set("List", list);
			TransData.set("Total", total);
		}else {
			TransData.set(list);			
		}
		
	}
	
}
