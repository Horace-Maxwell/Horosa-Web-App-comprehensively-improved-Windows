package org.pngquant;


import boundless.utility.NativeUtils;

abstract class LiqObject {
    static {
        // libimagequant.jnilib or libimagequant.so must be in java.library.path
//        System.loadLibrary("imagequant");
        try {
			NativeUtils.loadLibraryFromJar("/org/pngquant/libimagequant.jnilib");
		} catch (Exception e) {
			try{
				NativeUtils.loadLibraryFromJar("/org/pngquant/libimagequant.so");
			}catch(Exception err){
				err.printStackTrace();
				throw new RuntimeException(err);
			}
		}
    }

    long handle;

    /**
     * Free memory used by the library. The object must not be used after this call.
     */
    abstract public void close();

    protected void finalize() throws Throwable {
        close();
    }
}
