package boundless.types.storage.oss;

import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;

import boundless.io.FileUtility;
import boundless.types.storage.ICloudStorage;
import boundless.types.storage.ICloudStorageFactory;
import boundless.utility.StringUtility;

public class OssStorageFactory implements ICloudStorageFactory {
	private static Properties ossProp;

	private static Map<String, ICloudStorage> storages = new HashMap<String, ICloudStorage>();

	private static OSSClientBuilder builder;
	
	private String bucketName;
	private String bucketUrl;
	private String endpoint;
	private String accessKey;
	private String secretKey;

	@Override
	public void build(String proppath) {
		ossProp = FileUtility.getProperties(proppath);
		builder = new OSSClientBuilder();
		
		bucketName = ossProp.getProperty("bucketName");
		bucketUrl = ossProp.getProperty("bucketUrl");
		endpoint = ossProp.getProperty("endpoint");
		accessKey = ossProp.getProperty("accesskey");
		secretKey = ossProp.getProperty("secretkey");
		
		if(!StringUtility.isNullOrEmpty(bucketName) && !StringUtility.isNullOrEmpty(bucketUrl)) {
			getCloudStorage(bucketName, bucketUrl);
		}
		
	}

	@Override
	public ICloudStorage getCloudStorage(String buckName, String bucketDomain) {
		ICloudStorage storage;
		String bname = buckName;
		if(StringUtility.isNullOrEmpty(buckName)) {
			storage = storages.get(bucketName);	
			bname = bucketName;
		}else {
			storage = storages.get(buckName);			
		}
		
		if(storage == null){
			OSS oss = builder.build(endpoint, accessKey, secretKey);
			storage = new OssStorage(oss, bname, bucketDomain);
			storages.put(bname, storage);
		}
		return storage;
	}
	
}
