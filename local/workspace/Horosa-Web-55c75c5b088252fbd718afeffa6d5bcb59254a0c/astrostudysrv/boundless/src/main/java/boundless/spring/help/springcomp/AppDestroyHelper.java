package boundless.spring.help.springcomp;

import java.sql.Driver;
import java.sql.DriverManager;
import java.util.Enumeration;

import org.springframework.context.ApplicationListener;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.stereotype.Component;

import com.mysql.cj.jdbc.AbandonedConnectionCleanupThread;

import boundless.log.QueueLog;
import boundless.net.client.TcpClient;
import boundless.netty.ClientPoolFactory;
import boundless.netty.NettyUDPBroadcaster;
import boundless.netty.NettyUDPServer;
import boundless.netty.TcpSender;
import boundless.netty.UDPClient;
import boundless.spring.brave.BraveHelper;
import boundless.types.cache.CacheFactory;
import boundless.types.mq.MsgQueueFactory;
import boundless.types.period.CronTask;
import boundless.types.wsclient.WSFactory;
import boundless.utility.CalculatePool;
import boundless.utility.HystrixUtility;
import boundless.utility.PeriodTask;
import boundless.utility.ProcessUtility;
import boundless.utility.SerialCalculatePool;
import rx.schedulers.Schedulers;


@Component
public class AppDestroyHelper implements ApplicationListener<ContextClosedEvent>{

	public static void shutdownAll(){
		try{
			PeriodTask.shutdown();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			CronTask.shutdown();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			HystrixUtility.shutdown();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			CalculatePool.shutdown();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			SerialCalculatePool.shutdown();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			ProcessUtility.shutdown();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			CacheFactory.close();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			MsgQueueFactory.close();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			UDPClient.shutdown();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			TcpSender.shutdown();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			TcpClient.shutdown();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			ClientPoolFactory.clear();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			NettyUDPServer.shutdown();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			NettyUDPBroadcaster.shutdown();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			WSFactory.close();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			QueueLog.shutdown();
		}catch(Exception e){ e.printStackTrace(); }
		
		closeThirdPartyLib();
	}

	private static void closeJDBC(){
		try {
			AbandonedConnectionCleanupThread.checkedShutdown();
		} catch (Exception e) {
			e.printStackTrace();
		}
		
		Enumeration drivers = DriverManager.getDrivers();
		while (drivers.hasMoreElements()) {
			Driver driver = (Driver)drivers.nextElement();
			try {
				DriverManager.deregisterDriver(driver);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}		
	}
	
	private static void closeThirdPartyLib(){
		try{
			Schedulers.shutdown();
		}catch(Exception e){ e.printStackTrace(); }
		try{
			BraveHelper.shutdown();
		}catch(Exception e){ e.printStackTrace(); }

		try{
			closeJDBC();
		}catch(Exception e){ e.printStackTrace(); }
		
	}

	@Override
	public void onApplicationEvent(ContextClosedEvent event) {
		shutdownAll();
	}

}
