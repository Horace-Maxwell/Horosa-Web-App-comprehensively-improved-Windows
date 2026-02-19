package boundless.types;

import java.util.List;

public class NameHolder {
	private ThreadLocal<String> contextHolder = new ThreadLocal<String>();

	private List<String> nameList;

	/**
	 * @return the nameList
	 */
	public List<String> getNameList() {
		return nameList;
	}

	/**
	 * @param nameList
	 *            the nameList to set
	 */
	public void setNameList(List<String> nameList) {
		this.nameList = nameList;
	}

	public String getSelectedName() {
		String db = contextHolder.get();
		if (db == null) {
			db = nameList.get(0);// 默认将读写库放在列表第一个
		}
		return db;
	}

	public void setSelectedName(String str) {
		contextHolder.set(str);
	}

	public void clearNames() {
		contextHolder.remove();
	}

}
