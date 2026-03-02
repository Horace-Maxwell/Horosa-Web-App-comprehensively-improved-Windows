package boundless.utility;

public class ClientOsInfo {
    /*** 
     * 比如 Android_3.0 
     */  
    private String osTypeVersion;  
    
    /*** 
     * Pad或Phone 
     */  
    private String deviceType;  
    
    /*** 
     * os type 
     */  
    private String osType;  
    
    /*** 
     * 只是版本号,例如"4.1.1" 
     */  
    private String version;  
    private String userAgent;  
    
    /*** 
     * 是否是移动设备 
     * @return 
     */  
    public boolean isMobile(){  
        return (!StringUtility.isNullOrEmpty(this.deviceType));  
    }

	public String getOsTypeVersion() {
		return osTypeVersion;
	}

	public void setOsTypeVersion(String osTypeVersion) {
		this.osTypeVersion = osTypeVersion;
	}

	public String getDeviceType() {
		return deviceType;
	}

	public void setDeviceType(String deviceType) {
		this.deviceType = deviceType;
	}

	public String getOsType() {
		return osType;
	}

	public void setOsType(String osType) {
		this.osType = osType;
	}

	public String getVersion() {
		return version;
	}

	public void setVersion(String version) {
		this.version = version;
	}

	public String getUserAgent() {
		return userAgent;
	}

	public void setUserAgent(String userAgent) {
		this.userAgent = userAgent;
	}  
    
    

}
