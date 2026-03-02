package boundless.utility;

/**
 * 各地图API坐标系统比较与转换;
 * WGS84坐标系：即地球坐标系，国际上通用的坐标系。设备一般包含GPS芯片或者北斗芯片获取的经纬度为WGS84地理坐标系,
 * 谷歌地图采用的是WGS84地理坐标系（中国范围除外）;
 * GCJ02坐标系：即火星坐标系，是由中国国家测绘局制订的地理信息系统的坐标系统。由WGS84坐标系经加密后的坐标系。
 * 谷歌中国地图和搜搜中国地图采用的是GCJ02地理坐标系; BD09坐标系：即百度坐标系，GCJ02坐标系经加密后的坐标系;
 * 搜狗坐标系、图吧坐标系等，估计也是在GCJ02基础上加密而成的。 chenhua
 */
public class PositionUtility {
    
    public static final String BAIDU_LBS_TYPE = "bd09ll";
    
    public static double pi = 3.1415926535897932384626;
    public static double a = 6378245.0;
    public static double ee = 0.00669342162296594323;

    /**
     * 84 to 火星坐标系 (GCJ-02) World Geodetic System ==> Mars Geodetic System
     * 
     * @param lat
     * @param lon
     * @return
     */
    public static Gps gps84_To_Gcj02(double lat, double lon) {
//        if (outOfChina(lat, lon)) {
//            return new Gps(lat, lon);
//        }
        double dLat = transformLat(lon - 105.0, lat - 35.0);
        double dLon = transformLon(lon - 105.0, lat - 35.0);
        double radLat = lat / 180.0 * pi;
        double magic = Math.sin(radLat);
        magic = 1 - ee * magic * magic;
        double sqrtMagic = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * pi);
        dLon = (dLon * 180.0) / (a / sqrtMagic * Math.cos(radLat) * pi);
        double mgLat = lat + dLat;
        double mgLon = lon + dLon;
        return new Gps(mgLat, mgLon);
    }

    /**
     * * 火星坐标系 (GCJ-02) to 84 高德地图转gps
     * 
     *  @param lon 
     *  @param lat 
     *  @return
     * */
    public static Gps gcj02_To_Gps84(double lat, double lon) {
        Gps gps = transform(lat, lon);
        double lontitude = lon * 2 - gps.getWgLon();
        double latitude = lat * 2 - gps.getWgLat();
        return new Gps(latitude, lontitude);
    }

    /**
     * 火星坐标系 (GCJ-02) 与百度坐标系 (BD-09) 的转换算法 将 GCJ-02 坐标转换成 BD-09 坐标
     * 
     * @param gg_lat
     * @param gg_lon
     */
    public static Gps gcj02_To_Bd09(double gg_lat, double gg_lon) {
        double x = gg_lon, y = gg_lat;
        double z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * pi);
        double theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * pi);
        double bd_lon = z * Math.cos(theta) + 0.0065;
        double bd_lat = z * Math.sin(theta) + 0.006;
        return new Gps(bd_lat, bd_lon);
    }

    /**
     * * 火星坐标系 (GCJ-02) 与百度坐标系 (BD-09) 的转换算法 * * 将 BD-09 坐标转换成GCJ-02 坐标 * * @param
     * bd_lat * @param bd_lon * @return
     */
    public static Gps bd09_To_Gcj02(double bd_lat, double bd_lon) {
        double x = bd_lon - 0.0065, y = bd_lat - 0.006;
        double z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * pi);
        double theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * pi);
        double gg_lon = z * Math.cos(theta);
        double gg_lat = z * Math.sin(theta);
        return new Gps(gg_lat, gg_lon);
    }

    /**
     * (BD-09)-->84
     * @param bd_lat
     * @param bd_lon
     * @return
     */
    public static Gps bd09_To_Gps84(double bd_lat, double bd_lon) {

        Gps gcj02 = PositionUtility.bd09_To_Gcj02(bd_lat, bd_lon);
        Gps map84 = PositionUtility.gcj02_To_Gps84(gcj02.getWgLat(),
                gcj02.getWgLon());
        return map84;

    }
    
    public static boolean outOfChina(double lat, double lon) {
        if (lon < 72.004 || lon > 137.8347)
            return true;
        if (lat < 0.8293 || lat > 55.8271)
            return true;
        return false;
    }

    public static Gps transform(double lat, double lon) {
//        if (outOfChina(lat, lon)) {
//            return new Gps(lat, lon);
//        }
        double dLat = transformLat(lon - 105.0, lat - 35.0);
        double dLon = transformLon(lon - 105.0, lat - 35.0);
        double radLat = lat / 180.0 * pi;
        double magic = Math.sin(radLat);
        magic = 1 - ee * magic * magic;
        double sqrtMagic = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * pi);
        dLon = (dLon * 180.0) / (a / sqrtMagic * Math.cos(radLat) * pi);
        double mgLat = lat + dLat;
        double mgLon = lon + dLon;
        return new Gps(mgLat, mgLon);
    }

    public static double transformLat(double x, double y) {
        double ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y
                + 0.2 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * pi) + 20.0 * Math.sin(2.0 * x * pi)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(y * pi) + 40.0 * Math.sin(y / 3.0 * pi)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(y / 12.0 * pi) + 320 * Math.sin(y * pi / 30.0)) * 2.0 / 3.0;
        return ret;
    }

    public static double transformLon(double x, double y) {
        double ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1
                * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * pi) + 20.0 * Math.sin(2.0 * x * pi)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(x * pi) + 40.0 * Math.sin(x / 3.0 * pi)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(x / 12.0 * pi) + 300.0 * Math.sin(x / 30.0
                * pi)) * 2.0 / 3.0;
        return ret;
    }
    
    public static int[] splitDegree(double degree){
    	int[] res = new int[3];
    	res[0] = ConvertUtility.getValueAsInt(degree);
    	double minute = (Math.abs(degree) - Math.abs(res[0])) * 60;
    	res[1] = ConvertUtility.getValueAsInt(Math.floor(minute));
    	double sec = (minute - res[1]) * 60;
    	res[2] = ConvertUtility.getValueAsInt(Math.round(sec));
    	if(res[2] == 60) {
    		res[1]++;
    		res[2] = 0;
    	}
    	if(res[1] == 60) {
    		res[0]++;
    		res[1] = 0;
    	}
    	
    	if(degree < 0) {
    		int[] tmp = new int[4];
    		tmp[0] = res[0];
    		tmp[1] = res[1];
    		tmp[2] = res[2];
    		tmp[3] = -1;
    		res = tmp;
    	}
    	return res;
    }

    public static String convertLatToStr(double degree){
    	int[] deg = splitDegree(degree);
    	int latdeg = deg[0] >= 0 ? deg[0] : -deg[0];
    	int latmin = deg[1] >= 0 ? deg[1] : -deg[1];
    	String dir = deg[0] >= 0 ? "n" : "s";
    	String latminstr = latmin > 10 ? latmin + "" : "0" + latmin;
    	return latdeg + dir + latmin;
    }

    public static String convertLonToStr(double degree){
    	int[] deg = splitDegree(degree);
    	int londeg = deg[0] >= 0 ? deg[0] : -deg[0];
    	int lonmin = deg[1] >= 0 ? deg[1] : -deg[1];
    	String dir = deg[0] >= 0 ? "e" : "w";
    	String lonminstr = lonmin > 10 ? lonmin + "" : "0" + lonmin;
    	return londeg + dir + lonmin;
    }

    public static double convertLatStrToDegree(String lat){
    	int positive = 1;
    	String latstr = lat.toLowerCase();
    	String[] parts = StringUtility.splitString(latstr, 'n');
    	if(parts.length == 1){
    		parts = StringUtility.splitString(latstr, 's');
    		positive = -1;
    	}
    	String min = parts[1];
    	int minInt;
    	if(parts[1].length() == 2){
    		if(parts[1].substring(0, 1).equals("0")){
    			min = min.substring(1);
    		}
    		minInt = ConvertUtility.getValueAsInt(min);
    	}else{
    		minInt = ConvertUtility.getValueAsInt(min) * 10;
    	}

    	double deg = ConvertUtility.getValueAsDouble(parts[0]);
    	if(minInt != 0){
    		deg = deg + (1.0 / minInt);
    	}
    	return deg * positive;
    }

    public static double convertLonStrToDegree(String lon){
    	int positive = 1;
    	String lonstr = lon.toLowerCase();
    	String[] parts = StringUtility.splitString(lonstr, 'e');
    	if(parts.length == 1){
    		parts = StringUtility.splitString(lonstr, 'w');
    		positive = -1;
    	}

    	String minstr = parts[1];
    	int min;
    	if(parts[1].length() == 2){
    		if(parts[1].substring(0, 1).equals("0")){
    			minstr = minstr.substring(1);
    		}
    		min = ConvertUtility.getValueAsInt(minstr);
    	}else{
    		min = ConvertUtility.getValueAsInt(minstr) * 10;
    	}

    	double deg = ConvertUtility.getValueAsInt(parts[0]);
    	if(min != 0){
    		deg = deg + (1.0 / min);
    	}
    	return deg * positive;
    }

    
    public static class Gps {
    	private double lat;
    	private double lng;
    	
    	public Gps(double lat, double lng){
    		this.lat = lat;
    		this.lng = lng;
    	}
    	
    	public double getWgLat(){
    		return lat;
    	}
    	
    	public double getWgLon(){
    		return lng;
    	}
    	
    	public double getLat(){
    		return lat;
    	}
    	
    	public double getLng(){
    		return lng;
    	}
    	
    	public String toString(){
    		StringBuilder sb = new StringBuilder();
    		sb.append("latitude:").append(lat).append("; longitude:").append(lng);
    		return sb.toString();
    	}
    }

    public static void main(String[] args) {

        // 北斗芯片获取的经纬度为WGS84地理坐标 31.426896,119.496145
        Gps gps = new Gps(31.426896, 119.496145);
        System.out.println("gps :" + gps);
        Gps gcj = gps84_To_Gcj02(gps.getWgLat(), gps.getWgLon());
        System.out.println("gcj :" + gcj);
        Gps star = gcj02_To_Gps84(gcj.getWgLat(), gcj.getWgLon());
        System.out.println("star:" + star);
        Gps bd = gcj02_To_Bd09(gcj.getWgLat(), gcj.getWgLon());
        System.out.println("bd  :" + bd);
        Gps gcj2 = bd09_To_Gcj02(bd.getWgLat(), bd.getWgLon());
        System.out.println("gcj :" + gcj2);
    }
}