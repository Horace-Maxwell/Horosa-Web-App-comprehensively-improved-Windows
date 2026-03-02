package boundless.types.storage.ipfs;

import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

import boundless.io.FileUtility;
import boundless.types.storage.ICloudStorage;
import boundless.types.storage.ICloudStorageFactory;
import boundless.utility.StringUtility;

public class IpfsStorageFactory implements ICloudStorageFactory {
	private static Map<String, ICloudStorage> storages = new HashMap<String, ICloudStorage>();
	private static Properties prop;
	
	private String bucketName;
	private String bucketUrl;

	@Override
	public void build(String proppath) {
		prop = FileUtility.getProperties(proppath);

		bucketName = prop.getProperty("bucketName");
		bucketUrl = prop.getProperty("bucketUrl");
		if(!StringUtility.isNullOrEmpty(bucketName) && !StringUtility.isNullOrEmpty(bucketUrl)) {
			getCloudStorage(bucketName, bucketUrl);			
		}
	}

	@Override
	public ICloudStorage getCloudStorage(String buckName, String bucketUrl) {
		ICloudStorage storage;
		String bname = buckName;
		if(StringUtility.isNullOrEmpty(buckName)) {
			storage = storages.get(bucketName);	
			bname = bucketName;
		}else {
			storage = storages.get(buckName);			
		}
		
		if(storage == null) {
			String prjId = prop.getProperty("projectId");
			String apiKey = prop.getProperty("apiKey");
			String apiUrl = prop.getProperty("apiUrl");
			
			storage = new IpfsStorage(bname, bucketUrl, apiUrl, prjId, apiKey);
			storages.put(bname, storage);
		}
		return storage;
	}

}
