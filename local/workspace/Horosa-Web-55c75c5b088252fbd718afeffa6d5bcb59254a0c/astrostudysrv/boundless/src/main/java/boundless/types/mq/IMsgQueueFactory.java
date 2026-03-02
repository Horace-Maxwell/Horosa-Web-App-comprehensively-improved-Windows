package boundless.types.mq;

import boundless.exception.UnimplementedException;

public interface IMsgQueueFactory {
	public void build(String conffilepath);
	public MsgQueue getMsgQueue(String queuename);
	public void shutdown();
	public void setPropertiesPath(String proppath);
	
	default public void deleteQueue(String queuename){ throw new UnimplementedException("Unimplemented"); };
}
