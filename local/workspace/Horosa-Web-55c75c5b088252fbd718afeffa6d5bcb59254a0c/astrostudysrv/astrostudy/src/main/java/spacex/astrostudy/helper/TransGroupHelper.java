package spacex.astrostudy.helper;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import spacex.basecomm.constants.FuncTrans;
import spacex.basecomm.constants.TransGroup;

public class TransGroupHelper {
	private static List<TransGroup> transgroups = new ArrayList<TransGroup>();
	private static Set<String> trancodes = new HashSet<String>();
	private static Map<String, Set<String>> funcTranscodes = new HashMap<String, Set<String>>();
	private static Set<String> commTrancodes = new HashSet<String>();
	
	private static Map<String, List<TransGroup>> appTransgroups = new HashMap<String, List<TransGroup>>();
	private static Map<String, Map<String, Set<String>>> appFuncTranscodes = new HashMap<String, Map<String, Set<String>>>();
	private static Map<String, Set<String>> appTrancodes = new HashMap<String, Set<String>>();

	private static void addTransGroupByJson(String json, String fname, String app) {
		TransGroup transgroup = JsonUtility.decode(json, TransGroup.class);
		
		if(fname.endsWith("/comm.json") || fname.endsWith("\\comm.json")){
			for(FuncTrans func : transgroup.functions){
				commTrancodes.addAll(func.transcodes);						
			}
			return;
		}
		
		for(FuncTrans trans : transgroup.functions){
			Set<String> apptranset = null;
			Map<String, Set<String>> apptransmap = null;
			if(StringUtility.isNullOrEmpty(app)) {
				if(funcTranscodes.containsKey(trans.id)){
					throw new RuntimeException("duplicate FuncId:" + trans.id);
				}
			}else {
				apptransmap = appFuncTranscodes.get(app);
				if(apptransmap == null) {
					apptransmap = new HashMap<String, Set<String>>();
					appFuncTranscodes.put(app, apptransmap);
				}
				if(apptransmap.containsKey(trans.id)){
					throw new RuntimeException("duplicate FuncId:" + trans.id);
				}	
				
				apptranset = appTrancodes.get(app);
				if(apptranset == null) {
					apptranset = new HashSet<String>();
					appTrancodes.put(app, apptranset);
				}
			}
			
			for(String transcode : trans.transcodes){
				if(apptranset == null) {
					if(trancodes.contains(transcode)){
						throw new RuntimeException("duplicate transcode:" + transcode);
					}					
					trancodes.add(transcode);
				}else {
					if(apptranset.contains(transcode)){
						throw new RuntimeException("duplicate transcode:" + transcode);
					}
					apptranset.add(transcode);
				}
				
				transgroup.transcodes.add(transcode);						
			}
			trans.group = transgroup.id;
			if(apptransmap == null) {
				funcTranscodes.put(trans.id, trans.transcodes);				
			}else {
				apptransmap.put(trans.id, trans.transcodes);	
			}
		}
		if(StringUtility.isNullOrEmpty(app)) {
			transgroups.add(transgroup);			
		}else {
			List<TransGroup> list = appTransgroups.get(app);
			if(list == null) {
				list = new ArrayList<TransGroup>();
				appTransgroups.put(app, list);
			}
			list.add(transgroup);
		}
	}
	
	private static void addTransGroup(File file) {
		String fname = file.getAbsolutePath();
		if(!fname.endsWith(".json")){
			return;
		}
		String[] parts = StringUtility.splitString(fname, '/');
		try{
			String app = null;
			if(parts.length > 1) {
				app = parts[parts.length-2];
				if(app.equalsIgnoreCase("transgroup")) {
					app = null;
				}
			}		
			String json = FileUtility.getStringFromFile(fname);
			addTransGroupByJson(json, fname, app);
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
			throw new RuntimeException(e);
		}		
	}
	
	private static void addTransGroup(String classpath) {
		try{
			if(!classpath.endsWith(".json")){
				return;
			}
			String path = classpath;
			if(path.startsWith("/")) {
				path = path.substring(1);
			}
			String[] parts = StringUtility.splitString(path, '/');
			String app = null;
			if(parts.length > 1) {
				app = parts[parts.length-2];
				if(app.equalsIgnoreCase("transgroup")) {
					app = null;
				}
			}		
			
			String json = FileUtility.getStringFromClassPath(path);
			addTransGroupByJson(json, path, app);
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
			throw new RuntimeException(e);
		}				
	}
	
	public static void build(){
		FileUtility.iteratePackage("data/transgroup", (file)->{
			if(file instanceof File) {
				addTransGroup((File)file);
			}else {
				addTransGroup((String)file);
			}
			return false;
		});
	}
	
	
	public static Set<String> getCommTransCodes(){
		Set<String> set = new HashSet<String>();
		set.addAll(commTrancodes);
		return set;
	}
	
	public static String getTransCodes(String funcId){
		String app = TransData.getClientApp();
		Map<String, Set<String>> apptransmap = appFuncTranscodes.get(app);
		Set<String> trans = funcTranscodes.get(funcId);
		if(trans == null && apptransmap != null) {
			trans = apptransmap.get(funcId);
		}
		if(trans == null || trans.isEmpty()){
			return null;
		}
		
		StringBuilder sb = new StringBuilder();
		for(String code : trans){
			sb.append(code).append(",");
		}
		return sb.substring(0, sb.length()-1);
	}
	
	public static TransGroup[] getTransGroups(){
		TransGroup[] groups = new TransGroup[transgroups.size()];
		transgroups.toArray(groups);
		return groups;
	}
	
	public static Map<String, List<TransGroup>> getTransGroupsWithoutFunc(){
		Map<String, List<TransGroup>> res = new HashMap<String, List<TransGroup>>();
		List<TransGroup> groups = new ArrayList<TransGroup>();
		for(TransGroup group : transgroups){
			TransGroup grp = group.cloneWithoutTrans();
			groups.add(grp);
		}
		res.put("allapp", groups);
		
		for(Map.Entry<String, List<TransGroup>> entry : appTransgroups.entrySet()) {
			String app = entry.getKey();
			List<TransGroup> tmpgroups = new ArrayList<TransGroup>();
			List<TransGroup> appgroups = entry.getValue();
			for(TransGroup group : appgroups){
				TransGroup grp = group.cloneWithoutTrans();
				tmpgroups.add(grp);
			}
			res.put(app, tmpgroups);
		}
		
		return res;
	}
	
	public static boolean permitTransCode(String app, String transcode) {
		if(commTrancodes.contains(transcode) || trancodes.contains(transcode)) {
			return true;
		}
		
		Set<String> codes = appTrancodes.get(app);
		if(codes == null || codes.isEmpty()) {
			return false;
		}
		
		return codes.contains(transcode);
	}
	
}
