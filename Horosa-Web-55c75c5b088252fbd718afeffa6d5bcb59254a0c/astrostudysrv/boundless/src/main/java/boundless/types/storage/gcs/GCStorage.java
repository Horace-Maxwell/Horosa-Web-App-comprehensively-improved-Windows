package boundless.types.storage.gcs;

import boundless.io.FileUtility;
import boundless.log.QueueLog;
import boundless.types.storage.ICloudStorage;
import com.google.cloud.storage.Storage;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Blob;

public class GCStorage implements ICloudStorage {
	private String bucketName;
	private String bucketUrl;
	
	private Storage service;
	
	public GCStorage(Storage service, String bucketName, String bucketUrl) {
		this.service = service;
		this.bucketName = bucketName;
		this.bucketUrl = bucketUrl;
		if(!this.bucketUrl.endsWith("/")){
			this.bucketUrl += "/";
		}
	}

	@Override
	public String getBucketName() {
		return bucketName;
	}

	@Override
	public String getBucketUrl() {
		return bucketUrl;
	}

	@Override
	public String upload(String localFile, String remoteFile) {
		byte[] raw = FileUtility.getBytesFromFile(localFile);
		String contenttype = FileUtility.getContentType(raw);
		
		BlobId blobId = BlobId.of(bucketName, remoteFile);
		BlobInfo blobInfo = BlobInfo.newBuilder(blobId).setContentType(contenttype).build();
		Storage.BlobTargetOption precondition;
		try {
			if (service.get(bucketName, remoteFile) == null) {
				precondition = Storage.BlobTargetOption.doesNotExist();
			}else {
				precondition = Storage.BlobTargetOption.generationMatch(
				              service.get(bucketName, remoteFile).getGeneration());
			}
			service.create(blobInfo, Files.readAllBytes(Paths.get(localFile)), precondition);	
			return String.format("%s%s", bucketUrl, remoteFile);
		}catch(Exception e) {
			QueueLog.error(ICloudStorage.log, e);
			return "";
		}
	}

	@Override
	public String upload(byte[] raw, String remoteFile) {
		String contenttype = FileUtility.getContentType(raw);
		
		BlobId blobId = BlobId.of(bucketName, remoteFile);
		BlobInfo blobInfo = BlobInfo.newBuilder(blobId).setContentType(contenttype).build();
		Storage.BlobTargetOption precondition;
		if (service.get(bucketName, remoteFile) == null) {
			precondition = Storage.BlobTargetOption.doesNotExist();
		}else {
			precondition =
			          Storage.BlobTargetOption.generationMatch(
			              service.get(bucketName, remoteFile).getGeneration());
		}
		try {
			service.createFrom(blobInfo, new ByteArrayInputStream(raw));
			return String.format("%s%s", bucketUrl, remoteFile);
		}catch(Exception e) {
			QueueLog.error(ICloudStorage.log, e);
			return "";			
		}
	}

	@Override
	public void deleteRemote(String remoteFile) {
		Blob blob = service.get(bucketName, remoteFile);
	    if (blob == null) {
	      return;
	    }
	    
	    Storage.BlobSourceOption precondition =
	            Storage.BlobSourceOption.generationMatch(blob.getGeneration());

	    service.delete(bucketName, remoteFile, precondition);

	}

	@Override
	public String copyRemote(String fromFile, String toFile) {
		BlobId source = BlobId.of(bucketName, fromFile);
	    BlobId target = BlobId.of(bucketName, toFile); 
	    
	    Storage.BlobTargetOption precondition;
	    if (service.get(bucketName, toFile) == null) {
	    	precondition = Storage.BlobTargetOption.doesNotExist();
	    }else {
	    	precondition = Storage.BlobTargetOption.generationMatch(
	    	              service.get(bucketName, toFile).getGeneration());
	    }
	    
	    service.copy(Storage.CopyRequest.newBuilder().setSource(source).setTarget(target, precondition).build());
	    
	    return String.format("%s%s", bucketUrl, toFile);
	}
	
	@Override
	public byte[] read(String remoteFile) {
		byte[] content = service.readAllBytes(bucketName, remoteFile);
		return content;
	}
	
	public boolean exist(String remoteFile) {
		Blob blob = service.get(bucketName, remoteFile);
		return blob != null;
	}

}
