package boundless.rxtx;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.TooManyListenersException;

import gnu.io.CommPort;
import gnu.io.CommPortIdentifier;
import gnu.io.NoSuchPortException;
import gnu.io.PortInUseException;
import gnu.io.SerialPort;
import gnu.io.SerialPortEventListener;
import gnu.io.UnsupportedCommOperationException;

public class SerialUtility {
    @SuppressWarnings("unchecked")
    public static List<String> getSerialPortList() {
        List<String> systemPorts = new ArrayList<>();
        //获得系统可用的端口
        Enumeration<CommPortIdentifier> portList = CommPortIdentifier.getPortIdentifiers();
        while (portList.hasMoreElements()) {
            String portName = portList.nextElement().getName();//获得端口的名字
            systemPorts.add(portName);
        }
        return systemPorts;
    }

    // 打开串口  *** 一系列情况，不断重写传递参数 ***
    public static SerialPort openSerialPort(String serialPortName)
            throws NoSuchPortException, PortInUseException, UnsupportedCommOperationException {
        SerialParameter parameter = new SerialParameter(serialPortName);
        return openSerialPort(parameter);
    }

    public static SerialPort openSerialPort(String serialPortName, int baudRate)
            throws NoSuchPortException, PortInUseException, UnsupportedCommOperationException {
        SerialParameter parameter = new SerialParameter(serialPortName, baudRate);
        return openSerialPort(parameter);
    }

    public static SerialPort openSerialPort(String serialPortName, int baudRate, int timeout)
            throws NoSuchPortException, PortInUseException, UnsupportedCommOperationException {
        SerialParameter parameter = new SerialParameter(serialPortName, baudRate);
        return openSerialPort(parameter, timeout);
    }

    public static SerialPort openSerialPort(SerialParameter parameter)
            throws NoSuchPortException, PortInUseException, UnsupportedCommOperationException {
        return openSerialPort(parameter, 2000);
    }

    public static SerialPort openSerialPort(SerialParameter parameter, int timeout)
            throws NoSuchPortException, PortInUseException, UnsupportedCommOperationException {
        //通过端口名称得到端口
        CommPortIdentifier portIdentifier = CommPortIdentifier.getPortIdentifier(parameter.getSerialPortName());
        //打开端口，（自定义名字，打开超时时间）
        CommPort commPort = portIdentifier.open(parameter.getSerialPortName(), timeout);
        //判断是不是串口
        if (commPort instanceof SerialPort) {
            SerialPort serialPort = (SerialPort) commPort;
            //设置串口参数（波特率，数据位8，停止位1，校验位无）
            serialPort.setSerialPortParams(parameter.getBaudRate(), parameter.getDataBits(), parameter.getStopBits(), parameter.getParity());
            System.out.println("开启串口成功，串口名称：" + parameter.getSerialPortName());
            return serialPort;
        } else {
            //是其他类型的端口
            throw new NoSuchPortException();
        }
    }
    // *** 最后一个即是最终结果 ***

    // 关闭串口
    public static void closeSerialPort(SerialPort serialPort) {
        if (serialPort != null) {
            serialPort.close();
            System.out.println("关闭了串口：" + serialPort.getName());
        }
    }

