package spacex.basecomm.helper;

import org.slf4j.Logger;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.mq.MsgQueue;
import boundless.types.mq.MsgQueueFactory;

public class MqttHelper {
	private static Logger logger = AppLoggers.getLog("mqtt", "mqtt");
	private static Logger errlogger = AppLoggers.getLog("mqtt", "mqtterr");
	
	private static String topicOpenTrigger = "/homedoor/opentrigger";
	private static String topicCloseTrigger = "/homedoor/closetrigger";
	
	private static MsgQueue doorQueue;
	
	static {
		try {
			doorQueue = MsgQueueFactory.getMsgQueue("mqttqueue", "doorlock");			
		}catch(Exception e) {
			QueueLog.error(errlogger, e);
		}
	}
		
	public static void initDoorQueue() {
		doorQueue.subscribe("/homedoor/online", (val)->{
			QueueLog.debug(logger, "/homedoor/online: {}", val);
		}, (e)->{
			QueueLog.error(errlogger, e);
		});

		doorQueue.subscribe(topicOpenTrigger, (val)->{
			QueueLog.debug(logger, "{}: {}", topicOpenTrigger, val);
		}, (e)->{
			QueueLog.error(errlogger, e);
		});

		doorQueue.subscribe(topicCloseTrigger, (val)->{
			QueueLog.debug(logger, "{}: {}", topicCloseTrigger, val);
		}, (e)->{
			QueueLog.error(errlogger, e);
		});

	}
	
	public static MsgQueue getDoorQueue() {
		return doorQueue;
	}
	
	public static void lockDoor() {
		doorQueue.publish(topicCloseTrigger, "1");
	}
	
	public static void unlockDoor() {
		doorQueue.publish(topicOpenTrigger, "1");
	}
	
}
