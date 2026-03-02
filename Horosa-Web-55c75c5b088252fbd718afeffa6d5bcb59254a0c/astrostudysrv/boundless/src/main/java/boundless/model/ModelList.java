package boundless.model;

import java.util.function.Supplier;

public class ModelList extends ModelData {
	private static final long serialVersionUID = 1419994601183728161L;

	public boolean getDeletedBefore(){
		return getAttributeAsBool("deleted.before",false);
	}
	
	public void setDeletedBefore(boolean value){
		this.setAttribute("deleted.before", value);
	}


    public int getCount()
    {
        return this.getNodesCount();
    }

    public ModelData get(int index){
    	return (ModelData) this.getNode(index);
    }
    
    public void set(int index, ModelData data){
    	this.set(index, data);
    }

    /**
     * 将所有ModelData元素转成数组
     * @return
     */
    public ModelData[] toArray()
    {
        return this.getFieldList();
    }

    public void add(ModelData child)
    {
        this.addNode(child);
    }

    public void insert(int index, ModelData child)
    {
        this.addNode(index, child);
    }

    public void remove(ModelData child)
    {
        this.removeNode(child);
    }

    public void remove(int index)
    {
        this.removeNode(index);
    }

    public Supplier<ModelData> getChildCreator(String childName)
    {
    	final ModelData data = (ModelData) super.createNode(childName);
        return new Supplier<ModelData>(){
			@Override
			public ModelData get() {
				return data;
			}
        	
        };
    }
	
}
