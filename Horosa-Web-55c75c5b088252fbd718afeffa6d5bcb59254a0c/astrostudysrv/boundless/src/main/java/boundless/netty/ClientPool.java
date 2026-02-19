package boundless.netty;

import java.util.function.Consumer;
import java.util.function.Supplier;

import org.slf4j.Logger;

import boundless.types.Closable;

public interface ClientPool extends Closable {
	void decreaseCurrentSize();
	Logger log();
	int countPoolSize();
	int countClientObject();
	int countClientRef();
	IClient getClient();
	
	void registerOnConnect(Consumer<IClient> handle);
	void registerHeartbeat(int command, long heartbeatIntervalMS, Supplier<Datagram> datagaramsupply);
	void register(int command, Consumer<ProcessorContext> handler);
	void unregister(int command);
	
	default void connect(){}
	default void close(){}
	default public void setDefaultCallbackHandler(Consumer<ProcessorContext> handler){ throw new RuntimeException("noimplementation"); }
}
