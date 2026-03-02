package spacex.basecomm.helper;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.PropertyPlaceholder;
import boundless.types.OutParameter;
import boundless.types.Tuple3;
import boundless.utility.ConvertUtility;
import boundless.utility.FormulaUtility;
import boundless.utility.StringUtility;
import spacex.basecomm.constants.AlertType;
import spacex.basecomm.constants.ErrorMetrics;
import spacex.basecomm.constants.IotTag;

public class IotDataTreatHelper {
	private static Logger log = AppLoggers.getLog("collector", "unupload");
	private static Map<String, Tuple3<Object, Long, Long>> durationMap = new HashMap<String, Tuple3<Object, Long, Long>>();
	

	public static Object treatItemValue(Object value, String formula){
		if(StringUtility.isNullOrEmpty(formula)){
			return value;
		}
		double val = 0;
		if(value instanceof Integer || value instanceof Long || value instanceof Byte || value instanceof Short || value instanceof Double 
				|| value instanceof BigInteger) {
			val = ConvertUtility.getValueAsDouble(value);
		}else if(value instanceof BigDecimal) {
			BigDecimal n = (BigDecimal)value; 
			val = n.doubleValue();
		}else if(value instanceof Boolean) {
			boolean bv = (boolean) value;
			val = bv ? 1 : 0;
		}else {
			return value;
		}
		OutParameter<Boolean> outValue = new OutParameter<Boolean>();
		Boolean isbool = ConvertUtility.isBool(value, outValue);
		if(isbool) {
			if(outValue.value) {
				val = 1;
			}else {
				val = 0;
			}
		}
		return FormulaUtility.calculateByX(formula, val);
	}

	public static boolean canUploadData(Map<String, Object> data) {
		fillDuration(data);
		
		String formula = (String) data.get("formulaUpload");
		if(StringUtility.isNullOrEmpty(formula)) {
			return true;
		}
		
		double v = 0;
		Object obj = data.get(IotTag.value.toString());
		boolean isString = false;
		if(obj instanceof Boolean){
			boolean b = (boolean) obj;
			v = b ? 1 : 0;
		}else if(obj instanceof String){
			String s = (String) obj;
			if(s.equalsIgnoreCase("true") || s.equalsIgnoreCase("false") || s.equalsIgnoreCase("on") || s.equalsIgnoreCase("off") ||
					s.equalsIgnoreCase("ENABLE") || s.equalsIgnoreCase("DISABLE") || s.equalsIgnoreCase("INACTIVE") || s.equalsIgnoreCase("ACTIVE")){
				boolean b = ConvertUtility.getValueAsBool(s);
				v = b ? 1 : 0;
			}else {
				isString = true;
			}
		}else{
			v = ConvertUtility.getValueAsDouble(data.get(obj));
		}
		
		if(isString) {
			String parts[] = StringUtility.splitString(formula, '=');
			String chkval = parts.length == 1 ? parts[0] : parts[1];
			String s = (String) obj;
			if(!s.contains(chkval)) {
				QueueLog.info(log, "disallow upload by formulaUpload: {}, value:{}, for data: {}", formula, obj, data);
				return false;						
			}
		}else {
			double flag = FormulaUtility.calculateByX(formula, v);
			if(flag < 1) {
				QueueLog.info(log, "disallow upload by formulaUpload: {}, value:{}, for data: {}", formula, obj, data);
				return false;
			}						
		}
		return true;
	}

