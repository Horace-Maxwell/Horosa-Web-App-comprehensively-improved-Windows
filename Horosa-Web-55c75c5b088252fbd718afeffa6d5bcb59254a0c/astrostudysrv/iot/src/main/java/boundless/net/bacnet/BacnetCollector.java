package boundless.net.bacnet;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.serotonin.bacnet4j.LocalDevice;
import com.serotonin.bacnet4j.RemoteDevice;
import com.serotonin.bacnet4j.ResponseConsumer;
import com.serotonin.bacnet4j.ServiceFuture;
import com.serotonin.bacnet4j.event.DeviceEventAdapter;
import com.serotonin.bacnet4j.exception.BACnetException;
import com.serotonin.bacnet4j.exception.ErrorAPDUException;
import com.serotonin.bacnet4j.service.acknowledgement.AcknowledgementService;
import com.serotonin.bacnet4j.service.acknowledgement.ReadPropertyAck;
import com.serotonin.bacnet4j.service.confirmed.ConfirmedRequestService;
import com.serotonin.bacnet4j.service.confirmed.ReadPropertyRequest;
import com.serotonin.bacnet4j.service.unconfirmed.UnconfirmedRequestService;
import com.serotonin.bacnet4j.service.unconfirmed.WhoIsRequest;
import com.serotonin.bacnet4j.type.Encodable;
import com.serotonin.bacnet4j.type.constructed.PropertyValue;
import com.serotonin.bacnet4j.type.constructed.SequenceOf;
import com.serotonin.bacnet4j.type.constructed.StatusFlags;
import com.serotonin.bacnet4j.type.constructed.TimeStamp;
import com.serotonin.bacnet4j.type.enumerated.DeviceStatus;
import com.serotonin.bacnet4j.type.enumerated.ErrorCode;
import com.serotonin.bacnet4j.type.enumerated.EventState;
import com.serotonin.bacnet4j.type.enumerated.EventType;
import com.serotonin.bacnet4j.type.enumerated.NotifyType;
import com.serotonin.bacnet4j.type.enumerated.ObjectType;
import com.serotonin.bacnet4j.type.enumerated.PropertyIdentifier;
import com.serotonin.bacnet4j.type.enumerated.Reliability;
import com.serotonin.bacnet4j.type.error.ErrorClassAndCode;
import com.serotonin.bacnet4j.type.notificationParameters.NotificationParameters;
import com.serotonin.bacnet4j.type.primitive.Boolean;
import com.serotonin.bacnet4j.type.primitive.CharacterString;
import com.serotonin.bacnet4j.type.primitive.Null;
import com.serotonin.bacnet4j.type.primitive.ObjectIdentifier;
import com.serotonin.bacnet4j.type.primitive.UnsignedInteger;
import com.serotonin.bacnet4j.util.RequestUtils;

import boundless.exception.UnknownObjectException;
import boundless.function.Consumer3;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.OutParameter;
import boundless.types.Tuple;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

public class BacnetCollector {
	
	public static class ObjectStatus{
		public ObjectIdentifier objId;
		public StatusFlags status;
	}

	public static class DeviceEventListener extends DeviceEventAdapter{
		private LocalDevice localDevice;
		private String broadAddr;
		private BacnetCollector owner;
		
		public DeviceEventListener(String broadAddr, LocalDevice dev, BacnetCollector collector){
			this.broadAddr = broadAddr;
			this.localDevice = dev;
			this.owner = collector;
		}
		
		@Override
		public void iAmReceived(RemoteDevice dev) {
			ObjectIdentifier oid = dev.getObjectIdentifier();
			QueueLog.debug(AppLoggers.getLog("debug", "ddc"), "remote dev received from {}", oid.toString());
			
			Tuple<LocalDevice, RemoteDevice> tuple = new Tuple<LocalDevice, RemoteDevice>(localDevice, dev);
			String key = String.format("%s %d", oid.getObjectType(), oid.getInstanceNumber());
			owner.devMap.put(key, tuple);
			String devno = null;
			try{
				ReadPropertyAck ack = localDevice.send(dev, new ReadPropertyRequest(oid, PropertyIdentifier.objectName)).get();
				devno = ack.getValue().toString();
			}catch(Exception e){
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
			if(!StringUtility.isNullOrEmpty(devno)){
				owner.devMap.put(devno, tuple);
			}
			
			synchronized(owner.devicesReady){
				int n = ConvertUtility.getValueAsInt(owner.devicesReady.get(broadAddr), 0);
				n++;
				owner.devicesReady.put(broadAddr, n);
			}
			
			if(owner.remoteDevReceivedHandler != null){
				try{
					owner.remoteDevReceivedHandler.accept(devno, localDevice, dev);
				}catch(Exception e){
					QueueLog.error(AppLoggers.ErrorLogger, e);
				}
			}
		}

	}
	
