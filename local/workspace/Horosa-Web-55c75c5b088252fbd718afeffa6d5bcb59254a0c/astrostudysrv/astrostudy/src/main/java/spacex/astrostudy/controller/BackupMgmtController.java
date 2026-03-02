package spacex.astrostudy.controller;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.io.FileUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.FormatUtility;
import boundless.utility.ProcessUtility;
import boundless.utility.StringUtility;

@Controller
@RequestMapping("/bak")
public class BackupMgmtController {
	private static String BackupDir = PropertyPlaceholder.getProperty("backupdir", "/bak");
	private static String BackupScript = PropertyPlaceholder.getProperty("backupscript", "/bak/bakdb.sh");
	private static String DelBackupScript = PropertyPlaceholder.getProperty("delbakscript", "/bak/delbak.sh");

	@RequestMapping("/backup")
	@ResponseBody
	public void backup(){
		Date dt = new Date();
		String dtstr = FormatUtility.formatDateTime(dt, "yyyyMMdd");
		String tmstr = FormatUtility.formatDateTime(dt, "HHmmss");
		String dirn = String.format("%s/%s_%s/", BackupDir, dtstr, tmstr);
		String cmd = String.format("%s %s", BackupScript, dirn);
		ProcessUtility.execute(cmd);

	}
	
	@RequestMapping("/delete")
	@ResponseBody
	public void delbak() {
		String dir = TransData.getValueAsString("dir");
		if(StringUtility.isNullOrEmpty(dir) || dir.startsWith("/")) {
			return;
		}
		dir = String.format("%s/%s", BackupDir, dir);
		int idx = dir.indexOf("../");
		if(idx >= 0){
			return;
		}
		
		String cmd = String.format("%s %s", DelBackupScript, dir);
		ProcessUtility.execute(cmd);		
	}
	
	@RequestMapping("/list")
	@ResponseBody
	public void listbak() {
		List<Map<String, Object>> list =new ArrayList<Map<String, Object>>();
		FileUtility.iterateFiles(BackupDir, (file)->{
		}, (dir)->{
			String name = dir.getName();
			long sz = FileUtility.getFileSize(dir);
			Map<String, Object> map = new HashMap<String, Object>();
			map.put("Dir", name);
			map.put("Size", sz);
			
			list.add(map);
		}, 1);
		list.sort((e1, e2)->{
			String dir1 = (String) e1.get("Dir");
			String dir2 = (String) e2.get("Dir");
			return dir2.compareTo(dir1);
		});
		TransData.set("List", list);
		TransData.set("Total", list.size());
	}
	
}
