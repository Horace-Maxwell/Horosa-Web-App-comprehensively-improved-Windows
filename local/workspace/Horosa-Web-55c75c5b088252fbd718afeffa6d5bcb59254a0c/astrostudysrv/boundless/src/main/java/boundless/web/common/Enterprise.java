package boundless.web.common;

import java.util.Date;
import java.util.Map;

import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

public class Enterprise extends Customer {
	public long createtime;
	public long updatetime;
	public double bdLat;
	public double bdLng;
	public double gdLat;
	public double gdLng;
	public boolean isPub;
	public long userCreating;

	public static Enterprise fromMap(Map<String, Object> map){
		Enterprise customer = new Enterprise();
		customer.seq = ConvertUtility.getValueAsLong(map.get("CustomerSeq"));
		customer.id = (String) map.get("CustomerId");
		customer.sigkey = (String) map.get("Sigkey");
		customer.avatar = (String) map.get("CustomerAvatar");
		customer.state = ConvertUtility.getValueAsByte(map.get("CustomerState"));
		customer.name = ConvertUtility.getValueAsString(map.get("CustomerName"));
		customer.tel = ConvertUtility.getValueAsString(map.get("CustomerTel"));
		customer.addr = ConvertUtility.getValueAsString(map.get("CustomerAddr"));
		customer.isPub = ConvertUtility.getValueAsBool(map.get("CustomerIsPub"), false);
		customer.userCreating = ConvertUtility.getValueAsLong(map.get("UserCreatingCustomer"));
		Date ct = ConvertUtility.getValueAsDate(map.get("CustomerCreateTime"));
		Date ut = ConvertUtility.getValueAsDate(map.get("CustomerUpdateTime"));
		if(ct != null){
			customer.createtime = ct.getTime();
		}
		if(ut != null){
			customer.updatetime = ut.getTime();
		}
		customer.bdLat = ConvertUtility.getValueAsDouble(map.get("BdLat"));
		customer.bdLng = ConvertUtility.getValueAsDouble(map.get("BdLng"));
		customer.gdLat = ConvertUtility.getValueAsDouble(map.get("GdLat"));
		customer.gdLng = ConvertUtility.getValueAsDouble(map.get("GdLng"));
		
		String type = ConvertUtility.getValueAsString(map.get("CustomerType"));
		customer.types = StringUtility.splitInt32(type, ',');
		
		customer.modulus = (String) map.get("modulus");
		customer.privexp = (String) map.get("privexp");
		customer.pubexp = (String) map.get("pubexp");
		Object reqobj = map.get("reqencrypt");
		Object rspobj = map.get("rspencrypt");
		if(reqobj == null) {
			customer.reqencrypt = null;
		}else {
			customer.reqencrypt = ConvertUtility.getValueAsBool(reqobj, false);
		}
		if(rspobj == null) {
			customer.rspencrypt = null;
		}else {
			customer.rspencrypt = ConvertUtility.getValueAsBool(rspobj, false);			
		}
		
		return customer;
	}
	
}
