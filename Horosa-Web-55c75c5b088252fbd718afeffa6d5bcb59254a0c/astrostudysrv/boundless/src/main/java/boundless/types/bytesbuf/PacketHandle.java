package boundless.types.bytesbuf;

import java.util.List;

public interface PacketHandle {
	public void accept(List<Object> packets);
}
