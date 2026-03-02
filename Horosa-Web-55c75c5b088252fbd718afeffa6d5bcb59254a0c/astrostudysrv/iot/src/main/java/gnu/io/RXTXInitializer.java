package gnu.io;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 *
 * @author Bart
 */
public class RXTXInitializer {

    private static final Logger LOGGER = Logger.getLogger(RXTXInitializer.class.getName());
    private static final String RESOURCE_NAME;
    private final static String JAR_VERSION = RXTXVersion.getExpectedNativeVersion();
    private final static String LIB_VERSION;
    private static final String BASE_NAME = "librxtxSerial";
    private static final String OSNAME = System.getProperty("os.name");
    private static final String OSARCH = System.getProperty("os.arch");

    /**
     * Perform a crude check to make sure people don't mix versions of the Jar
     * and native lib
     *
     * Mixing the libs can create a nightmare.
     */
    static {
        try {
            RESOURCE_NAME = resourceName();
            provideNativeLibraries();
            LIB_VERSION = RXTXVersion.nativeGetVersion();
            LOGGER.log(Level.INFO, "Native lib Version = {0}", LIB_VERSION);
            LOGGER.log(Level.INFO, "Java lib Version   = {0}", JAR_VERSION);
            if (!JAR_VERSION.equals(LIB_VERSION)) {
                LOGGER.warning("RXTX Version mismatch");
            }
        } catch (IOException e) {
            throw new IllegalStateException("Cannot initialize native stuff", e);
        }
    }

    private static String resourceName() {
        String retVal = BASE_NAME;
        retVal += "-";
        retVal += OSARCH;
        System.out.println(OSNAME);
        if (OSNAME.toLowerCase().contains("windows")) {
            retVal += ".dll";
        } else if (OSNAME.toLowerCase().contains("mac os x")) {
            retVal += ".jnilib";
        } else {
            retVal += ".so";
        }
        return retVal;
    }

    private static long copy(InputStream input, OutputStream output) throws IOException {
        final byte[] buffer = new byte[1024];
        long count = 0;
        int n = 0;
        while (-1 != (n = input.read(buffer))) {
            output.write(buffer, 0, n);
            count += n;
        }
        return count;
    }

    private static void provideNativeLibraries() throws IOException {
        File outFile = new File(System.getProperty("java.io.tmpdir"));
        String prefix = RESOURCE_NAME.substring(0, RESOURCE_NAME.lastIndexOf("."));
        String suffix = RESOURCE_NAME.substring(RESOURCE_NAME.lastIndexOf(".") + 1, RESOURCE_NAME.length());
        outFile = new File(outFile, prefix + "-" + RXTXVersion.getVersion() + "." + suffix);
        if (!outFile.exists()) {
            try (InputStream is = RXTXVersion.class.getResourceAsStream(RESOURCE_NAME);
                    FileOutputStream fos = new FileOutputStream(outFile)) {
                copy(is, fos);
                LOGGER.log(Level.INFO, "Copied {0} to {1}", new String[]{RESOURCE_NAME, outFile.toString()});
            }
        } else {
            LOGGER.log(Level.INFO, "Native library {0} already exists at {1}", new String[]{RESOURCE_NAME, outFile.toString()});
        }
        System.load(outFile.getAbsolutePath());
        // no longer needed to remove it
        // outFile.deleteOnExit();
    }

    public static void main(String... args) {
    }
}
