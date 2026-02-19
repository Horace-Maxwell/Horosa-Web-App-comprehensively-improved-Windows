package boundless.types.storage.s3;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStream;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.internal.SSEResultBase;
import com.amazonaws.services.s3.model.CopyObjectResult;
import com.amazonaws.services.s3.model.DeleteObjectRequest;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;
import com.amazonaws.services.s3.model.PutObjectResult;
import com.amazonaws.services.s3.model.S3Object;

import boundless.io.FileUtility;
import boundless.log.QueueLog;
import boundless.net.http.HttpClientUtility;
import boundless.types.storage.ICloudStorage;
import boundless.utility.StringUtility;

public class S3Storage implements ICloudStorage {
	private AmazonS3 s3Client;
	private String bucketName;
	private String bucketUrl;
	
	public S3Storage(AmazonS3 s3, String bucketName, String bucketDomain){
		this.s3Client = s3;
		this.bucketName = bucketName;
		this.bucketUrl = bucketDomain;
		if(!this.bucketUrl.endsWith("/")){
			this.bucketUrl += "/";
		}
	}

	@Override
	public String upload(String localFile, String remoteFile) {
		File file = new File(localFile);
		if(!file.exists()){
			QueueLog.error(ICloudStorage.log, "file no exist. {}", localFile);
			return "";
		}
		byte[] raw = FileUtility.getBytesFromFile(file);
		return upload(raw, remoteFile);
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
	public String upload(byte[] raw, String remoteFile) {
		try{
			InputStream ins = new ByteArrayInputStream(raw);
			ObjectMetadata meta = new ObjectMetadata();
			meta.setContentType(FileUtility.getContentType(raw));
			String objname = remoteFile;
			if(objname.startsWith("/")) {
				objname = objname.substring(1);
			}
			PutObjectRequest req = new PutObjectRequest(this.bucketName, objname, ins, meta);
			PutObjectResult result = this.s3Client.putObject(req);
			if(result != null){
				if(result != null){
					String remoteFileUrl = this.bucketUrl + req.getKey();
					return remoteFileUrl;
				}
			}
			return "";
		}catch(Exception e){
			QueueLog.error(ICloudStorage.log, e);
			return "";
		}
	}

	@Override
	public void deleteRemote(String remoteFile) {
		String key = remoteFile;
		if(key.startsWith("/")) {
			key = key.substring(1);
		}
		if(remoteFile.startsWith("http")) {
			String delimit = ".com/";
			int idx = remoteFile.lastIndexOf(delimit);
			if(idx > 0) {
				idx += delimit.length();
				key = remoteFile.substring(idx);
				if(key.startsWith("/")) {
					key = key.substring(1);
				}
			}
		}
		this.s3Client.deleteObject(this.bucketName, key);
	}

	@Override
	public String copyRemote(String fromFile, String toFile) {
		String srcName = fromFile;
		String destName = toFile;
		if(srcName.startsWith("/")) {
			srcName = srcName.substring(1);
		}
		if(destName.startsWith("/")) {
			destName = destName.substring(1);
		}
		CopyObjectResult result = this.s3Client.copyObject(this.bucketName, srcName, this.bucketName, destName);
		if(result != null){
			String remoteFileUrl = this.bucketUrl + toFile;
			return remoteFileUrl;
		}
		return "";
	}
	
	public byte[] read(String remoteFile) {
		String objname = remoteFile;
		if(objname.startsWith("/")) {
			objname = objname.substring(1);
		}
		
		S3Object obj = this.s3Client.getObject(bucketName, objname);
		byte[] raw = FileUtility.getBytesFromStream(obj.getObjectContent());
		return raw;
	}
	
	public boolean exist(String remoteFile) {
		String objname = remoteFile;
		if(objname.startsWith("/")) {
			objname = objname.substring(1);
		}
		
		boolean res = false;
		try {
			res = this.s3Client.doesObjectExist(bucketName, objname);
		}catch(Exception e) {
			QueueLog.error(ICloudStorage.log, e);
		}
		
		return res;
	}
	
}
