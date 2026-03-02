package boundless.types.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.exception.UnimplementedException;
import boundless.io.FileUtility;
import boundless.log.AppLoggers;

public interface ICloudStorage {
	public static final Logger log = AppLoggers.getLog("storage", "cloudstorage");
	
	public String getBucketName();
	public String getBucketUrl();
	
	default public String upload(String localFile, String remoteFile) {
		byte[] raw = FileUtility.getBytesFromFile(localFile);
		return upload(raw, remoteFile);		
	}
	
	default public String upload(byte[] raw, String remoteFile){ throw new UnimplementedException("Unimplemented"); }
	default public void deleteRemote(String remoteFile){ throw new UnimplementedException("Unimplemented"); }
	default public String copyRemote(String fromFile, String toFile){ throw new UnimplementedException("Unimplemented"); }
	default public byte[] read(String remoteFile){ throw new UnimplementedException("Unimplemented"); }
	default public boolean exist(String remoteFile){ throw new UnimplementedException("Unimplemented"); }
}
