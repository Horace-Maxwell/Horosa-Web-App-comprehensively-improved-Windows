package boundless.types;

import java.io.Serializable;
import java.util.Map.Entry;

/**
 * key-value pair
 * @author zjf
 *
 * @param <K>
 * @param <V>
 */
public class KeyValuePair<K, V> implements Entry<K, V>, Serializable {
	private static final long serialVersionUID = 3461136484032999002L;
	
	private K _key;
	private V _value;

	public KeyValuePair(K k, V v) {
		this._key = k;
		this._value = v;
	}

	public KeyValuePair(K k) {
		this._key = k;
	}

	@Override
	public K getKey() {
		return this._key;
	}

	@Override
	public V getValue() {
		return this._value;
	}

	@Override
	public V setValue(V value) {
		this._value = value;
		return this._value;
	}

}
