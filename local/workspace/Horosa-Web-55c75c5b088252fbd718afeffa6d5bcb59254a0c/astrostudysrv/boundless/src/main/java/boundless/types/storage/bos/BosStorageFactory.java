package boundless.types.storage.bos;

import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

import com.baidubce.auth.DefaultBceCredentials;
import com.baidubce.services.bos.BosClient;
import com.baidubce.services.bos.BosClientConfiguration;

import boundless.console.ApplicationUtility;
import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.storage.ICloudStorage;
import boundless.types.storage.ICloudStorageFactory;
import boundless.utility.StringUtility;

public class BosStorageFactory implements ICloudStorageFactory {
	private static Properties bosProp;
	
	private static BosClientConfiguration config;
	private static DefaultBceCredentials credentials;
	
	private static Map<String, ICloudStorage> storages = new HashMap<String, ICloudStorage>();
	
	public synchronized void build(String proppath){
		bosProp = FileUtility.getProperties(proppath);
		String profileName = bosProp.getProperty("profile");
		if(!StringUtility.isNullOrEmpty(profileName)){
			String appPath = ApplicationUtility.getAppPath();
			profileName = profileName.replace("$APPPATH/", appPath);
		}
		try{
			String accessKey = bosProp.getProperty("accesskey");
			String secretKey = bosProp.getProperty("secretkey");
			String endpoint = bosProp.getProperty("endpoint");
			credentials = new DefaultBceCredentials(accessKey, secretKey);
			config = new BosClientConfiguration();
			config.setCredentials(credentials);
			config.setEndpoint(endpoint);
		}catch(Exception e){
			String msg = String.format("Cannot load the credentials from the credential profiles file. "+
						"Please make sure that your credentials file is at the correct " +
						"location %s), and is in valid format.", profileName); 
			QueueLog.error(AppLoggers.ErrorLogger, msg);
			throw new RuntimeException(msg, e);
		}
				
	}

	public ICloudStorage getCloudStorage(String bucketName, String bucketUrl){
		ICloudStorage storage = storages.get(bucketName);
		if(storage == null){
			BosClient bos = new BosClient(config);
			storage = new BosStorage(bos, bucketName, bucketUrl);
			storages.put(bucketName, storage);
		}
		return storage;
	}
	
}
