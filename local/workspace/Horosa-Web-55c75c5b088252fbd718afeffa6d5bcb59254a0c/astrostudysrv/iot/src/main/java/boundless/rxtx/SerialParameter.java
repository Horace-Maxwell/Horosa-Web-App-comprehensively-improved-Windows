package boundless.rxtx;
import gnu.io.SerialPort;

public final class SerialParameter {
    // 串口名称
    private String serialPortName;
    // 波特率
    private int baudRate;
    // 数据位 默认8位
    private int dataBits;
    // 停止位
    private int stopBits;
    // 校验位
    private int parity;

    public SerialParameter(String serialPortName){
        this.serialPortName = serialPortName;
        this.baudRate = 9600;
        this.dataBits = SerialPort.DATABITS_8;
        this.stopBits = SerialPort.STOPBITS_1;
        this.parity = SerialPort.PARITY_NONE;
    }
    public SerialParameter(String serialPortName, int baudRate){
        this.serialPortName = serialPortName;
        this.baudRate = baudRate;
        this.dataBits = SerialPort.DATABITS_8;
        this.stopBits = SerialPort.STOPBITS_1;
        this.parity = SerialPort.PARITY_NONE;
    }

    public String getSerialPortName() {
        return serialPortName;
    }

    public void setSerialPortName(String serialPortName) {
        this.serialPortName = serialPortName;
    }

    public int getBaudRate() {
        return baudRate;
    }

    public void setBaudRate(int baudRate) {
        this.baudRate = baudRate;
    }

    public int getDataBits() {
        return dataBits;
    }

    public void setDataBits(int dataBits) {
        this.dataBits = dataBits;
    }

    public int getStopBits() {
        return stopBits;
    }

    public void setStopBits(int stopBits) {
        this.stopBits = stopBits;
    }

    public int getParity() {
        return parity;
    }

    public void setParity(int parity) {
        this.parity = parity;
    }
}