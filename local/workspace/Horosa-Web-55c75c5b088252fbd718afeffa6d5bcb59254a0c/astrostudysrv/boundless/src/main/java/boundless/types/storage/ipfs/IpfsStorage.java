package boundless.types.storage.ipfs;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import boundless.net.http.HttpClientUtility;
import boundless.net.http.HttpClientUtility.MultiPartContent;
import boundless.types.storage.ICloudStorage;
import boundless.utility.JsonUtility;

public class IpfsStorage implements ICloudStorage {
	private String apiUrl;
	private String apiKey;
	private String projectId;
	
	private String bucketName;
	private String bucketUrl;
	
	public IpfsStorage(String bucketName, String bucketUrl, String apiUrl, String projectId, String apiKey) {
		this.apiUrl = apiUrl;
		this.projectId = projectId;
		this.apiKey = apiKey;
		this.bucketName = bucketName;
		this.bucketUrl = bucketUrl;
	}
	
	@Override
	public String getBucketName() {
		return this.bucketName;
	}

	@Override
	public String getBucketUrl() {
		return bucketUrl;
	}
	
	@Override
	public String upload(byte[] raw, String remoteFile) {
		MultiPartContent multipart = HttpClientUtility.createMultiPart("filedata", raw, remoteFile);
		List<MultiPartContent> data = new ArrayList<MultiPartContent>(1);
		data.add(multipart);
		
		String url = String.format("%s/add", this.apiUrl);
		byte[] ret = HttpClientUtility.httpPostMultiPart(this.projectId, this.apiKey, url, data);
		try {
			String json = new String(ret, "UTF-8");
			Map<String, Object> map = JsonUtility.toDictionary(json);
			String hash = (String) map.get("Hash");
			return String.format("%s/%s/", this.bucketUrl, this.bucketName, hash);
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}

	@Override
	public void deleteRemote(String remoteFile) {
		String key = remoteFile;
		if(remoteFile.startsWith("http")) {
			String delimit = "/";
			int idx = remoteFile.lastIndexOf(delimit);
			if(idx > 0) {
				idx += delimit.length();
				key = remoteFile.substring(idx);
			}
		}
		String url = String.format("%s/pin/rm?arg=%s", this.apiUrl, key);
		HttpClientUtility.httpPost(this.projectId, this.apiKey, url, (String)null);
	}

}
