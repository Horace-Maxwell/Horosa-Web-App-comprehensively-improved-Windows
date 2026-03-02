package spacex.astrostudy.model;

import java.util.HashMap;
import java.util.Map;

import boundless.utility.ConvertUtility;

public class AstroChart {
	
	public static AstroChart fromMap(Map<String, Object> map) {
		AstroChart chart = new AstroChart();
		chart.cid = (String) map.get("cid");
		chart.lon = (String) map.get("lon");
		chart.lat = (String) map.get("lat");
		chart.gpsLat = (double) map.get("gpsLat");
		chart.gpsLon = (double) map.get("gpsLlon");
		chart.birth = (String) map.get("birth");
		chart.zone = (String) map.get("zone");
		chart.name = (String) map.get("name");
		chart.pos = (String) map.get("pos");
		chart.gender = (int) map.get("gender");
		chart.isPub = ConvertUtility.getValueAsByte(map.get("isPub"));
		chart.creator = (String) map.get("creator");
		chart.updateTime = (long) map.get("updateTime");
		
		return chart;
	}
	
	public String cid;
	public String lon;
	public String lat;
	public double gpsLon;
	public double gpsLat;
	public String birth;
	public String zone;
	public String name;
	public String pos;
	public int gender = -1;		// 0--女性；1--男性; -1--未知
	public byte isPub = 0;
	public String creator;
	public long updateTime;
	
	public Map<String, Object> toMap(){
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("cid", cid);
		map.put("lon", lon);
		map.put("lat", lat);
		map.put("gpsLon", gpsLon);
		map.put("gpsLat", gpsLat);
		map.put("birth", birth);
		map.put("zone", zone);
		map.put("name", name);
		map.put("gender", gender);
		map.put("pos", pos);
		map.put("isPub", isPub);
		map.put("creator", creator);
		map.put("updateTime", updateTime);
		
		return map;
	}
}
