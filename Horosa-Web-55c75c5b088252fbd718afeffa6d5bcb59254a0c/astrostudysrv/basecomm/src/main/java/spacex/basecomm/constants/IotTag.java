package spacex.basecomm.constants;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.utility.ConvertUtility;
import boundless.utility.FormatUtility;

public enum IotTag {
	provinceCode,
	cityCode,
	districtCode,
	
	customer,
	building,
	floor,
	zone,
	subsys,
	subsysSeq,
	device,
	model,
	metricDesc,
	mainType,
	spacePos,
	devName,
	
	customerSeq,
	buildingSeq,
	deviceSeq,
	
	lat,
	lng,
	
	level,
	levelName,
	levelType,
	levelRing,
	levelSmsTemplateSeq,

	alert,
	msg,
	alertid,
	isAlert,
	alertType,
	
	orgmetric,
	orgvalue,
	gateway,
	gatewaySeq,
	gatewayCustomer,
	smartdev,
	pointDesc,
	metric,
	value,
	protocol,
	time,
	timeStr,
	startAddr,
	orgid,
	boxdev,
	boxdevSeq,
	seq,
	alertDuration,
	reporterName,
	reporterTel,
	uniqueId,
	itemId,
	formula,
	formulaUpload,
	formulaAlert,
	images;
	
	
	public static Map<String, Object> toTagMap(Map<String, Object> param){
		Map<String, Object> map = new HashMap<String, Object>();
		for(Map.Entry<String, Object> entry: param.entrySet()){
			String key = entry.getKey();
			try{
				IotTag tag = IotTag.valueOf(key);
				if(tag != null){
					map.put(key, entry.getValue());
					if(key.equals(IotTag.time.toString())){
						long tm = ConvertUtility.getValueAsLong(entry.getValue());
						Date dt = new Date();
						dt.setTime(tm);
						String tmstr = FormatUtility.formatDateTime(dt, "yyyy-MM-dd HH:mm:ss");
						map.put(IotTag.timeStr.toString(), tmstr);
					}
				}				
			}catch(Exception e){
			}
		}
		
		return map;
	}
	
	public static List<String> getAllTags(){
		List<String> list = new ArrayList<String>(40);
		for(IotTag tag : IotTag.values()){
			if(tag != metric && tag != value && tag != time){
				list.add(tag.toString());
			}
		}
		return list;
	}
	
}