    // 向串口发送数据
    public static void sendData(SerialPort serialPort, byte[] data) {
        OutputStream os = null;
        try {
            //获得串口的输出流
            os = serialPort.getOutputStream();
            os.write(data);
            os.flush();
        } catch (IOException e) {
            e.printStackTrace();
        } finally {
            try {
                if (os != null) {
                    os.close();
                }
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }

    // 从串口读取数据
    public static byte[] readData(SerialPort serialPort) {
        InputStream is = null;
        byte[] bytes = null;
        try {
            //获得串口的输入流
            is = serialPort.getInputStream();
            //获得数据长度
            int bufflenth = is.available();
            while (bufflenth != 0) {
                //初始化byte数组
                bytes = new byte[bufflenth];
                is.read(bytes);
                bufflenth = is.available();
            }
        } catch (IOException e) {
            e.printStackTrace();
        } finally {
            try {
                if (is != null) {
                    is.close();
                }
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
        return bytes;
    }

    // 给串口设置监听
    public static void setListenerToSerialPort(SerialPort serialPort, SerialPortEventListener listener) throws TooManyListenersException {
        //给串口添加事件监听
        serialPort.addEventListener(listener);
        //串口有数据监听
        serialPort.notifyOnDataAvailable(true);
        //中断事件监听
        serialPort.notifyOnBreakInterrupt(true);
    }
    
    public static String[] getPortList() {
        Enumeration<CommPortIdentifier> portList = CommPortIdentifier.getPortIdentifiers();

        int portCount = 0;
        while (portList.hasMoreElements()) {
            portList.nextElement();
            portCount++;
        }

        String[] retVal = new String[portCount];

        portCount = 0;
        portList = CommPortIdentifier.getPortIdentifiers();
        while (portList.hasMoreElements()) {
            CommPortIdentifier portId = (CommPortIdentifier) portList.nextElement();
            retVal[portCount++] = portId.getName();
        }

        return retVal;
    }
    
    public static void testFileMode() {
		String charset = "UTF-8";
		byte[] cmdend = new byte[] {(byte)0x0D};
		byte[] smsend = new byte[] {(byte)0x1A};

		RandomAccessFile raf = null;
		String filename = "/dev/ttyUSB2";
		byte[] b;
		try {
	       File file=new File(filename);
	       raf = new RandomAccessFile(file,"rw");
	       
			ByteArrayOutputStream out = new ByteArrayOutputStream();		
			out.write("AT".getBytes(charset));
			out.write(cmdend);
			out.flush();
			byte[] raw = out.toByteArray();
			raf.write(raw);
//			b = SerialUtility.readData(serialPort);
//			System.out.println(new String(b, charset));
			
			out = new ByteArrayOutputStream();	
			out.write("AT+CMGF=1".getBytes(charset));
			out.write(cmdend);
			out.flush();
			raw = out.toByteArray();
			raf.write(raw);
//			b = SerialUtility.readData(serialPort);
//			System.out.println(new String(b, charset));
			
			out = new ByteArrayOutputStream();	
			String cmd = String.format("AT+CMGS=\"%s\"", "13328682559");
			out.write(cmd.getBytes(charset));
			out.write(cmdend);
			out.flush();
			raw = out.toByteArray();
			raf.write(raw);
			
			out = new ByteArrayOutputStream();	
			String msg = "hello sms test";
			out.write(msg.getBytes(charset));
			out.write(cmdend);
			out.flush();
			raw = out.toByteArray();
			raf.write(raw);
			
		}catch(Exception e) {
			
		}finally {
			if(raf != null) {
    			try {
					raf.close();
				} catch (IOException e1) {
					e1.printStackTrace();
				}
			}
		}
    }
    
	public static void testTxtSms(){
		SerialPort serialPort = null;
		String charset = "UTF-8";
		byte[] cmdend = new byte[] {(byte)0x0D};
		byte[] smsend = new byte[] {(byte)0x1A};
		byte[] b;
		try {
			serialPort = SerialUtility.openSerialPort("/ttyUSB2", 9600);
			ByteArrayOutputStream out = new ByteArrayOutputStream();		
			out.write("AT".getBytes(charset));
			out.write(cmdend);
			out.flush();
			byte[] raw = out.toByteArray();
			SerialUtility.sendData(serialPort, raw);
//			b = SerialUtility.readData(serialPort);
//			System.out.println(new String(b, charset));
			
			out = new ByteArrayOutputStream();	
			out.write("AT+CMGF=1".getBytes(charset));
			out.write(cmdend);
			out.flush();
			raw = out.toByteArray();
			SerialUtility.sendData(serialPort, raw);
//			b = SerialUtility.readData(serialPort);
//			System.out.println(new String(b, charset));
			
			out = new ByteArrayOutputStream();	
			String cmd = String.format("AT+CMGS=\"%s\"", "13328682559");
			out.write(cmd.getBytes(charset));
			out.write(cmdend);
			out.flush();
			raw = out.toByteArray();
			SerialUtility.sendData(serialPort, raw);
			
			out = new ByteArrayOutputStream();	
			String msg = "hello sms test";
			out.write(msg.getBytes(charset));
			out.write(cmdend);
			out.flush();
			raw = out.toByteArray();
			SerialUtility.sendData(serialPort, raw);
			
		}catch(Exception e) {
			
		}finally {
			if(serialPort != null) {
				serialPort.close();
			}
		}
	}
	
	public static void main(String[] args) {
		testFileMode();
	}
    
}