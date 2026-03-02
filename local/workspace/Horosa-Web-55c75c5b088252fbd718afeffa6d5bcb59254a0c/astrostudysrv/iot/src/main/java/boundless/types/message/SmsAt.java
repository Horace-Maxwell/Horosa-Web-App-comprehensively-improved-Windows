package boundless.types.message;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.rxtx.SerialUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.ByteUtility;
import boundless.utility.StringUtility;
import gnu.io.SerialPort;
import gnu.io.SerialPortEvent;
import gnu.io.SerialPortEventListener;

public class SmsAt extends Messager {
	private static Logger log = AppLoggers.getLog("debug", "atsms");
	private static Logger errLogger = AppLoggers.getLog("error", "atsms");
	
	private static boolean needCenterNo = PropertyPlaceholder.getPropertyAsBool("sms.needcenterno", false);

	
	private static String treatCenterNo(String centerno) {
		String ceno = centerno;
		if(ceno.startsWith("+")) {
			ceno = ceno.substring(1);
		}
		if(ceno.length() % 2 == 1) {
			ceno = ceno + "F";
		}
		StringBuilder sb = new StringBuilder("91");
		char[] chars = ceno.toCharArray();
		for(int i=0; i<chars.length; i+=2) {
			char c0 = chars[i];
			char c1 = chars[i+1];
			sb.append(c1).append(c0);
		}
		
		byte sz = (byte) (sb.length() / 2);
		String hex = ByteUtility.toHexString(new byte[]{sz});
		
		return hex + sb.toString();
	}
	
	private static String treatTel(String tel) {
		String ceno = tel;
		if(ceno.startsWith("+")) {
			ceno = ceno.substring(1);
		}
		if(!ceno.startsWith("86")) {
			ceno = "86" + tel;
		}
		int sz = ceno.length();
		String szhex = ByteUtility.toHexString(new byte[]{(byte)sz});
		if(sz % 2 == 1) {
			ceno = ceno + "F";
		}
		StringBuilder sb = new StringBuilder(String.format("1100%s91", szhex));
		char[] chars = ceno.toCharArray();
		for(int i=0; i<chars.length; i+=2) {
			char c0 = chars[i];
			char c1 = chars[i+1];
			sb.append(c1).append(c0);
		}
		return sb.toString() + "000800";
	}
	
	private static String treatMsg(String msg) {
		String unicode = StringUtility.toUnicodeStr(msg, false);
		byte sz = (byte) (unicode.length() / 2);
		String hex = ByteUtility.toHexString(new byte[]{sz});
		return hex + unicode;
	}
	
	private static String finalMsg(String msg, String tel) {
		String phone = treatTel(tel);
		String txt = treatMsg(msg);
		String res = String.format("%s%s", phone, txt);
		return res;
	}
	
	private static void sendAtMsgByTxtMode(SerialPort serialPort, String data, String centerno, String tel) throws Exception{
		byte[] b = new byte[128];
		String charset = "UTF-8";
		byte[] cmdend = new byte[] {(byte)0x0D};
		byte[] smsend = new byte[] {(byte)0x1A};
		try {
			ByteArrayOutputStream out = new ByteArrayOutputStream();		
			out.write("AT".getBytes(charset));
			out.write(cmdend);
			out.flush();
			byte[] raw = out.toByteArray();
			SerialUtility.sendData(serialPort, raw);
			
			out = new ByteArrayOutputStream();	
			out.write("AT+CMGF=1".getBytes(charset));
			out.write(cmdend);
			out.flush();
			raw = out.toByteArray();
			SerialUtility.sendData(serialPort, raw);
			
			out = new ByteArrayOutputStream();	
			String cmd = String.format("AT+CMGS=\"%s\"", tel);
			out.write(cmd.getBytes(charset));
			out.write(cmdend);
			out.flush();
			raw = out.toByteArray();
			SerialUtility.sendData(serialPort, raw);
			
			String sms = data;
			out = new ByteArrayOutputStream();	
			out.write(sms.getBytes(charset));
			out.write(smsend);
			out.flush();
			raw = out.toByteArray();
			SerialUtility.sendData(serialPort, raw);
			
		}catch(Exception e) {
			throw e;
		}
		
	}
	
	private static void sendAtMsg(SerialPort serialPort, String data, String centerno, String tel) throws Exception {
		String centerAddr = treatCenterNo(centerno);
		String msg = finalMsg(data, tel);
		int sz = msg.length() / 2;
		byte[] b = new byte[128];
		String charset = "UTF-8";
		byte[] cmdend = new byte[] {(byte)0x0D};
		byte[] smsend = new byte[] {(byte)0x1A};
		try {
			ByteArrayOutputStream out = new ByteArrayOutputStream();		
			out.write("AT".getBytes(charset));
			out.write(cmdend);
			out.flush();
			byte[] raw = out.toByteArray();
			SerialUtility.sendData(serialPort, raw);
			
			out = new ByteArrayOutputStream();	
			out.write("AT+CMGF=0".getBytes(charset));
			out.write(cmdend);
			out.flush();
			raw = out.toByteArray();
			SerialUtility.sendData(serialPort, raw);
			QueueLog.debug(log, "AT+CMGF=0");
			
			out = new ByteArrayOutputStream();	
			String cmd = String.format("AT+CMGS=%d", sz);
			out.write(cmd.getBytes(charset));
			out.write(cmdend);
			out.flush();
			raw = out.toByteArray();
			SerialUtility.sendData(serialPort, raw);
			QueueLog.debug(log, cmd);
			
			String sms = msg;
			if(needCenterNo) {
				sms = centerAddr + msg; // 短信中心编码附在开头，也可以不需要短信中心的编码
			}
			out = new ByteArrayOutputStream();	
			out.write(sms.getBytes(charset));
			out.write(smsend);
			out.flush();
			raw = out.toByteArray();
			SerialUtility.sendData(serialPort, raw);
			QueueLog.debug(log, sms);
			
		}catch(Exception e) {
			throw e;
		}
	}
	
