package boundless.types.mq.sqs;

import java.util.Collection;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;

import com.amazonaws.auth.AWSCredentials;
import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.auth.profile.ProfileCredentialsProvider;
import com.amazonaws.services.sqs.AmazonSQS;
import com.amazonaws.services.sqs.AmazonSQSClient;
import com.amazonaws.services.sqs.AmazonSQSClientBuilder;

import boundless.console.ApplicationUtility;
import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.ExecutionGroup;
import boundless.types.OutParameter;
import boundless.types.Tuple;
import boundless.types.mq.IMsgQueueFactory;
import boundless.types.mq.MsgQueue;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

public class SQSQueueFactory implements IMsgQueueFactory {
	private static Properties sqsProp;
	
	private static AWSCredentials credentials = null;
	private static AWSCredentialsProvider credentialsProvider = null;
	private static AmazonSQS sqs = null;
	
	private static boolean needCheck = false;
	private static int checkInterval = 60000;
	private static ExecutionGroup executor = null;

	public synchronized void build(String proppath){
		close();
		
		sqsProp = FileUtility.getProperties(proppath);
		String profileName = sqsProp.getProperty("credentials.file");
		if(!StringUtility.isNullOrEmpty(profileName)){
			String appPath = ApplicationUtility.getAppPath();
			profileName = profileName.replace("$APPPATH/", appPath);
		}
		String regionstr = sqsProp.getProperty("region");
		needCheck = ConvertUtility.getValueAsBool(sqsProp.getProperty("needcheck"), false);
		int chkinterval = ConvertUtility.getValueAsInt(sqsProp.getProperty("checkinterval"));
		if(chkinterval > 0){
			checkInterval = chkinterval;
		}
		
		try{
			if(!StringUtility.isNullOrEmpty(profileName) && FileUtility.exists(profileName)){
				ProfileCredentialsProvider prov = new ProfileCredentialsProvider(profileName);
				credentials = prov.getCredentials();
			}else{
				String accessKey = sqsProp.getProperty("accesskey");
				String secretKey = sqsProp.getProperty("secretkey");
				credentials = new BasicAWSCredentials(accessKey, secretKey);
			}
			credentialsProvider = new AWSStaticCredentialsProvider(credentials);
		}catch(Exception e){
			String msg = String.format("Cannot load the credentials from the credential profiles file. "+
						"Please make sure that your credentials file is at the correct " +
						"location %s), and is in valid format.", profileName); 
			QueueLog.error(MsgQueue.log, msg);
			throw new RuntimeException(msg, e);
		}
		
		AmazonSQSClientBuilder builder = AmazonSQSClientBuilder.standard().withCredentials(credentialsProvider).withRegion(regionstr);
		
		sqs = builder.defaultClient();
		
		if(needCheck){
			executor = new ExecutionGroup(1, "SQSQueueFactoryCheckMsg");
			executor.execute(()->{
				try{
					while(true){
						boolean needsleep = false;
						Tuple<SQSQueue, OutParameter<Integer>>[] tuples = getTuples();
						for(Tuple<SQSQueue, OutParameter<Integer>> tuple : tuples){
							try{
								boolean tmp = tuple.item1().checkMsgOnce();
								if(tmp == false){
									needsleep = true;
								}
							}catch(Exception e){
								QueueLog.error(AppLoggers.ErrorLogger, e);
							}
						}
						if(needsleep || tuples.length == 0){
							Thread.sleep(checkInterval);
						}
					}
				}catch(Exception e){
					QueueLog.error(AppLoggers.ErrorLogger, e);
				}
			});
		}

		
	}
		
	public static void close(){
		try{
			if(sqs != null){
				sqs.shutdown();
			}
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}
	
	private Map<String, Tuple<SQSQueue, OutParameter<Integer>>> queues = new ConcurrentHashMap<String, Tuple<SQSQueue, OutParameter<Integer>>>();

	@Override
	public MsgQueue getMsgQueue(String queuename) {
		Tuple<SQSQueue, OutParameter<Integer>> tuple = this.queues.get(queuename);
		if(tuple == null){
			SQSQueue queue = new SQSQueue(this, sqs, queuename);
			OutParameter<Integer> cnt = new OutParameter<Integer>();
			cnt.value = 1;
			tuple = new Tuple<SQSQueue, OutParameter<Integer>>(queue, cnt);
			this.queues.put(queuename, tuple);
			return queue;
		}
		tuple.item2().value++;
		return tuple.item1();
	}

	synchronized void deleteLocalQueue(String queuename){
		Tuple<SQSQueue, OutParameter<Integer>> queue = this.queues.get(queuename);
		if(queue == null){
			return;
		}
		
		OutParameter<Integer> cnt = queue.item2();
		cnt.value--;
		if(cnt.value <= 0){
			Tuple<SQSQueue, OutParameter<Integer>> tuple = this.queues.remove(queuename);
			tuple.item1().clearHandlers();
		}
	}

	private Tuple<SQSQueue, OutParameter<Integer>>[] getTuples(){
		Collection<Tuple<SQSQueue, OutParameter<Integer>>> collec = this.queues.values();
		Tuple<SQSQueue, OutParameter<Integer>>[] tuples = new Tuple[collec.size()];
		collec.toArray(tuples);
		
		return tuples;
	}
	

	@Override
	public void shutdown() {
		try{
			if(executor != null){
				executor.close();
			}
		}catch(Exception e){
			
		}
		
		for(Tuple<SQSQueue, OutParameter<Integer>> tuple : getTuples()){
			tuple.item1().close();
		}
		
		this.queues.clear();
	}

	@Override
	public void setPropertiesPath(String proppath) {
		build(proppath);
	}

}