	public static boolean canUploadAlert(Map<String, Object> data) {
		Object vobj = data.get(IotTag.value.toString());
		data.put(IotTag.orgvalue.toString(), vobj);
		
		if(!overAlertDuration(data)) {
			QueueLog.info(log, "disallow upload by no overAlertDuration, value:{}, for data: {}", vobj, data);
			return false;
		}
		
		String formula = (String) data.get("formulaAlert");
		double v = 0;
		boolean isString = false;
		if(vobj instanceof Boolean){
			boolean b = (boolean) vobj;
			v = b ? 1 : 0;
		}else if(vobj instanceof String){
			String s = (String) vobj;
			if(s.equalsIgnoreCase("true") || s.equalsIgnoreCase("false") || s.equalsIgnoreCase("on") || s.equalsIgnoreCase("off") ||
					s.equalsIgnoreCase("ENABLE") || s.equalsIgnoreCase("DISABLE") || s.equalsIgnoreCase("INACTIVE") || s.equalsIgnoreCase("ACTIVE")){
				boolean b = ConvertUtility.getValueAsBool(s);
				v = b ? 1 : 0;
			}else {
				isString = true;
			}
		}else{
			v = ConvertUtility.getValueAsDouble(vobj, 0);
		}
		
		boolean isalertpnt = ConvertUtility.getValueAsBool(data.get(IotTag.isAlert.toString()), false);
		if(isalertpnt){
			if(StringUtility.isNullOrEmpty(formula)){
				boolean alert = ConvertUtility.getValueAsBool(vobj, false);
				if(alert){
					data.put(IotTag.alertType.toString(), AlertType.DataAlert.getCode());
					data.put(IotTag.alertid.toString(), ErrorMetrics.data_alert.toString());
					
					String str = PropertyPlaceholder.getProperty("data_alert");
					String msg = String.format("%s=%s，%s", data.get(IotTag.metric.toString()).toString(), vobj.toString(), str);
					data.put(IotTag.msg.toString(), msg);
					
					return true;
				}
			}else{
				if(isString) {
					String parts[] = StringUtility.splitString(formula, '=');
					String chkval = parts.length == 1 ? parts[0] : parts[1];
					String s = (String) vobj;
					if(!s.contains(chkval)) {
						data.put(IotTag.alertType.toString(), AlertType.NoAlert.getCode());
						QueueLog.info(log, "disallow upload by formulaAlert: {}, value:{}, for data: {}", formula, vobj, data);
						return false;						
					}
				}else {
					double flag = FormulaUtility.calculateByX(formula, v);
					if(flag < 1) {
						data.put(IotTag.alertType.toString(), AlertType.NoAlert.getCode());
						QueueLog.info(log, "disallow upload by formulaAlert: {}, value:{}, for data: {}", formula, vobj, data);
						return false;
					}											
				}
				data.put(IotTag.alertType.toString(), AlertType.DataAlert.getCode());
				data.put(IotTag.alertid.toString(), ErrorMetrics.data_alert.toString());
				
				String str = PropertyPlaceholder.getProperty("data_alert");
				String msg = String.format("%s=%s，%s", data.get(IotTag.metric.toString()).toString(), vobj.toString(), str);
				data.put(IotTag.msg.toString(), msg);
				
				return true;				
			}
			
		}
		
		if(StringUtility.isNullOrEmpty(formula)) {
			data.put(IotTag.alertType.toString(), AlertType.NoAlert.getCode());
			return false;
		}
		
		if(isString) {
			String parts[] = StringUtility.splitString(formula, '=');
			String chkval = parts.length == 1 ? parts[0] : parts[1];
			String s = (String) vobj;
			if(!s.contains(chkval)) {
				data.put(IotTag.alertType.toString(), AlertType.NoAlert.getCode());
				return false;						
			}
		}else {
			double flag = FormulaUtility.calculateByX(formula, v);
			if(flag < 1) {
				data.put(IotTag.alertType.toString(), AlertType.NoAlert.getCode());
				return false;
			}											
		}
				
		data.put(IotTag.alertType.toString(), AlertType.AssistAlert.getCode());
		data.put(IotTag.alertid.toString(), ErrorMetrics.over_threshold.toString());
		
		String overthresholdmsg = PropertyPlaceholder.getProperty("over_threshold");
		String thresholdformula = String.format("%s：%s", PropertyPlaceholder.getProperty("threshold_formula"), formula);
		String msg = String.format("%s=%s，%s， %s", 
				data.get(IotTag.metric.toString()).toString(), vobj.toString(), overthresholdmsg, thresholdformula);
		data.put(IotTag.msg.toString(), msg);
		
		return true;
	}
	
	private static void fillDuration(Map<String, Object> data) {
		if(!data.containsKey(IotTag.uniqueId.toString()) || !data.containsKey(IotTag.alertDuration.toString())) {
			return;
		}
		String id = (String) data.get(IotTag.uniqueId.toString());
		Tuple3<Object, Long, Long> tuple = durationMap.get(id);
		Object val = data.get(IotTag.value.toString());
		if(tuple == null) {
			tuple = new Tuple3<Object, Long, Long>(val, System.currentTimeMillis(), 0l);
			durationMap.put(id, tuple);
			return;
		}
		
		Object oldval = tuple.item1();
		long tm = System.currentTimeMillis();
		if((val == null && oldval == null) || (val != null && oldval != null && val.equals(oldval))) {
			long dur = tm - tuple.item2();
			tuple.item1(tm);
			tuple.item3(dur);
			return;
		}
		
		tuple.item1(val);
		tuple.item2(tm);
		tuple.item3(0l);
	}
	
	private static boolean overAlertDuration(Map<String, Object> data) {
		if(!data.containsKey(IotTag.uniqueId.toString()) || !data.containsKey(IotTag.alertDuration.toString())) {
			return true;
		}
		
		String id = (String) data.get(IotTag.uniqueId.toString());
		long duration = ConvertUtility.getValueAsLong(data.get(IotTag.alertDuration.toString())) * 3600000;
		Tuple3<Object, Long, Long> tuple = durationMap.get(id);
		if(tuple == null) {
			return true;
		}
		
		long dur = tuple.item3();
		if(dur >= duration) {
			return true;
		}
		return false;
	}
	
}
