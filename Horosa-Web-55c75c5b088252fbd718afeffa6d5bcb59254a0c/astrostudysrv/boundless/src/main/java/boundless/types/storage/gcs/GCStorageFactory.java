package boundless.types.storage.gcs;

import java.io.ByteArrayInputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

import com.google.cloud.storage.StorageOptions;
import com.google.cloud.storage.Storage;
import com.google.auth.oauth2.GoogleCredentials;

import boundless.io.FileUtility;
import boundless.types.storage.ICloudStorage;
import boundless.types.storage.ICloudStorageFactory;
import boundless.utility.StringUtility;

public class GCStorageFactory implements ICloudStorageFactory {
	private static Properties gcsProp;
	
	private static Map<String, ICloudStorage> storages = new HashMap<String, ICloudStorage>();

	private String bucketName;
	private String bucketUrl;
	
	private StorageOptions.Builder builder;
	private StorageOptions option;
	

	@Override
	public synchronized void build(String proppath) {
		gcsProp = FileUtility.getProperties(proppath);
		String prjId = gcsProp.getProperty("projectid");
		bucketName = gcsProp.getProperty("bucketName");
		bucketUrl = gcsProp.getProperty("bucketUrl");
		try {
			String credentialspath = gcsProp.getProperty("credentials.classpath");
			byte[] raw = FileUtility.getBytesFromClassPath(credentialspath);
			ByteArrayInputStream bins = new ByteArrayInputStream(raw);
			GoogleCredentials credential = GoogleCredentials.fromStream(bins);
			
			builder = StorageOptions.newBuilder();
			builder.setProjectId(prjId);
			builder.setCredentials(credential);
			
			option = builder.build();
			
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
		
		if(!StringUtility.isNullOrEmpty(bucketName) && !StringUtility.isNullOrEmpty(bucketUrl)) {
			getCloudStorage(bucketName, bucketUrl);
		}
		
	}

	@Override
	public ICloudStorage getCloudStorage(String buckName, String bucketDomain) {
		String bname = buckName;
		ICloudStorage storage;
		if(StringUtility.isNullOrEmpty(buckName)) {
			bname = bucketName;
			storage = storages.get(bucketName);			
		}else {
			storage = storages.get(buckName);			
		}
		
		if(storage == null) {
			Storage gcStorage = option.getService();
			storage = new GCStorage(gcStorage, bname, bucketDomain);
			storages.put(bname, storage);
		}
		return storage;
	}

}
