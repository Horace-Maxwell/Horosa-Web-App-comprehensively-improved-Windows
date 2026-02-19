package boundless.spring.help;

import javax.sql.DataSource;

import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;

/**
 * 配置于applicationContext 中，线程局部变量ThreadLocal contextHolder 保存当前需要的数据源类型，
 * 当 DataSourceSwitch.setDataSourceType(DataSourceInstances.XXX) 保存当前需要的数据源类型的时候，
 * DataSources 会从当前线程中查找线程变量的数据源类型，从而决定使用何种数据源  
 * @author Administrator
 *
 */
public class DataSources extends AbstractRoutingDataSource{

	@Override
	protected Object determineCurrentLookupKey() {
		Object obj = DataSourceSwitch.getDataSourceType();
		return obj;
	}

	@Override
	protected DataSource determineTargetDataSource() {
		DataSource ds = super.determineTargetDataSource();
		return ds;
	}

	
}
