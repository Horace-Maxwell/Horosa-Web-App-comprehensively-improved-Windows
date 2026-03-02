package boundless.model;

public class StateResult {
	public static int SUCCESS_STATE=0;
	public static int PRIMARY_KEY_STATE=1;
	public static int FAIL_STATE=2;
	public static int OTHER_KEY_STATE=3;
	public static int PATIAL_SUCCESS_STATE=4;
	
	private int state;
    
	private String value;
	
    private StateResult()
    {
    }
    
    /**
     * <ul>
     * <li>0.成功</li>
     * <li>1.主键存在</li>
     * <li>2.其他错误</li>
     * <li>3.其他主键</li>
     * </ul>
     * @return
     */
    public int state()
    {
    	return state;
    }

    public String value()
    {
    	return value;
    }

    
    public int getState() {
		return state;
	}

	public void setState(int state) {
		this.state = state;
	}

	public String getValue() {
		return value;
	}

	public void setValue(String value) {
		this.value = value;
	}

	
	public static StateResult successful(String result)
    {
    	StateResult res = new StateResult();
    	res.state = SUCCESS_STATE;
    	res.value = result;
        return res;
    }

    public static StateResult primaryKey(String result)
    {
    	StateResult res = new StateResult();
    	res.state = PRIMARY_KEY_STATE;
    	res.value = result;
        return res;
    }
   
    public static StateResult fail(String error)
    {
    	StateResult res = new StateResult();
    	res.state = FAIL_STATE;
    	res.value = error;
        return res;
    }

    public static StateResult otherKey(String result)
    {
    	StateResult res = new StateResult();
    	res.state = OTHER_KEY_STATE;
    	res.value = result;
        return res;
    }

    public static StateResult partialSuccess(String result)
    {
    	StateResult res = new StateResult();
    	res.state = PATIAL_SUCCESS_STATE;
    	res.value = result;
        return res;
    }

}
