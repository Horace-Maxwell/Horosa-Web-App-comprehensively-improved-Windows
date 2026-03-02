package boundless.types.storage;

public class CloudStorage implements ICloudStorage {
	private ICloudStorage storage;

	@Override
	public String getBucketName() {
		return this.storage.getBucketName();
	}

	@Override
	public String getBucketUrl() {
		return this.storage.getBucketUrl();
	}

	@Override
	public String upload(String localFile, String remoteFile) {
		return this.storage.upload(localFile, remoteFile);
	}

	@Override
	public String upload(byte[] raw, String remoteFile) {
		return this.storage.upload(raw, remoteFile);
	}

	@Override
	public void deleteRemote(String remoteFile) {
		this.storage.deleteRemote(remoteFile);
	}

}
