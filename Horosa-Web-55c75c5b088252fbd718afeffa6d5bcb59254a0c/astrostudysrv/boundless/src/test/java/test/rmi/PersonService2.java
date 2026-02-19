package test.rmi;

import java.rmi.Remote;
import java.rmi.RemoteException;
import java.util.List;

public interface PersonService2 extends Remote {
	public List<PersonEntity> getList() throws RemoteException;
}