	private Tuple<String, LocalDevice> gwDevice = null;
	private Map<String, Integer> devicesReady = new HashMap<String, Integer>();
	private Map<String, Tuple<LocalDevice, RemoteDevice>> devMap = new HashMap<String, Tuple<LocalDevice, RemoteDevice>>();
	
	private Map<String, ObjectIdentifier> oidMap = new HashMap<String, ObjectIdentifier>();
	private Map<String, String> devIdKeyMap = new HashMap<String, String>();
	
	private Consumer3<String, LocalDevice, RemoteDevice> remoteDevReceivedHandler;
	
	public BacnetCollector(int devNumber, String routerIP){
		this(devNumber, routerIP, null);
	}
	public BacnetCollector(int devNumber, String routerIP, int port){
		this(devNumber, routerIP, port, null);
	}
	
	public BacnetCollector(int devNumber, String routerIP, Consumer3<String, LocalDevice, RemoteDevice> remoteDevReceivedHandler){
		this(devNumber, routerIP, 0xBAC0, remoteDevReceivedHandler);
	}
	
	public BacnetCollector(int devNumber, String routerIP, int port, Consumer3<String, LocalDevice, RemoteDevice> remoteDevReceivedHandler){
		this.remoteDevReceivedHandler = remoteDevReceivedHandler;
		gwDevice = BacnetLocalDeviceFactory.create(devNumber, routerIP, port);
		LocalDevice dev = gwDevice.item2();
		String addr = gwDevice.item1();
		dev.getEventHandler().addListener(new DeviceEventListener(addr, dev, this));
		dev.sendGlobalBroadcast(new WhoIsRequest());
	}
	
	public void sendWhoIsRequest(){
		LocalDevice dev = gwDevice.item2();
		dev.sendGlobalBroadcast(new WhoIsRequest());
	}
	
	public void shutdown(){
		LocalDevice dev = gwDevice.item2();
		try{
			dev.terminate();
		}catch(Exception e){
			e.printStackTrace();
		}
		devicesReady.clear();
		devMap.clear();
		oidMap.clear();
		devIdKeyMap.clear();
	}
	
	public boolean containDevice(int devNum) {
		String key = String.format("device %d", devNum);
		return containDevice(key);
	}
	public boolean containDevice(String devId) {
		return devMap.containsKey(devId);
	}
	
	public void setRemoteDeviceReceivedHandler(Consumer3<String, LocalDevice, RemoteDevice> remoteDevReceivedHandler){
		this.remoteDevReceivedHandler = remoteDevReceivedHandler;
	}
	
	public String getRemoteDeviceKey(String remoteDevId){
		return getRemoteDeviceKey(remoteDevId, null);
	}
	
