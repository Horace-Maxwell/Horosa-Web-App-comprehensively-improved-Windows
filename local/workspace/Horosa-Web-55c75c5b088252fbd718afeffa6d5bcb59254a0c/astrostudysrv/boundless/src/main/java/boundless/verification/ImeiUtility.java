package boundless.verification;

public class ImeiUtility {

    private static String regImei = "^[0-9a-fA-F\\/\\-]+$";
    private static String regImeiForIOS = "^[0-9a-zA-Z\\/\\+\\=\\-]+$";

    /// 不是十分严谨 慎用 
    /// 国际移动设备识别码（International Mobile Equipment Identity，IMEI），即通常所说的手机序列号、手机“串号”，用于在移动电话网络中识别每一部独立的手机等行动通讯装置，相当于移动电话的身份证。序列号共有15位数字，前6位（TAC）是型号核准号码，代表手机类型。接着2位（FAC）是最后装配号，代表产地。后6位（SNR）是串号，代表生产顺序号。最后1位（SP）一般为0，是检验码，备用。国际移动设备识别码一般贴于机身背面与外包装上，同时也存在于手机内存中，通过输入*#06#即可查询。
    /// 参考文献 http://blog.csdn.net/fengyifei11228/article/details/45919797
    /// IMEI合法验证（区分平台）
    public static boolean IsIMEI(String imei, int platform)
    {
        if (imei.isEmpty() || imei.length() >= 18 || imei.length() < 5 )
        {
            return false;
        }
        switch (platform)
        {
            case 1:
            case 7:
                if (imei.startsWith("01") || imei.startsWith("02"))
                {
                    return  imei.matches(regImeiForIOS);
                }
                return imei.matches(regImei);
            default:
                return imei.matches(regImei);
        }
    }

}
