package boundless.types.protobuf;

import java.util.Date;
import java.util.Calendar;
import java.util.TimeZone;

import com.baidu.bjf.remoting.protobuf.EnumReadable;
import com.baidu.bjf.remoting.protobuf.FieldType;
import com.baidu.bjf.remoting.protobuf.annotation.Protobuf;

public class DateTime {
	@Protobuf(fieldType = FieldType.SINT64, order=1, required = false)
    private long value ;
	@Protobuf(fieldType = FieldType.ENUM, order=2, required = false)
    private TimeSpanScale scale;
    
    /*private Date date;
    
    public Date getDate() {
    	return date;
	}
    
    public void setDate(Date date) {
		this.date = date;
	}
*/



public long getValue() {
		return value;
	}


	public void setValue(long value) {
		this.value = value;
	}


	public TimeSpanScale getScale() {
		return scale;
	}


	public void setScale(TimeSpanScale scale) {
		this.scale = scale;
	}


public enum TimeSpanScale implements EnumReadable 
    {
      DAYS(0),
      HOURS(1),
      MINUTES(2),
      SECONDS(3),
      MILLISECONDS(4),
      TICKS(5),
      MINMAX(15);

      private final int value;


      TimeSpanScale(int value) { this.value = value; }

      public int toValue() { return this.value; }

		@Override
		public int value() {
			// TODO Auto-generated method stub
			return toValue();
		}
	
    }
	private final static long TICKS_PER_MILLISECOND = 10000;
	public final static Date fromDateTimeToDate(DateTime dateTime) {
	    long timeLong = dateTime.getValue();
	
	    DateTime.TimeSpanScale timeSpanScale = dateTime.getScale();
	
	    Calendar c = Calendar.getInstance();
	    TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
	
	    switch (timeSpanScale) {
	    case DAYS:
	        // 24 * 60 * 60 * 1000
	        c.setTimeInMillis(timeLong * 86400000);
	        return c.getTime();
	    case HOURS:
	        // 60 * 60 * 1000
	        c.setTimeInMillis(timeLong * 3600000);
	        return c.getTime();
	    case MINUTES:
	        // 60 * 1000
	        c.setTimeInMillis(timeLong * 60000);
	        return c.getTime();
	    case SECONDS:
	        c.setTimeInMillis(timeLong * 1000);
	        return c.getTime();
	    case MILLISECONDS:
	        c.setTimeInMillis(timeLong);
	        return c.getTime();
	    case TICKS:
	        c.setTimeInMillis(timeLong / TICKS_PER_MILLISECOND);
	        return c.getTime();
	    default:
	        c.setTimeInMillis(0L);
	
	        return c.getTime();
	    }
	}
}
