package boundless.types;

public interface IStorage {
	public final String LocalFileSys = "0";
	public final String FastDFS = "1";
	
	public void upload(byte[] data, int off, int len);
	public void close();
	public void delete(String remoteUrl);
	public String getUrl();
	public String getFullRemotePath();
	public String getFileSystem();
}
