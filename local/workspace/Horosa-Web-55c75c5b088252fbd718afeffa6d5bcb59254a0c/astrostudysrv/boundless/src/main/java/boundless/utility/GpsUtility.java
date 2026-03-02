package boundless.utility;

import java.awt.geom.Point2D;

import org.gavaghan.geodesy.Ellipsoid;
import org.gavaghan.geodesy.GeodeticCalculator;
import org.gavaghan.geodesy.GeodeticCurve;
import org.gavaghan.geodesy.GlobalCoordinates;

public class GpsUtility {
	
	/**
     * 地球半径,单位 m
     */
    private static final double EARTH_RADIUS = 6371393;
	
	 public static double getDistanceMeter(GlobalCoordinates gpsFrom, GlobalCoordinates gpsTo, Ellipsoid ellipsoid){

	        //创建GeodeticCalculator，调用计算方法，传入坐标系、经纬度用于计算距离
	        GeodeticCurve geoCurve = new GeodeticCalculator().calculateGeodeticCurve(ellipsoid, gpsFrom, gpsTo);

	        return geoCurve.getEllipsoidalDistance();
	    }
	 
	 /**
	     * 根据经纬度，计算两点间的距离
	     *
	     * @param longitude1 第一个点的经度
	     * @param latitude1  第一个点的纬度
	     * @param longitude2 第二个点的经度
	     * @param latitude2  第二个点的纬度
	     * @return 返回距离 单位千米
	     */
	    public static double getDistance(double longitude1, double latitude1, double longitude2, double latitude2) {
	        // 纬度
	        double lat1 = Math.toRadians(latitude1);
	        double lat2 = Math.toRadians(latitude2);
	        // 经度
	        double lng1 = Math.toRadians(longitude1);
	        double lng2 = Math.toRadians(longitude2);
	        // 纬度之差
	        double a = lat1 - lat2;
	        // 经度之差
	        double b = lng1 - lng2;
	        // 计算两点距离的公式
	        double s = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin(a / 2), 2) +
	                Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(b / 2), 2)));
	        // 弧长乘地球半径, 返回单位: 米
	        s =  s * EARTH_RADIUS;
	        return s;
	    }
	    /**
		 * 通过AB点经纬度获取距离
		 * 
		 * @param pointA A点(经，纬)
		 * @param pointB B点(经，纬)
		 * @return 距离(单位：米)
		 */
		public static double getDistance(Point2D pointA, Point2D pointB) {
			// 经纬度（角度）转弧度。弧度用作参数，以调用Math.cos和Math.sin
			double radiansAX = Math.toRadians(pointA.getX()); // A经弧度
			double radiansAY = Math.toRadians(pointA.getY()); // A纬弧度
			double radiansBX = Math.toRadians(pointB.getX()); // B经弧度
			double radiansBY = Math.toRadians(pointB.getY()); // B纬弧度
	 
			// cosβ1cosβ2cos（α1-α2）+sinβ1sinβ2
			double cos = Math.cos(radiansAY) * Math.cos(radiansBY) * Math.cos(radiansAX - radiansBX)
					+ Math.sin(radiansAY) * Math.sin(radiansBY);
			double acos = Math.acos(cos); // 反余弦值
			return EARTH_RADIUS * acos; // 最终结果
		}

}
