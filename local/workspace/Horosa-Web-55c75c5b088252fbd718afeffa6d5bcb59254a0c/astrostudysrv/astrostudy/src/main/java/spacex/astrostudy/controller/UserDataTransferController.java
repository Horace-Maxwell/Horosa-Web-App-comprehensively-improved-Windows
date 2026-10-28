package spacex.astrostudy.controller;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.office.OfficeUtility;
import boundless.spring.help.interceptor.TransData;
import boundless.types.FileType;
import boundless.utility.FormatUtility;
import boundless.web.common.IUser;
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

}