	public DeviceStatus getRemoteDeviceStatus(String remoteDevId){
		Tuple<LocalDevice, RemoteDevice> tuple = getDeviceTuple(remoteDevId);
		if(tuple == null){
			throw new RuntimeException("no found device");
		}
		LocalDevice locDev = tuple.item1();
		RemoteDevice remoteDev = tuple.item2();
		try{
	        ReadPropertyAck sack = locDev.send(remoteDev, new ReadPropertyRequest(remoteDev.getObjectIdentifier(), PropertyIdentifier.systemStatus)).get();
	        DeviceStatus val = sack.getValue();
			return val;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public String getRemoteDeviceKey(String remoteDevId, OutParameter<Integer> instanceNum){
		String key = devIdKeyMap.get(remoteDevId);
		if(StringUtility.isNullOrEmpty(key)){
			String[] parts = StringUtility.splitString(remoteDevId, new char[]{' ', '_', '-'});
			if(instanceNum != null){
				instanceNum.value = ConvertUtility.getValueAsInt(parts[1], -1);
			}
			if(parts.length > 1){
				key = String.format("%s %s", parts[0], parts[1]);
			}else{
				key = remoteDevId;
			}
			devIdKeyMap.put(remoteDevId, key);
		}
		if(instanceNum != null){
			String[] parts = StringUtility.splitString(remoteDevId, new char[]{' ', '_', '-'});
			if(instanceNum != null && parts.length > 1){
				instanceNum.value = ConvertUtility.getValueAsInt(parts[1], -1);
			}
		}
		return key;
	}
	
	synchronized public RemoteDevice getRemoteDevice(String remoteDevId){
		OutParameter<Integer> instanceNum = new OutParameter<Integer>();
		String key = getRemoteDeviceKey(remoteDevId, instanceNum);
		Tuple<LocalDevice, RemoteDevice> tuple = devMap.get(key);
		if(tuple == null){
			try {
				LocalDevice dev = gwDevice.item2();
				if(instanceNum.value != null){
					RemoteDevice remotedev = dev.getRemoteDeviceBlocking(instanceNum.value);
					if(remotedev != null){
						tuple = new Tuple<LocalDevice, RemoteDevice>(dev, remotedev);
						devMap.put(key, tuple);
						return remotedev;
					}
				}
			} catch (Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
			return null;
		}
		return tuple.item2();
	}
	
	private Tuple<LocalDevice, RemoteDevice> getDeviceTuple(String remoteDevId){
		String key = getRemoteDeviceKey(remoteDevId);
		Tuple<LocalDevice, RemoteDevice> tuple = devMap.get(key);
		if(tuple != null){
			return tuple;
		}
		getRemoteDevice(remoteDevId);
		return devMap.get(key);
	}
	
	public <T extends AcknowledgementService> T send(String remoteDevId, ConfirmedRequestService serviceRequest){
		Tuple<LocalDevice, RemoteDevice> tuple = getDeviceTuple(remoteDevId);
		try{
			T srv = tuple.item1().send(tuple.item2(), serviceRequest).get();
			return srv;
		}catch(ErrorAPDUException e){
			ErrorClassAndCode err = e.getError();
			if(err.getErrorCode() == ErrorCode.unknownObject) {
				throw new UnknownObjectException();
			}else {
				throw new RuntimeException(e);				
			}
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public void send(String remoteDevId, ConfirmedRequestService serviceRequest, ResponseConsumer consumer){
		Tuple<LocalDevice, RemoteDevice> tuple = getDeviceTuple(remoteDevId);
		try{
			tuple.item1().send(tuple.item2(), serviceRequest, consumer);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public void send(String remoteDevId, UnconfirmedRequestService serviceRequest){
		Tuple<LocalDevice, RemoteDevice> tuple = getDeviceTuple(remoteDevId);
		try{
			tuple.item1().send(tuple.item2(), serviceRequest);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	private String convertToObjectTypeName(String name){
		StringBuilder sb = new StringBuilder();
		for (int i = 0; i < name.length(); ++i) {
			char c = name.charAt(i);
			if (Character.isUpperCase(c)) {
				sb.append('-').append(Character.toLowerCase(c));
			} else {
				sb.append(c);
			}
		}
		return sb.toString();
	}
	
	public ObjectIdentifier getObjectIdentifier(String pointId){
		ObjectIdentifier oid = oidMap.get(pointId);
		if(oid != null){
			return oid;
		}
		
		String[] parts = StringUtility.splitString(pointId, ' ');
		if(parts.length != 2){
			throw new RuntimeException("is not bacnet point object id, ie: anlogo-input 1");
		}
		String name = convertToObjectTypeName(parts[0]);
		int instNum = ConvertUtility.getValueAsInt(parts[1]);
		ObjectType ot;
		try{
			ot = ObjectType.forName(name);
		}catch(Exception e){
			int v = ConvertUtility.getValueAsInt(parts[0], -1);
			if(v == -1){
				throw new RuntimeException(e);
			}
			ot = ObjectType.forId(v);
		}
		
		oid = new ObjectIdentifier(ot, instNum);
		oidMap.put(pointId, oid);
		return oid;
	}
	
	public Encodable getUnit(String remoteDevId, String pointId){
		Tuple<LocalDevice, RemoteDevice> tuple = getDeviceTuple(remoteDevId);
		ObjectIdentifier oid = getObjectIdentifier(pointId);
		try{
			Encodable res = RequestUtils.sendReadPropertyAllowNull(tuple.item1(), tuple.item2(), oid, PropertyIdentifier.units);
			return res;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public Encodable getName(String remoteDevId, String pointId){
		Tuple<LocalDevice, RemoteDevice> tuple = getDeviceTuple(remoteDevId);
		ObjectIdentifier oid = getObjectIdentifier(pointId);
		try{
			Encodable res = RequestUtils.sendReadPropertyAllowNull(tuple.item1(), tuple.item2(), oid, PropertyIdentifier.objectName);
			return res;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public Encodable getDesc(String remoteDevId, String pointId){
		Tuple<LocalDevice, RemoteDevice> tuple = getDeviceTuple(remoteDevId);
		ObjectIdentifier oid = getObjectIdentifier(pointId);
		try{
			Encodable res = RequestUtils.sendReadPropertyAllowNull(tuple.item1(), tuple.item2(), oid, PropertyIdentifier.description);
			return res;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public Encodable getDeviceType(String remoteDevId, String pointId){
		Tuple<LocalDevice, RemoteDevice> tuple = getDeviceTuple(remoteDevId);
		ObjectIdentifier oid = getObjectIdentifier(pointId);
		try{
			Encodable res = RequestUtils.sendReadPropertyAllowNull(tuple.item1(), tuple.item2(), oid, PropertyIdentifier.deviceType);
			return res;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public StatusFlags getStatusFlags(String remoteDevId, String pointId){
		ObjectIdentifier oid = getObjectIdentifier(pointId);
		ReadPropertyRequest req = new ReadPropertyRequest(oid, PropertyIdentifier.statusFlags);
		ReadPropertyAck ack = send(remoteDevId, req);
		return ack.getValue();
	}
	
	public List<ObjectIdentifier> getObjectList(String remoteDevId){
		Tuple<LocalDevice, RemoteDevice> tuple = getDeviceTuple(remoteDevId);
		if(tuple == null){
			throw new RuntimeException("no found device");
		}
		
		RemoteDevice dev = tuple.item2();
		try{
			SequenceOf seqs = (SequenceOf) RequestUtils.sendReadPropertyAllowNull(tuple.item1(), dev, dev.getObjectIdentifier(), PropertyIdentifier.objectList);
			List<ObjectIdentifier> oids = seqs.getValues();
			return oids;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
		
	}
	
	public List<ObjectStatus> getAllObjectStatus(String remoteDevId){
		List<ObjectIdentifier> oids = getObjectList(remoteDevId);
		Tuple<LocalDevice, RemoteDevice> tuple = getDeviceTuple(remoteDevId);
		LocalDevice locDev = tuple.item1();
		RemoteDevice remoteDev = tuple.item2();
		List<ObjectStatus> res = new ArrayList<ObjectStatus>(oids.size());
		for(ObjectIdentifier oid : oids){
			if(!hasStatusFlags(oid)){
				continue;
			}
			ObjectStatus objstat = new ObjectStatus();
			objstat.objId = oid;
			ReadPropertyRequest req = new ReadPropertyRequest(oid, PropertyIdentifier.statusFlags);
			try{
				ReadPropertyAck ack = locDev.send(remoteDev, req).get();
				objstat.status = ack.getValue();
			}catch(ErrorAPDUException e){
        		com.serotonin.bacnet4j.apdu.Error err = e.getApdu();
        		ErrorClassAndCode code = err.getError().getErrorClassAndCode();
        		ErrorCode errcode = code.getErrorCode();
				objstat.status = new StatusFlags(false, true, false, true);
			}catch(Exception e){
				objstat.status = new StatusFlags(false, true, false, true);
			}
			res.add(objstat);
		}
		
		return res;
	}
	
	private boolean hasStatusFlags(ObjectIdentifier oid){
		ObjectType ot = oid.getObjectType();
		if(ot == ObjectType.analogInput || ot == ObjectType.analogOutput || ot == ObjectType.analogValue ||
				ot == ObjectType.binaryInput || ot == ObjectType.binaryOutput || ot == ObjectType.binaryValue ||
				ot == ObjectType.multiStateInput || ot == ObjectType.multiStateOutput || ot == ObjectType.multiStateValue){
			return true;
		}
		
		return false;
	}
		
	public Encodable getValue(String remoteDevId, String pointId){
		Tuple<LocalDevice, RemoteDevice> tuple = getDeviceTuple(remoteDevId);
		ObjectIdentifier oid = getObjectIdentifier(pointId);
		try{
			Encodable res = RequestUtils.sendReadPropertyAllowNull(tuple.item1(), tuple.item2(), oid, PropertyIdentifier.presentValue);
			return res;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public Encodable getOutOfService(String remoteDevId, String pointId){
		Tuple<LocalDevice, RemoteDevice> tuple = getDeviceTuple(remoteDevId);
		ObjectIdentifier oid = getObjectIdentifier(pointId);
		try{
			Encodable res = RequestUtils.sendReadPropertyAllowNull(tuple.item1(), tuple.item2(), oid, PropertyIdentifier.outOfService);
			return res;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public Encodable getProperty(String remoteDevId, String pointId, PropertyIdentifier propid){
		Tuple<LocalDevice, RemoteDevice> tuple = getDeviceTuple(remoteDevId);
		ObjectIdentifier oid = getObjectIdentifier(pointId);
		try{
			Encodable res = RequestUtils.sendReadPropertyAllowNull(tuple.item1(), tuple.item2(), oid, propid);
			return res;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public Reliability getReliability(String remoteDevId, String pointId){
		Tuple<LocalDevice, RemoteDevice> tuple = getDeviceTuple(remoteDevId);
		ObjectIdentifier oid = getObjectIdentifier(pointId);
		try{
			Reliability res = (Reliability) RequestUtils.sendReadPropertyAllowNull(tuple.item1(), tuple.item2(), oid, PropertyIdentifier.reliability);
			return res;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
}
