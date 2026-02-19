package boundless.net.internal;

import boundless.model.HierarchicalMap;
import boundless.netty.ServerAddress;
import boundless.utility.IPUtility;

public class ClientConfiguration implements IClientConfiguration{
	private short _serverId;
	private String _serverName = "default-server";
	private byte _serverType = 0;
	private String _serverAddress;
	private int _port;
	private int _ipnum;
	private long _serverNum;
	private boolean _trackPacket=true;
	
	public ClientConfiguration(short serverId,String serverAddress,int port){
		this._serverId=serverId;
		this._serverAddress=serverAddress;
		this._ipnum = IPUtility.convert(serverAddress);
		this._port=port;
		this._serverNum = ServerAddress.getDistinctCode(_ipnum, _port);
		_serverName = "default-server";
		_serverType = 0;
	}
	
	public ClientConfiguration(HierarchicalMap map){
		this._serverId=(short)map.getAttributeAsInt("serverId");
		this._serverName=map.getAttributeAsString("serverName");
		this._serverType=(byte)map.getAttributeAsInt("serverType");
		this._serverAddress=map.getAttributeAsString("serverAddress");
		this._port=map.getAttributeAsInt("port");
		this._trackPacket=map.getAttributeAsBool("trackPacket",true);
	}
	
	@Override
	public short serverId() {
		return _serverId;
	}
	public ClientConfiguration serverId(short value) {
		_serverId=value;
		return this;
	}

	@Override
	public String serverName() {
		return _serverName;
	}
	public ClientConfiguration serverName(String value) {
		_serverName=value;
		return this;
	}

	@Override
	public byte serverType() {
		return _serverType;
	}
	public ClientConfiguration serverType(byte value) {
		_serverType=value;
		return this;
	}

	@Override
	public String serverAddress() {
		return _serverAddress;
	}
	public ClientConfiguration serverAddress(String value) {
		_serverAddress=value;
		_ipnum = IPUtility.convert(value);
		this._serverNum = ServerAddress.getDistinctCode(_ipnum, _port);
		return this;
	}

	@Override
	public int port() {
		return _port;
	}
	public ClientConfiguration port(int value) {
		_port=value;
		return this;
	}

	@Override
	public boolean trackPacket() {
		return _trackPacket;
	}
	
	@Override
	public IClientConfiguration trackPacket(boolean value) {
		_trackPacket=value;
		return this;
	}

	@Override
	public int serverAddressNum() {
		return _ipnum;
	}

	@Override
	public long serverNum() {
		return this._serverNum;
	}
}
