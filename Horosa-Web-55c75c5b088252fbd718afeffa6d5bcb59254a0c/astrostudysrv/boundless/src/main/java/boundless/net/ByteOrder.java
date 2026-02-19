package boundless.net;

public class ByteOrder {
	private String name;
	
    private ByteOrder(String name) {
        this.name = name;
    }

    public String toString() {
        return name;
    }

    public static final ByteOrder BIG_ENDIAN = new ByteOrder("BIG_ENDIAN");
    public static final ByteOrder LITTLE_ENDIAN = new ByteOrder("LITTLE_ENDIAN");
    
    public static final ByteOrder from(java.nio.ByteOrder byteorder) {
    	if(byteorder == java.nio.ByteOrder.BIG_ENDIAN) {
    		return BIG_ENDIAN;
    	}else {
    		return LITTLE_ENDIAN;
    	}
    }
}
