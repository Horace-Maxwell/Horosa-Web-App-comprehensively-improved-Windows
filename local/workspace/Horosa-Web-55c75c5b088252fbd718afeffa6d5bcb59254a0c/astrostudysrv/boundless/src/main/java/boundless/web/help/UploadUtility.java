package boundless.web.help;

import java.io.InputStream;

import javax.servlet.http.Part;

import boundless.io.StorageUtility;
import boundless.io.StorageUtility.StoragePath;
import boundless.spring.help.PropertyPlaceholder;

public class UploadUtility {
	private static final String StorageClassKey = "storage.class";
	
	public static StoragePath saveUpload(Part part) throws Exception {
		String fileName = part.getSubmittedFileName();
		
		String storageclass = PropertyPlaceholder.getProperty(StorageClassKey);
		Class clazz = Class.forName(storageclass);
		InputStream ins = part.getInputStream();
		StoragePath path = StorageUtility.upload(ins, fileName, clazz);
		
		return path;
	}

}
