package boundless.types.storage.fdfs;


import org.csource.common.NameValuePair;
import org.csource.fastdfs.StorageClient;
import org.csource.fastdfs.StorageServer;
import org.csource.fastdfs.TrackerClient;
import org.csource.fastdfs.TrackerServer;

import boundless.io.FileUtility;
import boundless.types.storage.ICloudStorage;

public class FdfsStorage implements ICloudStorage {
	private String bucketName;
	private String bucketUrl;
	private String group;
	
	public FdfsStorage(String bucketName, String bucketUrl, String group) {
		this.bucketName = bucketName;
		this.bucketUrl = bucketUrl;
		if(bucketUrl == null) {
			this.bucketUrl = "";
		}
		this.group = group;
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
	    return upload(raw, remoteFile);
	}

	@Override
	public String upload(byte[] raw, String remoteFile) {
		TrackerClient tracker = new TrackerClient();
		try {
			TrackerServer trackerServer = tracker.getConnection();
			StorageServer storageServer = tracker.getStoreStorage(trackerServer, this.group);
		    StorageClient client = new StorageClient(trackerServer, storageServer);
		    
		    NameValuePair[] meta_list = new NameValuePair[] { 
		    	new NameValuePair("remoteId", remoteFile),
		    	new NameValuePair("bucketName", this.bucketName),
		    };
		    
		    int extidx = remoteFile.lastIndexOf('.');
		    String ext = "raw";
		    if(extidx < remoteFile.length() - 1) {
		    	ext = remoteFile.substring(extidx + 1);
		    	if(ext.length() > 8) {
		    		ext = "raw";
		    	}
		    }
		    
		    String[] resup = client.upload_file(group, raw, ext, meta_list);
		    String res = String.format("%s/%s/%s", this.bucketUrl, resup[0], resup[1]);
		    
			return res;
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
	}

	@Override
	public void deleteRemote(String remoteFile) {
		int idx = this.group.length() + 2;
		try {
			String key = remoteFile.substring(idx);
			TrackerClient tracker = new TrackerClient();
			TrackerServer trackerServer = tracker.getConnection();
			StorageServer storageServer = tracker.getStoreStorage(trackerServer, this.group);
		    StorageClient client = new StorageClient(trackerServer, storageServer);
			client.delete_file(this.group, key);
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
		
	}

	@Override
	public String copyRemote(String fromFile, String toFile) {
		int idx = this.group.length() + 2;
		try {
			String key = fromFile.substring(idx);
			TrackerClient tracker = new TrackerClient();
			TrackerServer trackerServer = tracker.getConnection();
			StorageServer storageServer = tracker.getStoreStorage(trackerServer, this.group);
		    StorageClient client = new StorageClient(trackerServer, storageServer);
		    byte[] raw = client.download_file(this.group, key);
			return upload(raw, toFile);
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}

}
