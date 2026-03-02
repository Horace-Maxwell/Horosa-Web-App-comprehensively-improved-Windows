package boundless.netty;

import java.util.Map;
import java.util.concurrent.ScheduledFuture;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.console.Diagnostic;
import boundless.net.external.IServerConfiguration;
import boundless.program.Servers;
import boundless.utility.IPUtility;
import boundless.utility.JsonUtility;
import boundless.utility.PeriodTask;
import boundless.utility.StringUtility;

public final class InnerClusterServer extends NettyServer {
	
	private NettyUDPBroadcaster broadcaster;
	private ScheduledFuture broadSchedule;
	

	public InnerClusterServer(int port, Class decoder, Class encoder) {
		super(port, decoder, encoder);
	}

	public InnerClusterServer(int port, Class decoder) {
		super(port, decoder);
	}

	public InnerClusterServer(IServerConfiguration config, Class decoder, Class encoder) {
		super(config, decoder, encoder);
		initUdp();
	}

	public InnerClusterServer(IServerConfiguration config, Class decoder) {
		super(config, decoder);
		initUdp();
	}

	public InnerClusterServer(IServerConfiguration config) {
		super(config);
		initUdp();
	}
	
	public InnerClusterServer(int port, int udpPort, Class decoder){
		this(port, decoder);
		
		this.udpPort(port);
		initUdp();
	}
	
	public void udpPort(int port){
		this.config.udpPort(port);
	}
	
	public void setResType(String restype){
		this.config.resType(restype);
	}
	
	private void initUdp(){
		if(this.config.udpPort() <= 0){
			this.broadcaster = null;
			return;
		}
		
		String udplogname = this.config.udpLoggerName();
		if(StringUtility.isNullOrEmpty(udplogname)){
			udplogname = "udplog";
			this.config.udpLoggerName(udplogname);
		}
		Logger udpLog = LoggerFactory.getLogger(udplogname);
		
		this.broadcaster = new NettyUDPBroadcaster(this.config.serverId(), this.config.broadAddr(), this.config.udpPort());
		this.broadcaster.log(udpLog);
		this.broadcaster.setTrackPacket(this.config.trackPacket());
		
		this.broadSchedule = PeriodTask.submit(()->{
			broadServerInfo();
		}, 1000, 60000);
	}
	
	public void broadServerInfo(){
		if(broadcaster == null){
			return;
		}
		
		InnerOutboundDatagram data = new InnerOutboundDatagram(BasePacketIds.ServerInfo);

		int[] ips = IPUtility.getLocalIntIps();
		int port = this.port();
		data.write((byte)ips.length);
		for(int ip : ips){
			data.write(ip);
		}
		data.write((short)port);
		
		Map<String, Long> state = Diagnostic.getSystemState();
		state.put("Connection", (long) this.countConnection());
		state.put("Running", (long) this.countRunning());
		
		String json = JsonUtility.encode(state);
		data.writeString(json);

		data.writeShortString(this.config.resType());
		
		broadcaster.broadcast(data);
	}
	
	public void broadWillReboot(){
		if(broadcaster == null){
			return;
		}
		
		InnerOutboundDatagram data = new InnerOutboundDatagram(BasePacketIds.WillReboot);

		int[] ips = IPUtility.getLocalIntIps();
		data.write((byte)ips.length);
		for(int ip : ips){
			data.write(ip);
		}
		
		Server serv = Servers.getServer(this.config.serverId());
		data.write((int)serv.port());
		data.writeShortString(this.config.resType());
		
		broadcaster.broadcast(data);
	}

	@Override
	public void close() {
		try{
			if(this.broadSchedule != null){
				this.broadSchedule.cancel(true);
				this.broadSchedule = null;
			}
		}catch(Exception e){
		}
		
		try{
			super.close();
		}catch(Exception e){
		}
		
		if(this.broadcaster != null){
			this.broadcaster.close();
			this.broadcaster = null;
		}
	}

	@Override
	public synchronized void run() {
		super.run();

		if(this.broadcaster != null){
			this.broadcaster.run();
		}
	}

	
}
