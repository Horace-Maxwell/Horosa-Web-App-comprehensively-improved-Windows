package boundless.types.storage.oss;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStream;

import com.aliyun.oss.OSS;
import com.aliyun.oss.model.CopyObjectResult;
import com.aliyun.oss.model.OSSObject;
import com.aliyun.oss.model.ObjectMetadata;
import com.aliyun.oss.model.PutObjectRequest;
import com.aliyun.oss.model.PutObjectResult;
import com.aliyun.oss.model.SelectObjectRequest;

import boundless.io.FileUtility;
import boundless.log.QueueLog;
import boundless.types.storage.ICloudStorage;

public class OssStorage implements ICloudStorage {
	private OSS ossClient;
	private String bucketName;
	private String bucketUrl;
	
	public OssStorage(OSS oss, String bucketName, String bucketDomain){
		this.ossClient = oss;
		this.bucketName = bucketName;
		this.bucketUrl = bucketDomain;
		if(!this.bucketUrl.endsWith("/")){
			this.bucketUrl += "/";
		}
	}

	@Override
	public String upload(String localFile, String remoteFile) {
		try{
			File file = new File(localFile);
			if(!file.exists()){
				QueueLog.error(ICloudStorage.log, "file no exist. {}", localFile);
				return "";
			}
			ObjectMetadata meta = new ObjectMetadata();
			meta.setContentType(FileUtility.getContentType(localFile));
			String objname = remoteFile;
			if(objname.startsWith("/")) {
				objname = objname.substring(1);
			}
			PutObjectRequest req = new PutObjectRequest(this.bucketName, objname, file, meta);
			PutObjectResult result = this.ossClient.putObject(req);
			if(result != null){
				String remoteFileUrl = this.bucketUrl + req.getKey();
				return remoteFileUrl;
			}
			return "";
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
			PutObjectResult result = this.ossClient.putObject(req);
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
		this.ossClient.deleteObject(this.bucketName, key);
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
		CopyObjectResult result = this.ossClient.copyObject(this.bucketName, srcName, this.bucketName, destName);
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
		
		OSSObject ossObject = ossClient.getObject(bucketName, objname); 
		
		byte[] raw = FileUtility.getBytesFromStream(ossObject.getObjectContent());
		
		return raw;
	}
	
	public boolean exist(String remoteFile) {
		String objname = remoteFile;
		if(objname.startsWith("/")) {
			objname = objname.substring(1);
		}
		
		boolean res = false;
		try {
			res = ossClient.doesObjectExist(bucketName, objname);
		}catch(Exception e) {
			QueueLog.error(ICloudStorage.log, e);
		}
		
		return res;
	}

	
	
}
