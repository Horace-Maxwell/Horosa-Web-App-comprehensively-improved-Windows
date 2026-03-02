package boundless.net.socket;

import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;

import javax.net.ServerSocketFactory;
import javax.net.ssl.SSLServerSocket;

import io.netty.channel.Channel;
import io.netty.channel.ChannelFuture;
import io.netty.channel.group.ChannelGroup;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.net.external.IServerConfiguration;
import boundless.net.external.ServerConfiguration;
import boundless.netty.Datagram;
import boundless.netty.DatagramEncoder;
import boundless.netty.NettyServer;
import boundless.netty.NettySession;
import boundless.netty.PacketRegistor;
import boundless.netty.ProcessorContext;
import boundless.netty.ProcessorExecution;
import boundless.netty.Server;


public class SocketServer implements PacketRegistor,Server {
	public static final Logger globalLog = LoggerFactory.getLogger(SocketServer.class);
	public static final int WorkThreadSize = 10;

	private static int serverCounter = 0;
	
	public static int getActiveServerCount(){
		return serverCounter;
	}
		
	private int type = 0;
	private Logger log;
	private IServerConfiguration config;
	private ProcessorExecution execution;
	private Class decoderClass;
	private Class encoderClass;
	
	private boolean sslClientMode = true;
	private boolean clientAuth = false;
	private boolean alive = false;
	
	public SocketServer(IServerConfiguration config, Class decoder, Class encoder){
		this.config = config;
		this.execution = new ProcessorExecution(WorkThreadSize, "SocketServerOnPort" + config.port());
		this.decoderClass = decoder;
		this.encoderClass = encoder;
		if(encoder == null){
			this.encoderClass = DatagramEncoder.class;
		}
	}
	
	public SocketServer(IServerConfiguration config, Class decoder){
		this(config, decoder, null);
	}
	
	public SocketServer(int port, Class decoder){
		this(port, decoder, null);
	}
	
	public SocketServer(int port, Class decoder, Class encoder){
		ServerConfiguration conf = new ServerConfiguration();
		conf.port(port);
		this.config = conf;
		this.execution = new ProcessorExecution(WorkThreadSize, "SocketServerOnPort" + port);
		this.decoderClass = decoder;
		this.encoderClass = encoder;
		if(encoder == null){
			this.encoderClass = DatagramEncoder.class;
		}
	}
	
	public void log(Logger log){
		this.log = log;
		this.execution.log(log);
	}
	
	public Logger log(){
		if(log == null){
			this.log = NettyServer.globalLog;
		}
		return this.log;
	}
	
	public void setType(int n){
		this.type = n;
	}
	
	public int getType(){
		return this.type;
	}
		
	
	@Override
	public void register(int command, Consumer<ProcessorContext> handler) {
		this.execution.register(command, handler);
	}

	@Override
	public void unregister(int command) {
		this.execution.unregister(command);
	}
	
	@Override
	public void addChain(Function<ProcessorContext, Boolean> fun){
		this.execution.addChain(fun);
	}
	
	@Override
	public void addAfterChain(Function<ProcessorContext, Boolean> fun){
		this.execution.addAfterChain(fun);
	}
	
	@Override
	public void addBeforeCmdChain(int command, Function<ProcessorContext, Boolean> fun){
		this.execution.addBeforeCmdChain(command, fun);
	}
	
	@Override
	public void addAfterCmdChain(int command, Function<ProcessorContext, Boolean> fun){
		this.execution.addAfterCmdChain(command, fun);
	}
	
	@Override
	public void broadcast(Function<Object, Datagram> fun){
		this.execution.broadcast(fun);
	}
	
	@Override
	public void broadcast(Datagram data){
		// TODO Auto-generated method stub
	}
	
	@Override
	public int port(){
		return this.config.port();
	}

	@Override
	public int countConnection() {
		// TODO Auto-generated method stub
		return 0;
	}

	public int countRunning(){
		return this.execution.countRunning();
	}

	@Override
	public List<Object> getAttachList() {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public void treatAttach(Consumer<Object> consumer) {
		// TODO Auto-generated method stub
		
	}

	@Override
	public NettySession[] getMostActiveSessions() {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public NettySession getSession(String sessionId) {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public NettySession[] getAllSessions() {
		// TODO Auto-generated method stub
		return null;
	}
	
	
	protected ServerSocket createServerSocket() throws IOException {
		InetAddress inetaddress = null;
		ServerSocket serversocket = ServerSocketFactory.getDefault().createServerSocket(
				this.config.port(), this.config.maxClient(),
				inetaddress);
		serversocket.setReuseAddress(true);
		serversocket.setSoTimeout(this.config.timeout() * 1000);
		if (serversocket instanceof SSLServerSocket) {
			SSLServerSocket sslserversocket = (SSLServerSocket) serversocket;
			sslserversocket.setUseClientMode(sslClientMode);
			if (!sslClientMode){
				sslserversocket.setNeedClientAuth(clientAuth);
			}
		}
		return serversocket;
	}
	
	public boolean isAlive(){
		return this.alive;
	}

	synchronized public void run(){
		
	}

	@Override
	public void close() {
		// TODO Auto-generated method stub
		
	}
	
}
