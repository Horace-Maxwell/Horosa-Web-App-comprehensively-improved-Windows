package test.io;

import boundless.io.FileUtility;

public class FileUtilityTest {
	public static void main(String args[]) throws Throwable {
		System.out.println("FileNameWithoutExtension:"+FileUtility.getFileNameWithoutExtension("E:/1/test.txt"));
		
		String[] files=FileUtility.searchFiles("E:/迅雷下载", "*.zip");
		System.out.println("length:"+files.length);
		
		String[] paths=FileUtility.getSubdirectories("E:/迅雷下载");
		System.out.println("length:"+paths.length);
	}
}
