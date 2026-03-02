package boundless.io;

import java.io.InputStream;
import java.lang.reflect.Constructor;

import boundless.types.IStorage;
import boundless.utility.StringUtility;

public class StorageUtility {
	
	public static IStorage createStorage(String extName, Class clazz) throws Exception{
		Constructor constructor = clazz.getConstructor(String.class);
		Object obj = constructor.newInstance(extName);
		return (IStorage) obj;
	}
	
	public static void delete(String remoteFile, Class clazz) throws Exception{
		createStorage(null, clazz).delete(remoteFile);
	}
	
	public static StoragePath upload(InputStream ins, String fileName, Class clazz) throws Exception{
		String imageurl = null;
		int idx = fileName.lastIndexOf(".");
		String ext = null;
		if(idx >= 0){
			ext = fileName.substring(idx + 1);
		}
		if(StringUtility.isNullOrEmpty(ext)){
			ext = fileName;
		}
		IStorage storage = createStorage(ext, clazz);
		try{
			byte[] data = new byte[1024];
			int len = -1;
			while((len = ins.read(data)) != -1){
				storage.upload(data, 0, len);
			}
			StoragePath path = new StoragePath();
			path.Url = storage.getUrl();
			path.RemotePath = storage.getFullRemotePath();
			path.FileSystem = storage.getFileSystem();
			return path;
		}catch(Exception e){
			throw e;
		}finally{
			storage.close();
		}
	}
	
	public static class StoragePath {
		public long UrlSeq;
		public String Url;
		public String RemotePath;
		public String FileSystem;
	}
}