	private static SerialPort getSerialPort(String portname) throws Exception {
		final SerialPort serialPort = SerialUtility.openSerialPort(portname, 9600);
//		SerialUtility.setListenerToSerialPort(serialPort, new SerialPortEventListener() {
//			@Override
//			public void serialEvent(SerialPortEvent event) {
//				try {
//					Thread.sleep(25);
//				} catch (InterruptedException e) {
//					e.printStackTrace();
//				}
//				if(event.getEventType() == SerialPortEvent.DATA_AVAILABLE) {
//					byte[] raw = SerialUtility.readData(serialPort);
//					try {
//						System.out.println(String.format("size:%d, msg:%s", raw.length, new String(raw, "UTF-8")));												
//					}catch(Exception e) {
//					}
//				}
//				
//			}
//		});

		return serialPort;
	}
	
	private synchronized static void sendSms(String portname, String msg, String centerno, String tel) throws Exception{
		final SerialPort serialPort = getSerialPort(portname);		
		try {			
			sendAtMsg(serialPort, msg, centerno, tel);
		} finally {
			serialPort.close();
		}
		
	}
	
	private synchronized static void sendSmsByTxtMode(String portname, String msg, String centerno, String tel) throws Exception{
		final SerialPort serialPort = getSerialPort(portname);		
		try {			
			String[] msglist = splitMsg(msg);
			for(String str : msglist) {
				sendAtMsgByTxtMode(serialPort, str, centerno, tel);
			}			
		} finally {
			serialPort.close();
		}
		
	}
	
	private static String[] splitMsg(String msg) {
		List<String> list = new ArrayList<String>();
		int block = 60;
		int sz = msg.length();
		for(int i=0; i<sz; i+=block) {
			int left = sz - i;
			if(left <= block) {
				list.add(msg.substring(i));
			}else {
				list.add(msg.substring(i, i+block));
			}
		}
		String[] res = new String[list.size()];
		list.toArray(res);
		return res;
	}
	
	public String portName; // 电脑上的端口名称, 比如像/dev/ttyUSB2之类的
	public String centerNo; // 短信中心号码

	public SmsAt() {
		super();
	}

	public SmsAt clone() {
		SmsAt sms = new SmsAt();
		sms.host = this.host;
		sms.port = this.port;
		sms.username = this.username;
		sms.password = this.password;
		sms.signature = this.signature;
		sms.dest = this.dest;
		
		sms.portName = this.portName;
		sms.centerNo = this.centerNo;
		

		return sms;
	}
	
	@Override
	protected void doSend(String msg) throws Exception {
		if(StringUtility.isNullOrEmpty(this.dest) || StringUtility.isNullOrEmpty(this.centerNo)) {
			throw new Exception("miss.telno.or.centerno");
		}
		if(StringUtility.isNullOrEmpty(this.portName)) {
			throw new Exception("miss.portname");
		}
		
		sendSms(this.portName, msg, this.centerNo, this.dest);
	}

	@Override
	protected void doSend(String title, String msg) throws Exception {
		send(msg);
	}

	@Override
	public void send(String msg) {
		try {
			String[] msglist = splitMsg(msg);
			for(String str : msglist) {
				doSend(str);
				Thread.sleep(1000);
			}			
		} catch (Exception e) {
			QueueLog.error(errLogger, e);
		}
		reset();
	}
	
	public void sendSmsByTxtMode(String msg) {
		if(StringUtility.isNullOrEmpty(this.dest) || StringUtility.isNullOrEmpty(this.centerNo)) {
			throw new RuntimeException("miss.telno.or.centerno");
		}
		if(StringUtility.isNullOrEmpty(this.portName)) {
			throw new RuntimeException("miss.portname");
		}
		try {
			sendSmsByTxtMode(this.portName, msg, this.centerNo, this.dest);			
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
		
	}

	public static String[] listAllSerialPorts() {
		String[] list = SerialUtility.getPortList();

		return list;
	}
	
	public static void main(String[] args) {
		SmsAt sms = new SmsAt();
		sms.dest = "13328682559";
//		sms.dest = "13301097150";
		sms.centerNo = "8613800591500";
		sms.portName = "/dev/ttyUSB2";
		
		String msg = "尊敬的客户，您好！万楼云通知您，您提交的申请资料因{0}原因未审核通过，请重新填写提交申请。如有疑问请联系客服。电话:400-0039-395。。";
//		msg = "尊敬的客户，您好！{0}工作愉快Hello";
//		msg = "中英文混合abcdefg";
		
		System.out.println(treatCenterNo(sms.centerNo));
		System.out.println(treatTel(sms.dest));
		System.out.println(treatMsg(msg));
		String finalmsg = finalMsg(msg, sms.dest);
		int sz = finalmsg.length() / 2;
		System.out.println("AT+CMGF=0");
		System.out.println(String.format("AT+CMGS=%d", sz));
		System.out.println(finalmsg);

		sms.send(msg);		
//		msg = "hello sms test";
//		sms.sendSmsByTxtMode(msg);
		
		System.out.println("finish sending");
	}

}
