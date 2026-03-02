package boundless.types.storage.s3;

import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

import com.amazonaws.auth.AWSCredentials;
import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.auth.profile.ProfileCredentialsProvider;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;

import boundless.console.ApplicationUtility;
import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.storage.ICloudStorage;
import boundless.types.storage.ICloudStorageFactory;
import boundless.utility.StringUtility;

public class S3StorageFactory implements ICloudStorageFactory {
	private static Properties sqsProp;
	
	private static AWSCredentials credentials = null;
	private static AWSCredentialsProvider credentialsProvider = null;

	private static AmazonS3ClientBuilder builder;
	
	private static Map<String, ICloudStorage> storages = new HashMap<String, ICloudStorage>();
	
	private String bucketName;
	private String bucketUrl;
	
	public synchronized void build(String proppath){
		sqsProp = FileUtility.getProperties(proppath);
		String profileName = sqsProp.getProperty("credentials.file");
		if(!StringUtility.isNullOrEmpty(profileName)){
			String appPath = ApplicationUtility.getAppPath();
			profileName = profileName.replace("$APPPATH/", appPath);
		}
		String regionstr = sqsProp.getProperty("region");
		try{
			if(!StringUtility.isNullOrEmpty(profileName) && FileUtility.exists(profileName)){
				ProfileCredentialsProvider prov = new ProfileCredentialsProvider(profileName);
				credentials = prov.getCredentials();
			}else{
				String accessKey = sqsProp.getProperty("accesskey");
				String secretKey = sqsProp.getProperty("secretkey");
				credentials = new BasicAWSCredentials(accessKey, secretKey);
			}
			credentialsProvider = new AWSStaticCredentialsProvider(credentials);
		}catch(Exception e){
			String msg = String.format("Cannot load the credentials from the credential profiles file. "+
						"Please make sure that your credentials file is at the correct " +
						"location %s), and is in valid format.", profileName); 
			QueueLog.error(AppLoggers.ErrorLogger, msg);
			throw new RuntimeException(msg, e);
		}
		
		builder = AmazonS3ClientBuilder.standard().withCredentials(credentialsProvider);
		builder.setRegion(regionstr);
		
		bucketName = sqsProp.getProperty("bucketName");
		bucketUrl = sqsProp.getProperty("bucketUrl");
		if(!StringUtility.isNullOrEmpty(bucketName) && !StringUtility.isNullOrEmpty(bucketUrl)) {
			getCloudStorage(bucketName, bucketUrl);
		}
	}

	public ICloudStorage getCloudStorage(String buckName, String bucketDomain){
		ICloudStorage storage;
		String bname = buckName;
		if(StringUtility.isNullOrEmpty(buckName)) {
			storage = storages.get(bucketName);	
			bname = bucketName;
		}else {
			storage = storages.get(buckName);			
		}
		
		if(storage == null){
			AmazonS3 s3 = builder.build();
			storage = new S3Storage(s3, bname, bucketDomain);
			storages.put(bname, storage);
		}
		return storage;
	}
	
}
