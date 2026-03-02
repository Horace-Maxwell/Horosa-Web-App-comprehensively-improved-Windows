package test.rmi;

import java.rmi.Naming;
import java.util.Date;
import java.util.List;

import boundless.utility.FormatUtility;

public class RmiClientTest {

	public static void main(String[] args) {
		try{
			String host = "127.0.0.1";
			int port = 2099;
			
			//调用远程对象，注意RMI路径与接口必须与服务器配置一致
			System.out.println("beginning lookup PersonService: " + FormatUtility.formatDateTime(new Date(), "yyyy-MM-dd HH:mm:ss.S"));
			PersonService personService=(PersonService)Naming.lookup("rmi://" + host + ":" + port + "/PersonService");
			System.out.println("finish lookup PersonService: " + FormatUtility.formatDateTime(new Date(), "yyyy-MM-dd HH:mm:ss.S") + "\n");

			List<PersonEntity> personList=personService.getList();
			for(PersonEntity person:personList){
				System.out.println("ID:"+person.getId()+" Age:"+person.getAge()+" Name:"+person.getName());
			}
		}catch(Exception ex){
			ex.printStackTrace();
		}
	}

}
