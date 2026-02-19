package boundless.types.storage.bos;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStream;

import com.baidubce.services.bos.BosClient;
import com.baidubce.services.bos.model.CopyObjectResponse;
import com.baidubce.services.bos.model.ObjectMetadata;
import com.baidubce.services.bos.model.PutObjectResponse;

import boundless.io.FileUtility;
import boundless.log.QueueLog;
import boundless.net.http.HttpClientUtility;
import boundless.types.storage.ICloudStorage;
import boundless.utility.StringUtility;

public class BosStorage implements ICloudStorage {
	private BosClient bosClient;
	private String bucketName;
	private String bucketUrl;
	
	public BosStorage(BosClient bos, String bucketName, String bucketUrl){
		this.bosClient = bos;
		this.bucketName = bucketName;
		this.bucketUrl = bucketUrl;
		if(this.bucketUrl.endsWith("/")){
			this.bucketUrl = bucketUrl.substring(0, bucketUrl.length()-1);
		}
	}
	
	private String innerUpload(String localFile, String remoteFile){
		try{
			if (!bosClient.doesBucketExist(bucketName)) {
				this.bosClient.createBucket(bucketName);
			}

			// 获取指定文件
			File file = new File(localFile);
			String contentType = FileUtility.getContentType(localFile);
			PutObjectResponse putObjectFromFileResponse = null;
			if(StringUtility.isNullOrEmpty(contentType)){
				putObjectFromFileResponse = this.bosClient.putObject(bucketName, remoteFile, file);
			}else{
				ObjectMetadata meta = new ObjectMetadata();
				meta.setContentType(contentType);
				putObjectFromFileResponse = this.bosClient.putObject(bucketName, remoteFile, file, meta);
			}
			
			// 以文件形式上传Object
			if (putObjectFromFileResponse != null) {
				if(StringUtility.isNullOrEmpty(bucketUrl)){
					return bosClient.generatePresignedUrl(this.bucketName, remoteFile, -1).toString();
				}
				return this.bucketUrl + remoteFile;
			}else{
				return "";
			}
		}catch(Exception e){
			QueueLog.error(ICloudStorage.log, e);
			return "";
		}
	}

	@Override
	public String upload(String localFile, String remoteFile) {
		String url = innerUpload(localFile, remoteFile);
		int retry = 2;
		while(StringUtility.isNullOrEmpty(url) && retry > 0){
			url = innerUpload(localFile, remoteFile);
			retry--;
		}
		return url;
	}

	@Override
	public String upload(byte[] raw, String remoteFile) {
		String url = innerUpload(raw, remoteFile);
		int retry = 2;
		while(StringUtility.isNullOrEmpty(url) && retry > 0){
			url = innerUpload(raw, remoteFile);
			retry--;
		}
		return url;
	}
	
	private String innerUpload(byte[] raw, String remoteFile){
		try{
			if (!bosClient.doesBucketExist(bucketName)) {
				this.bosClient.createBucket(bucketName);
			}

			// 获取指定文件
			InputStream ins = new ByteArrayInputStream(raw);
			String contentType = FileUtility.getContentType(raw);
			PutObjectResponse putObjectFromFileResponse = null;
			if(StringUtility.isNullOrEmpty(contentType)){
				putObjectFromFileResponse = this.bosClient.putObject(bucketName, remoteFile, ins);
			}else{
				ObjectMetadata meta = new ObjectMetadata();
				meta.setContentType(contentType);
				putObjectFromFileResponse = this.bosClient.putObject(bucketName, remoteFile, ins, meta);
			}
			
			if (putObjectFromFileResponse != null) {
				String etag = putObjectFromFileResponse.getETag();
				String remoteFileUrl = this.bucketUrl + remoteFile;
				if(StringUtility.isNullOrEmpty(this.bucketUrl)){
					remoteFileUrl = bosClient.generatePresignedUrl(this.bucketName, remoteFile, -1).toString();
					return remoteFileUrl;
				}
				String val = HttpClientUtility.httpHead(remoteFileUrl, "ETag", 3000);
				if(!StringUtility.isNullOrEmpty(val)){
					val = val.replace("\"", "");
					if(val.equals(etag)){
						return remoteFileUrl;
					}
				}
				return remoteFileUrl = bosClient.generatePresignedUrl(this.bucketName, remoteFile, -1).toString();
			}else{
				return "";
			}
		}catch(Exception e){
			QueueLog.error(ICloudStorage.log, e);
			return "";
		}
	}

	@Override
	public String getBucketName() {
		return this.bucketName;
	}

	@Override
	public String getBucketUrl() {
		return this.bucketUrl;
	}

	@Override
	public void deleteRemote(String remoteFile) {
		this.bosClient.deleteObject(bucketName, remoteFile);
	}
	
	public String copyRemote(String fromFile, String toFile){
		CopyObjectResponse resp = this.bosClient.copyObject(bucketName, fromFile, bucketName, toFile);
		
		if (resp != null) {
			String etag = resp.getETag();
			String remoteFileUrl = this.bucketUrl + toFile;
			if(StringUtility.isNullOrEmpty(this.bucketUrl)){
				remoteFileUrl = bosClient.generatePresignedUrl(this.bucketName, toFile, -1).toString();
				return remoteFileUrl;
			}
			String val = HttpClientUtility.httpHead(remoteFileUrl, "ETag", 3000);
			if(!StringUtility.isNullOrEmpty(val)){
				val = val.replace("\"", "");
				if(val.equals(etag)){
					return remoteFileUrl;
				}
			}
			return remoteFileUrl = bosClient.generatePresignedUrl(this.bucketName, toFile, -1).toString();
		}else{
			return "";
		}
	}


}
