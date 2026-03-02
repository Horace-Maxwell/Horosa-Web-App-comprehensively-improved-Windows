package name.prokop.bart.rxtx;

import gnu.io.CommPort;
import gnu.io.CommPortIdentifier;
import gnu.io.NoSuchPortException;
import gnu.io.PortInUseException;
import gnu.io.SerialPort;
import java.io.IOException;
import java.util.Enumeration;

public class Demo1 {

    public static void main(String... args) {
        System.out.println(System.getProperty("java.io.tmpdir"));
        System.out.println(System.getProperty("sun.arch.data.model"));

        System.out.println(System.getProperty("os.arch"));
        System.out.println(System.getProperty("os.name"));
        System.out.println(System.getProperty("os.version"));

        String[] portList = getPortList();
        System.out.print(portList.length);
        System.out.print(" port(ow):");
        for (int i = 0; i < portList.length; i++) {
            System.out.print(portList[i] + " ");
        }
        System.out.println();

        System.out.println("*************************************************");

        portList = getSerialPortList();
        System.out.print(portList.length);
        System.out.println(" port(ow) szeregowych:");
        for (int i = 0; i < portList.length; i++) {
            System.out.print(portList[i] + " otwieram ");
            try {
                CommPort p = getSerialPort(portList[i]);
                p.close();
                System.out.print("OK");
            } catch (IOException e) {
                System.out.print("nie udało się: " + e.getMessage());
            }
            System.out.println();
        }
        System.out.println();

        portList = getParallelPortList();
        System.out.print(portList.length);
        System.out.println(" port(ow) rownoleglych:");
        for (int i = 0; i < portList.length; i++) {
            System.out.print(" " + portList[i]);
        }
        System.out.println();
    }

    public static String[] getPortList() {
        Enumeration portList = CommPortIdentifier.getPortIdentifiers();

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

    /**
     * Zwraca liste portow szeregowych
     *
     * @return Zwraca liste portow szeregowych. Zwracana jest tablica string�w.
     * Stringi te mo�na u�y� w funkcji getSerialPort
     */
    public static String[] getSerialPortList() {
        Enumeration portList;
        portList = CommPortIdentifier.getPortIdentifiers();

        int serialPortCount = 0;
        while (portList.hasMoreElements()) {
            CommPortIdentifier portId = (CommPortIdentifier) portList.nextElement();
            if (portId.getPortType() == CommPortIdentifier.PORT_SERIAL) {
                serialPortCount++;
            }
        }

        String[] retVal = new String[serialPortCount];

        serialPortCount = 0;
        portList = CommPortIdentifier.getPortIdentifiers();
        while (portList.hasMoreElements()) {
            CommPortIdentifier portId = (CommPortIdentifier) portList.nextElement();
            if (portId.getPortType() == CommPortIdentifier.PORT_SERIAL) {
                retVal[serialPortCount++] = portId.getName();
            }
        }

        return retVal;
    }

    /**
     * Zwraca liste portow rownoleglych
     *
     * @return Zwraca liste portow rownoleglych
     */
    public static String[] getParallelPortList() {
        Enumeration portList;
        portList = CommPortIdentifier.getPortIdentifiers();

        int serialPortCount = 0;
        while (portList.hasMoreElements()) {
            CommPortIdentifier portId = (CommPortIdentifier) portList.nextElement();
            if (portId.getPortType() == CommPortIdentifier.PORT_PARALLEL) {
                serialPortCount++;
            }
        }

        String[] retVal = new String[serialPortCount];

        serialPortCount = 0;
        portList = CommPortIdentifier.getPortIdentifiers();
        while (portList.hasMoreElements()) {
            CommPortIdentifier portId = (CommPortIdentifier) portList.nextElement();
            if (portId.getPortType() == CommPortIdentifier.PORT_PARALLEL) {
                retVal[serialPortCount++] = portId.getName();
            }
        }

        return retVal;
    }

    /**
     * Zwraca <b>otwarty</b> port szeregowy o zadanej nazwie
     *
     * @return Zwraca port szeregowy o zadanej nazwie
     * @param portName Nazwa portu
     * @throws IOException W przypadku, gdy nie uda�o si� otworzy� portu
     * szeregowego, wraz z opisem.
     */
    public static SerialPort getSerialPort(String portName) throws IOException {
        try {
            CommPortIdentifier portId = CommPortIdentifier.getPortIdentifier(portName);
            //Enumeration portList = CommPortIdentifier.getPortIdentifiers();
            if (portId.getPortType() == CommPortIdentifier.PORT_SERIAL) {
                if (portId.getName().equals(portName)) {
                    return (SerialPort) portId.open("Bart Prokop Comm Helper", 3000);
                }
            }
        } catch (NoSuchPortException e) {
            throw new IOException("NoSuchPortException @ " + portName, e);
        } catch (PortInUseException e) {
            throw new IOException("PortInUseException @ " + portName, e);
        }

        throw new IOException("To nie jest port szeregowy");
    }

}
