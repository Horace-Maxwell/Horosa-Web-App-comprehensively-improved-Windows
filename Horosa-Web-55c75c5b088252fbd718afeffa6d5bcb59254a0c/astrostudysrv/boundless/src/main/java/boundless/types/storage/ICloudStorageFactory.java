package boundless.types.storage;

public interface ICloudStorageFactory {
	public void build(String proppath);
	public ICloudStorage getCloudStorage(String bucketName, String bucketDomain);
}
