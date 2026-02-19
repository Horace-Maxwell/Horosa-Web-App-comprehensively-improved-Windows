package spacex.astrostudy.controller;


import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.astrostudy.model.AstroUser;
import spacex.astrostudy.service.UserService;

@Controller
@RequestMapping("/user")
public class UserChartsController {

	@Autowired
	private UserService service;
	

	@RequestMapping("/charts")
	@ResponseBody
	public void charts(){
		IUser user = TransData.getCurrentUser();
		String tag = TransData.getValueAsString("tag");
		List<Map<String, Object>> list = service.getUserCharts(user, tag);
		if(TransData.hasPagination()) {
			int total = list.size();
			list = TransData.getParties(list);
			TransData.set("List", list);
			TransData.set("Total", total);
		}else {
			TransData.set(list);			
		}
	}
	
	@RequestMapping("/charts/update")
	@ResponseBody
	public void updateChart() {
		if(!TransData.containsParam("cid")) {
			throw new ErrorCodeException(123001, "need.chartid");
		}
		if(!TransData.containsParam("creator")) {
			throw new ErrorCodeException(123002, "need.creator");
		}
		String creator = TransData.getValueAsString("creator");
		
		Map<String, Object> params = getParams();
		params.put("cid", TransData.get("cid"));
		params.put("creator", creator);
		
		AstroCacheHelper.saveChart(params);
	}
	
	@RequestMapping("/charts/delete")
	@ResponseBody
	public void deleteChart() {
		if(!TransData.containsParam("cid")) {
			throw new ErrorCodeException(124001, "need.chartid");
		}
		String cid = TransData.getValueAsString("cid");
		IUser user = TransData.getCurrentUser();
		AstroCacheHelper.removeChart(cid, user.getLoginId());
	}

	@RequestMapping("/charts/add")
	@ResponseBody
	public void addChart() {
		IUser user = TransData.getCurrentUser();
		Map<String, Object> params = getParams();
		if(TransData.containsParam("ad")) {
			int ad = TransData.getValueAsInt("ad", 1);
			params.put("ad", ad);
			if(ad != 1) {
				String dt = TransData.getValueAsString("date");
				if(dt.indexOf('-') != 0) {
					params.put("date", "-" + dt);
				}
			}			
		}else {
			String dt = TransData.getValueAsString("date");
			if(dt.indexOf('-') == 0) {
				params.put("ad", -1);
			}
		}
		params.put("cid", StringUtility.getUUID());
		params.put("creator", user.getLoginId());
		
		AstroCacheHelper.saveChart(params);
	}
	
	@RequestMapping("/charts/memo")
	@ResponseBody
	public void saveMemo() {
		if(!TransData.containsParam("cid")) {
			throw new ErrorCodeException(124001, "need.chartid");
		}
		if(!TransData.containsParam("type")) {
			throw new ErrorCodeException(124002, "need.memotype");
		}
		if(!TransData.containsParam("memo")) {
			throw new ErrorCodeException(124003, "need.memo");
		}
		String cid = TransData.getValueAsString("cid");
		int type = TransData.getValueAsInt("type");
		String memo = TransData.getValueAsString("memo");
		
		IUser user = TransData.getCurrentUser();
		String uid = user.getLoginId();
		AstroCacheHelper.saveMemo(cid, type, memo, uid);
	}
	
	private Map<String, Object> getParams() {
		Map<String, Object> params = new HashMap<String, Object>();
		if(TransData.containsParam("lon")) {
			params.put("lon", TransData.get("lon"));
		}
		if(TransData.containsParam("lat")) {
			params.put("lat", TransData.get("lat"));
		}
		if(TransData.containsParam("gpsLon")) {
			params.put("gpsLon", TransData.get("gpsLon"));
		}
		if(TransData.containsParam("gpsLat")) {
			params.put("gpsLat", TransData.get("gpsLat"));
		}
		if(TransData.containsParam("birth")) {
			params.put("birth", TransData.get("birth"));
		}
		if(TransData.containsParam("zone")) {
			params.put("zone", TransData.get("zone"));
		}
		if(TransData.containsParam("name")) {
			params.put("name", TransData.get("name"));
		}
		if(TransData.containsParam("pos")) {
			params.put("pos", TransData.get("pos"));
		}
		if(TransData.containsParam("gender")) {
			params.put("gender", TransData.get("gender"));
		}
		if(TransData.containsParam("isPub")) {
			params.put("isPub", TransData.get("isPub"));
		}
		if(TransData.containsParam("ad")) {
			int ad = TransData.getValueAsInt("ad", 1);
			params.put("ad", ad);
			if(ad != 1) {
				String dt = TransData.getValueAsString("date");
				if(dt.indexOf('-') != 0) {
					params.put("date", "-" + dt);
				}
			}			
		}else {
			String dt = TransData.getValueAsString("date");
			if(dt.indexOf('-') == 0) {
				params.put("ad", -1);
			}
		}
		if(TransData.containsParam("group")) {
			params.put("group", TransData.get("group"));
			Object grp = TransData.get("group");
			AstroUser user = (AstroUser)TransData.getCurrentUser();
			if(grp instanceof String) {
				if(!StringUtility.isNullOrEmpty(grp)) {
					List<String> list = JsonUtility.decodeList((String)grp, String.class);
					String tags = StringUtility.joinWithSeperator(",", list);
					params.put("tags", tags);
					user.addGroup(list);					
				}
			}if(grp instanceof Collection) {
				Collection coll = (Collection) grp;
				String tags = StringUtility.joinWithSeperator(",", coll);
				params.put("tags", tags);
				user.addGroup(coll);
			}
			service.saveUser(user);
		}
		params.put("updateTime", System.currentTimeMillis());
		
		return params;
	}
	
}
