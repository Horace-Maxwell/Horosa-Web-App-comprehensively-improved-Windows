package boundless.net.bacnet;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.serotonin.bacnet4j.RemoteDevice;
import com.serotonin.bacnet4j.event.DeviceEventAdapter;
import com.serotonin.bacnet4j.type.primitive.ObjectIdentifier;

public class DefaultDeviceEventAdapter extends DeviceEventAdapter {
	
	Map<String, RemoteDevice> remoteDevices = new ConcurrentHashMap<String, RemoteDevice>();

	@Override
	public void iAmReceived(RemoteDevice dev) {
		ObjectIdentifier oid = dev.getObjectIdentifier();
		String key = oid.toString();
		remoteDevices.put(key, dev);
	}

}
