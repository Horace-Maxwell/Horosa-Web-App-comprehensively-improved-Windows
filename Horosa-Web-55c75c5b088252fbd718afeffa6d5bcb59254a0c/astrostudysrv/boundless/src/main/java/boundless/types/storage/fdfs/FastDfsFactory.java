package boundless.types.storage.fdfs;

import java.net.InetSocketAddress;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

import org.csource.fastdfs.ClientGlobal;
import org.csource.fastdfs.TrackerGroup;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.storage.ICloudStorage;
import boundless.types.storage.ICloudStorageFactory;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

public class FastDfsFactory implements ICloudStorageFactory {
	private static Properties fdfsProp;
	
	private static Map<String, ICloudStorage> storages = new HashMap<String, ICloudStorage>();
	
	private String bucketName;
	private String bucketUrl;

	@Override
	public synchronized void build(String proppath) {
		fdfsProp = FileUtility.getProperties(proppath);
		bucketName = fdfsProp.getProperty("bucketName");
		bucketUrl = fdfsProp.getProperty("bucketUrl");
		try {
			int connTimeout = ConvertUtility.getValueAsInt(fdfsProp.get("connect_timeout_in_seconds"), 5000);
			int netTimeout = ConvertUtility.getValueAsInt(fdfsProp.get("network_timeout_in_seconds"), 30000);
			String charset = ConvertUtility.getValueAsString(fdfsProp.get("charset"));
			boolean stealToken = ConvertUtility.getValueAsBool(fdfsProp.get("http_anti_steal_token"), false);
			String secret_key = ConvertUtility.getValueAsString(fdfsProp.get("http_secret_key"));
			int httpPort = ConvertUtility.getValueAsInt(fdfsProp.get("http_tracker_http_port"), 8080);
			String trackerSrv = ConvertUtility.getValueAsString(fdfsProp.get("tracker_servers"));
			
			ClientGlobal.setG_anti_steal_token(stealToken);
			ClientGlobal.setG_charset(charset);
			ClientGlobal.setG_connect_timeout(connTimeout*1000);
			ClientGlobal.setG_network_timeout(netTimeout*1000);
			ClientGlobal.setG_secret_key(secret_key);
			ClientGlobal.setG_tracker_http_port(httpPort);
			
			String[] servers = StringUtility.splitString(trackerSrv, ',');
			InetSocketAddress[] tracker_servers = new InetSocketAddress[servers.length];
			int i = 0;
			for(String srv : servers) {
				String[] parts = StringUtility.splitString(srv, ':');
				if (parts.length != 2) {
					String msg = String.format("the value of item: %s is invalid, the correct format is host:port", srv);
					throw new RuntimeException(msg);
				}
				tracker_servers[i++] = new InetSocketAddress(parts[0].trim(), Integer.parseInt(parts[1].trim()));
			}
			TrackerGroup grp = new TrackerGroup(tracker_servers);
			ClientGlobal.setG_tracker_group(grp);
			
			if(!StringUtility.isNullOrEmpty(bucketName) && !StringUtility.isNullOrEmpty(bucketUrl)) {
				getCloudStorage(bucketName, bucketUrl);				
			}
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
			throw new RuntimeException(e);
		}

	}

	@Override
	public ICloudStorage getCloudStorage(String buckName, String bucketDomain) {
		String bname = buckName;
		ICloudStorage storage;
		if(StringUtility.isNullOrEmpty(buckName)) {
			storage = storages.get(bucketName);		
			bname = bucketName;
		}else {
			storage = storages.get(buckName);			
		}
		
		if(storage == null) {
			String group = fdfsProp.getProperty("group");
			storage = new FdfsStorage(bname, bucketDomain, group);
			storages.put(bname, storage);
		}
		return storage;			
		
	}

}
