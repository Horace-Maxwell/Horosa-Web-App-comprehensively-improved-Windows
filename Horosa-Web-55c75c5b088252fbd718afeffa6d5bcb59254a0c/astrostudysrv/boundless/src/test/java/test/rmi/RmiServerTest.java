package test.rmi;

import java.rmi.Naming;
import java.rmi.registry.LocateRegistry;
import java.util.Date;

import boundless.utility.ConvertUtility;
import boundless.utility.FormatUtility;

public class RmiServerTest {

	public static void main(String[] args) {
		try {
			PersonService personService=new PersonServiceImpl();
			PersonService1 personService1=new PersonServiceImpl1();
			PersonService2 personService2=new PersonServiceImpl2();
			
			String host = "127.0.0.1";
			int port = 2099;
			
			//注册通讯端口
			LocateRegistry.createRegistry(port);
			//注册通讯路径
			System.out.println("beginning rebind PersonService: " + FormatUtility.formatDateTime(new Date(), "yyyy-MM-dd HH:mm:ss.S"));
			Naming.rebind("rmi://" + host + ":" + port + "/PersonService", personService);
			System.out.println("finish rebind PersonService: " + FormatUtility.formatDateTime(new Date(), "yyyy-MM-dd HH:mm:ss.S"));
			
			System.out.println("\nbeginning rebind PersonService1: " + FormatUtility.formatDateTime(new Date(), "yyyy-MM-dd HH:mm:ss.S"));
			Naming.rebind("rmi://" + host + ":" + port + "/PersonService1", personService1);
			System.out.println("finish rebind PersonService1: " + FormatUtility.formatDateTime(new Date(), "yyyy-MM-dd HH:mm:ss.S"));
			
			System.out.println("\nbeginning rebind PersonService2 " + FormatUtility.formatDateTime(new Date(), "yyyy-MM-dd HH:mm:ss.S"));
			Naming.rebind("rmi://" + host + ":" + port + "/PersonService2", personService2);
			System.out.println("finish rebind PersonService2: " + FormatUtility.formatDateTime(new Date(), "yyyy-MM-dd HH:mm:ss.S"));

			System.out.println("\nService Start!");
		} catch (Exception e) {
			e.printStackTrace();
		}	
	}

}
