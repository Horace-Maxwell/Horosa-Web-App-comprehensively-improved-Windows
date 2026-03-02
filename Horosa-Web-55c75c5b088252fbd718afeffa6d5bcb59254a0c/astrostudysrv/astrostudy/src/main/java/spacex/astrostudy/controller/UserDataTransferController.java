package spacex.astrostudy.controller;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.office.OfficeUtility;
import boundless.spring.help.interceptor.TransData;
import boundless.spring.help.interceptor.TransData.MultipartObject;
import boundless.types.FileType;
import boundless.utility.FormatUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.astrostudy.model.AstroUser;
import spacex.astrostudy.service.UserService;

@Controller
@RequestMapping("/user")
public class UserDataTransferController {

	@Autowired
	private UserService service;
	
	
	private String[] keys = new String[] {
			"name", "birth", "zone", "lon", "lat", "gpsLon", "gpsLat", "pos", "gender", "isPub", "group", "cid", 
			"memoAstro", "memoBaZi", "memoZiWei", "memo74", "memoGua", "memoLiuReng", "memoQiMeng", "memoSuZhan"
	};
	
	@RequestMapping("/charts/export")
	@ResponseBody
	public void exportData() {
		IUser user = TransData.getCurrentUser();
		List<Map<String, Object>> list = service.getUserCharts(user);
		List<Map<String, Object>> data = new ArrayList<Map<String, Object>>(list.size() + 1);
		Map<String, Object> title = new HashMap<String, Object>();
		for(String key : keys) {
			title.put(key, key);
		}
		data.add(title);
		data.addAll(list);
		byte[] res = OfficeUtility.writeXlsx(data, keys);
		String filename = String.format("%s", FormatUtility.formatDateTime(new Date(), "yyyyMMddHHmmss"));
		TransData.setRawData(res, FileType.XLSX, filename);
	}
	
	@RequestMapping("/charts/import")
	@ResponseBody
	public void importData() {
		MultipartObject[] multiobj = TransData.getMultiparts();
		if(multiobj == null || multiobj.length == 0){
			throw new ErrorCodeException(90001001, "no.found.file");
		}
				
		Map<String, Object> res = new HashMap<String, Object>();
		res.put("FailCount", 0);
		res.put("Total", 0);
		res.put("FailList", new LinkedList<Map<String, Object>>());

		int type = TransData.getValueAsInt("type", 0);
		List<Map<String, Object>> errlist = new LinkedList<Map<String, Object>>();
		for(MultipartObject obj : multiobj){
			byte[] raw = obj.getBytes();
			if(!OfficeUtility.isXlsx(raw)){
				throw new ErrorCodeException(90001002, "no.xlsx.file");
			}
			
			ByteArrayInputStream bis = new ByteArrayInputStream(raw);
			if(type == 0) {
				res = addHorosaData(bis);
			}			
		}
		
		TransData.set(res);
	}
		
	private Map<String, Object> addHorosaData(ByteArrayInputStream bis) {
		Map<String, List<Object[]>> map = OfficeUtility.readExcel(bis, 0, keys.length);
		String[] colkeys = null;
		List<Object[]> rows = new LinkedList<Object[]>();
		List<Map<String, Object>> retlist = new LinkedList<Map<String, Object>>();

		for(Map.Entry<String, List<Object[]>> entry: map.entrySet()) {
			rows = entry.getValue();
			break;
		}
		
		if(rows.isEmpty()) {
			Map<String, Object> res = new HashMap<String, Object>();
			res.put("FailCount", 0);
			res.put("Total", 0);
			res.put("FailList", retlist);
			return res;
		}
		
		AstroUser user = (AstroUser)TransData.getCurrentUser();
		if(user == null) {
			throw new ErrorCodeException(90001003, "need.login");
		}
		Object[] objkeys = rows.get(0);
		colkeys = new String[objkeys.length];
		for(int i=0; i<objkeys.length; i++) {
			colkeys[i] = objkeys[i].toString();
		}
		int i=-1;
		Set<String> tags = new HashSet<String>();
		for(Object[] row : rows) {
			i++;
			if(i == 0) {
				continue;
			}
			Map<String, Object> params = new HashMap<String, Object>();
			for(int j=0; j<colkeys.length; j++) {
				params.put(colkeys[j], row[j]);
			}
			params.put("updateTime", System.currentTimeMillis());
			params.put("creator", user.getLoginId());
			String cid = (String)params.get("cid");
			if(!StringUtility.isNullOrEmpty(cid)) {
				params.put("cid", cid);				
			}else {
				params.put("cid", StringUtility.getUUID());				
			}
			String group = (String)params.get("group");
			if(!StringUtility.isNullOrEmpty(group)) {
				try {
					List<String> grp = JsonUtility.decodeList(group, String.class);
					tags.addAll(grp);	
				}catch(Exception e) {
					try {
						String[] ary = StringUtility.splitString(group, ',');	
						for(String s : ary) {
							tags.add(s);
						}
					}catch(Exception er) {
					}
				}
			}
			try {
				AstroCacheHelper.saveChart(params);				
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e);
				retlist.add(params);
			}
		}
		service.saveUser(user);
		
		Map<String, Object> res = new HashMap<String, Object>();
		res.put("FailCount", retlist.size());
		res.put("Total", rows.size()-1);
		res.put("FailList", retlist);
		return res;
	}
	
}
