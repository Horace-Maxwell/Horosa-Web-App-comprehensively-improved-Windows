package boundless.web.common;

public enum UserType{
	SELF_SUPERUSER((byte)0),	// 本部超级管理员
	SELF_USER((byte)1),			// 本部员工
	COMP_USER((byte)2),			// 基本客户员工
	PUBLIC_USER((byte)3),		// 公共用户
	FREE_MAINTAINER((byte)4),	// 独立维保人员
	MANUFACTURER_USER((byte)5),	// 生厂商员工
	PARTS_SUPPLIER_USER((byte)6), // 配件供应商员工
	MAINTAINCOMP_USER((byte)7),   // 维保公司员工
	OPERATOR_USER((byte)8);   // 运营商员工
	
	private int code;
	private UserType(int code){
		this.code = code;
	}
	
	public int getCode(){
		return this.code;
	}
}
