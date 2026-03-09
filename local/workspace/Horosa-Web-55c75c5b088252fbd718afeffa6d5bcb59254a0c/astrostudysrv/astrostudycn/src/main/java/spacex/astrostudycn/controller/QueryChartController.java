package spacex.astrostudycn.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.astrostudy.helper.AstroHelper;
import spacex.astrostudycn.model.OnlyFourColumns;

@Controller
@RequestMapping("/qry")
public class QueryChartController {

	@ResponseBody
	@RequestMapping("/chart")
	public void chart(){
		Map<String, Object> params = getParams();
		int ad = ConvertUtility.getValueAsInt(params.get("ad"), 1);
		
		Map<String, Object> res = AstroHelper.getChart(params);
		syncPredictiveMetaAndRows(res, params);
		Map<String, Object> reqparams = (Map<String, Object>) res.get("params");
		if(reqparams != null) {
			reqparams.put("gpsLat", TransData.get("gpsLat"));
			reqparams.put("gpsLon", TransData.get("gpsLon"));	
		}
		
		String zone = (String)params.get("zone");
		String lon = (String)params.get("lon");
		String lat = (String)params.get("lat");
		String dtstr = (String) params.get("birth");
		boolean after23NewDay = false;
		OnlyFourColumns bz = new OnlyFourColumns(ad, dtstr, zone, lon, lat, after23NewDay);
		Map<String, Object> map = bz.getNongli();
		if(res.containsKey("chart")) {
			Map<String, Object> chart = (Map<String, Object>) res.get("chart");
			chart.put("nongli", map);
		}else {
			res.put("nongli", map);					
		}
		
		TransData.set(res);
	}

	private void syncPredictiveMetaAndRows(Map<String, Object> res, Map<String, Object> args) {
		if(res == null || args == null) {
			return;
		}
		Map<String, Object> reqparams = (Map<String, Object>) res.get("params");
		if(reqparams != null) {
			reqparams.put("pdSyncRev", "pd_method_sync_v6");
			if(args.containsKey("pdtype")) {
				reqparams.put("pdtype", args.get("pdtype"));
			}
			if(args.containsKey("pdMethod")) {
				reqparams.put("pdMethod", args.get("pdMethod"));
			}
			if(args.containsKey("pdTimeKey")) {
				reqparams.put("pdTimeKey", args.get("pdTimeKey"));
			}
		}
		if(!ConvertUtility.getValueAsBool(args.get("predictive"), false)) {
			return;
		}
		if(!ConvertUtility.getValueAsBool(args.get("includePrimaryDirection"), false)) {
			return;
		}
		Map<String, Object> pdres = AstroHelper.getPrimaryDirection(args);
		if(pdres == null || !pdres.containsKey("pd")) {
			return;
		}
		Map<String, Object> predictives = (Map<String, Object>) res.get("predictives");
		if(predictives == null) {
			predictives = new HashMap<String, Object>();
			res.put("predictives", predictives);
		}
		predictives.put("primaryDirection", pdres.get("pd"));
	}
	
	private Map<String, Object> getParams(){
		if(!TransData.containsParam("cid")) {
			throw new ErrorCodeException(300001, "miss.chart.id");
		}
		String id = TransData.getValueAsString("cid");
		Map<String, Object> chart = AstroCacheHelper.getChart(id);
		if(chart == null) {
			throw new ErrorCodeException(300002, "no.found.chart");
		}
		String birth = (String) chart.get("birth");
		String[] parts = StringUtility.splitString(birth, ' ');
		chart.put("date", parts[0]);
		chart.put("time", parts[1]);
		chart.put("_wireRev", "pd_method_sync_v6");
		chart.put("hsys", TransData.getValueAsInt("hsys", 0));
		chart.put("zodiacal", TransData.getValueAsInt("zodiacal", 0));
		chart.put("predictive", TransData.getValueAsBool("predictive", false));
		chart.put("includePrimaryDirection", TransData.getValueAsBool("includePrimaryDirection", false));
		if(TransData.containsParam("pdtype")) {
			chart.put("pdtype", TransData.get("pdtype"));
		}
		if(TransData.containsParam("pdMethod")) {
			chart.put("pdMethod", TransData.get("pdMethod"));
		}
		if(TransData.containsParam("pdTimeKey")) {
			chart.put("pdTimeKey", TransData.get("pdTimeKey"));
		}
		return chart;
	}
	
}
