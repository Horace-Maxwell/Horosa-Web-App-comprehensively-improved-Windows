package boundless.net.modbus;

import java.net.InetAddress;

import com.intelligt.modbus.jlibmodbus.Modbus;
import com.intelligt.modbus.jlibmodbus.master.ModbusMaster;
import com.intelligt.modbus.jlibmodbus.master.ModbusMasterFactory;
import com.intelligt.modbus.jlibmodbus.tcp.TcpParameters;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.StringUtility;

public class ModbusCollector {
	private ModbusMaster master;

	public ModbusCollector(String ip, int port){
		try{
			TcpParameters tcpParameters = new TcpParameters();
			if(StringUtility.isNullOrEmpty(ip)){
		        tcpParameters.setHost(InetAddress.getLocalHost());
			}else{
				tcpParameters.setHost(InetAddress.getByName(ip));
			}
	        tcpParameters.setKeepAlive(true);
	        tcpParameters.setPort(port);
	        
	        master = ModbusMasterFactory.createModbusMasterTCP(tcpParameters);
            Modbus.setAutoIncrementTransactionId(true);
		}catch(Exception e){
			throw new RuntimeException(e);
		}

	}
	
	public void shutdown(){
		try{
			master.disconnect();
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}
	
	public boolean[] readCoils(int serverAddress, int startAddress, int quantity){
		try{
            if (!master.isConnected()) {
            	master.connect();
            }
			return master.readCoils(serverAddress, startAddress, quantity);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public boolean[] readDiscreteInputs(int serverAddress, int startAddress, int quantity){
		try{
            if (!master.isConnected()) {
            	master.connect();
            }
			return master.readDiscreteInputs(serverAddress, startAddress, quantity);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public int[] readHoldingRegisters(int serverAddress, int startAddress, int quantity){
		try{
            if (!master.isConnected()) {
            	master.connect();
            }
			return master.readHoldingRegisters(serverAddress, startAddress, quantity);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public int[] readInputRegisters(int serverAddress, int startAddress, int quantity){
		try{
            if (!master.isConnected()) {
            	master.connect();
            }
			return master.readInputRegisters(serverAddress, startAddress, quantity);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public int readExceptionStatus(int serverAddress){
		try{
            if (!master.isConnected()) {
            	master.connect();
            }
			return master.readExceptionStatus(serverAddress);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
}
