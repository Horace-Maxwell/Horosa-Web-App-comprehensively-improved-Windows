package boundless.types.storage.bos;

import java.io.File;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

import com.baidubce.auth.DefaultBceCredentials;
import com.baidubce.services.bos.BosClient;
import com.baidubce.services.bos.BosClientConfiguration;
import com.baidubce.services.bos.model.BosObject;
import com.baidubce.services.bos.model.ObjectMetadata;
import com.baidubce.services.bos.model.PutObjectResponse;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.StringUtility;

public class BosUtility {
	private static Map<String, BosClient> clients = new HashMap<String, BosClient>();
	
	private static BosClient getClient(String accessKeyId, String secretAccessKey, String endpoint){
		String key = String.format("%s,%s,%s", accessKeyId, secretAccessKey, endpoint);
		BosClient client = clients.get(key);
		if(client == null){
			// 初始化一个BosClient
			BosClientConfiguration config = new BosClientConfiguration();
			config.setCredentials(new DefaultBceCredentials(accessKeyId, secretAccessKey));

			// 上面的方式使用默认域名作为BOS的服务地址，如果用户需要自己制定域名，可以通过传入ENDPOINT参数来指定
			/**
			 * 注意：ENDPOINT参数只能用指定的包含Region的域名来进行定义，目前BOS只提供北京一个Region，因此ENDPOINT支持主域名http://bj.bcebos.com和备域名http://bj.baidubos.com，随着Region的增加将会开放其他可以支持的域名。
			 */
			config.setEndpoint(endpoint);
			client = new BosClient(config);
			clients.put(key, client);
		}
		
		return client;
	}

	public static Boolean upload(String accessKeyId, String secretAccessKey, String endpoint, 
			String bucketName, String remotefile, String localFile) {
		return upload(accessKeyId, secretAccessKey, endpoint, bucketName, remotefile, null, localFile);
	}
	
	public static Boolean upload(String accessKeyId, String secretAccessKey, String endpoint, 
			String bucketName, String remotefile, String contentType, String localFile) {
		try {
			BosClient client = getClient(accessKeyId, secretAccessKey, endpoint);
			
			Bucket bucket = new Bucket();
			if (!bucket.doesBucketExist(client, bucketName)) {
				bucket.createBucket(client, bucketName);
			}

			// 获取指定文件
			File file = new File(localFile);
			PutObjectResponse putObjectFromFileResponse = null;
			if(StringUtility.isNullOrEmpty(contentType)){
				putObjectFromFileResponse = client.putObject(bucketName, remotefile, file);
			}else{
				ObjectMetadata meta = new ObjectMetadata();
				meta.setContentType(contentType);
				putObjectFromFileResponse = client.putObject(bucketName, remotefile, file, meta);
			}
			
			// 以文件形式上传Object
			if (putObjectFromFileResponse != null) {
				return true;
			}else{
				return false;
			}
		} catch (Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
			return false;
		}

	}

	public static void download(String accessKeyId, String secretAccessKey, String endpoint, 
			String bucketName, String remotefile, String localFile){
		try{
			BosClient client = getClient(accessKeyId, secretAccessKey, endpoint);
			
			BosObject object = client.getObject(bucketName, remotefile);

			InputStream objectContent = object.getObjectContent();
			FileUtility.save(localFile, objectContent);
			objectContent.close();
			
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
			throw new RuntimeException(e);
		}
	}
	
	public static void delete(String accessKeyId, String secretAccessKey, String endpoint, String bucketName, String remotefile){
		try{
			BosClient client = getClient(accessKeyId, secretAccessKey, endpoint);
			client.deleteObject(bucketName, remotefile);
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
			throw new RuntimeException(e);
		}
	}

}
