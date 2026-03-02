package spacex.astrostudy.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.types.ICache;
import boundless.utility.ConvertUtility;
import boundless.utility.PositionUtility;
import boundless.utility.PositionUtility.Gps;
import boundless.web.common.IUser;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.astrostudy.helper.StatisticHelper;

@Controller
@RequestMapping("/statis")
public class StatisticController {

	@RequestMapping("/count")
	@ResponseBody
	public void count() {
		IUser user = TransData.getCurrentUser();
		boolean admin = user.isAdmin();
		if(!admin) {
			throw new ErrorCodeException(1000001, "need.admin");
		}
		
		long onlineusers = StatisticHelper.getOnlineUserCount();
		long clients = StatisticHelper.getOnlineClientCount();
		long users = StatisticHelper.getUserCount();
		long charts = StatisticHelper.getChartsCount();
		
		TransData.set("OnlineUsers", onlineusers);
		TransData.set("OnlineClients", clients);
		TransData.set("Users", users);
		TransData.set("Charts", charts);
	}
	
	@RequestMapping("/chartsgps")
	@ResponseBody
	public void getChartsGps() {
		String cid = TransData.getValueAsString("cid");
		int days = TransData.getValueAsInt("limit", 1000);
				
		List<Map<String, Object>> list = AstroCacheHelper.getChartsGps(cid, days);
		List<Map<String, Object>> res = new ArrayList<Map<String, Object>>(list.size());
		for(Map<String, Object> map : list) {
			Map<String, Object> chart = new HashMap<String, Object>();
			double gpsLon = ConvertUtility.getValueAsDouble(map.get("gpsLon"));
			double gpsLat = ConvertUtility.getValueAsDouble(map.get("gpsLat"));
			chart.put("cid", map.get("cid"));
			chart.put("gpsLon", gpsLon);
			chart.put("gpsLat", gpsLat);
			chart.put("lon", map.get("lon"));
			chart.put("lat", map.get("lat"));
			chart.put("birth", map.get("birth"));
			chart.put("name", map.get("name"));
			chart.put("gender", map.get("gender"));
			res.add(chart);
		}
		
		TransData.set(res);
	}
	
}
