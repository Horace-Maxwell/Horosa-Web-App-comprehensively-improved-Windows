package boundless.netty;

import java.util.function.Consumer;
import java.util.function.Function;

public interface PacketRegistor {
	public void register(int command, Consumer<ProcessorContext> handler);
	public void unregister(int command);
	
	default public void registerHeartbeatHandle(int command, Consumer<ProcessorContext> handler){}
	default public void addChain(Function<ProcessorContext, Boolean> fun){}
	default public void addAfterChain(Function<ProcessorContext, Boolean> fun){}
	default public void addBeforeCmdChain(int command, Function<ProcessorContext, Boolean> fun){}
	default public void addAfterCmdChain(int command, Function<ProcessorContext, Boolean> fun){}
}
