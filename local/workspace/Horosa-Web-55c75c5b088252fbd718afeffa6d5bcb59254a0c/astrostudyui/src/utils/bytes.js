function test() {
    let bytes = getFloat64Bytes(-3.33);
    alert(bytes);
    alert(toFloat64(bytes));
}

//构建一个视图，把字节数组写到缓存中，索引从0开始，大端字节序
function getView(bytes) {
    let view = new DataView(new ArrayBuffer(bytes.length));
    for (let i = 0; i < bytes.length; i++) {
        view.setUint8(i, bytes[i]);
    }
    return view;
}

//将字节数组转成有符号的8位整型，大端字节序
export function toInt8(bytes) {
    return getView(bytes).getInt8();
}
//将字节数组转成无符号的8位整型，大端字节序
export function toUint8(bytes) {
    return getView(bytes).getUint8();
}
//将字节数组转成有符号的16位整型，大端字节序
export function toInt16(bytes) {
    return getView(bytes).getInt16();
}
//将字节数组转成无符号的16位整型，大端字节序
export function toUint16(bytes) {
    return getView(bytes).getUint16();
}
//将字节数组转成有符号的32位整型，大端字节序
export function toInt32(bytes) {
    return getView(bytes).getInt32();
}
//将字节数组转成无符号的32位整型，大端字节序
export function toUint32(bytes) {
    return getView(bytes).getUint32();
}
//将字节数组转成32位浮点型，大端字节序
export function toFloat32(bytes) {
    return getView(bytes).getFloat32();
}
//将字节数组转成64位浮点型，大端字节序
export function toFloat64(bytes) {
    return getView(bytes).getFloat64();
}

//将数值写入到视图中，获得其字节数组，大端字节序
function getUint8Array(len, setNum) {
    let buffer = new ArrayBuffer(len);  //指定字节长度
    setNum(new DataView(buffer));  //根据不同的类型调用不同的函数来写入数值
    let uint8Array = new Uint8Array(buffer); //创建一个字节数组，从缓存中拿取数据
    var arr = new Array();  //将Uint8Array转成Array数组，不考虑性能问题
    for (var i = 0; i < uint8Array.byteLength; i++) {  // Uint8Array没有length，只有byteLength
        arr.push(uint8Array[i]);
    }
    return arr;
}

//得到一个8位有符号整型的字节数组，大端字节序
export function getInt8Bytes(num) {
    return getUint8Array(1, function (view) { view.setInt8(0, num); })
}
//得到一个8位无符号整型的字节数组，大端字节序
export function getUint8Bytes(num) {
    return getUint8Array(1, function (view) { view.setUint8(0, num); })
}
//得到一个16位有符号整型的字节数组，大端字节序
export function getInt16Bytes(num) {
    return getUint8Array(2, function (view) { view.setInt16(0, num); })
}
//得到一个16位无符号整型的字节数组，大端字节序
export function getUint16Bytes(num) {
    return getUint8Array(2, function (view) { view.setUint16(0, num); })
}
//得到一个32位有符号整型的字节数组，大端字节序
export function getInt32Bytes(num) {
    return getUint8Array(4, function (view) { view.setInt32(0, num); })
}
//得到一个32位无符号整型的字节数组，大端字节序
export function getUint32Bytes(num) {
    return getUint8Array(4, function (view) { view.setUint32(0, num); })
}
//得到一个32位浮点型的字节数组，大端字节序
export function getFloat32Bytes(num) {
    return getUint8Array(4, function (view) { view.setFloat32(0, num); })
}
//得到一个64位浮点型的字节数组，大端字节序
export function getFloat64Bytes(num) {
    return getUint8Array(8, function (view) { view.setFloat64(0, num); })
}

////下面几个为另一种实现方式的版本，只实现了简单几种，其他的实现起来比较麻烦，所以就中途放弃了
//function toInt32(bytes) {
//    return ((bytes[0] & 0xFF) << 24) | ((bytes[1] & 0xFF) << 16) | ((bytes[2] & 0xFF) << 8) | (bytes[3] & 0xFF);
//}
//function toUInt16(bytes) {
//    return ((bytes[0] & 0xFF) << 8) | (bytes[1] & 0xFF);
//}
//function toInt16(bytes) {
//    return bytes[0] >> 7 == 0 ? toUInt16(bytes) : toUInt16(bytes) - 65536;
//}
//function getInt32Bytes(num) {
//    return [num >> 24 & 0xFF, num >> 16 & 0xFF, num >> 8 & 0xFF, num & 0xFF];
//}
//function getUint16Bytes(num) {
//    return [num >> 8 & 0xFF, num & 0xFF];
//}
//function getInt16Bytes(num) {
//    return num >= 0 ? getUint16Bytes(num) : getUint16Bytes(65536 + num);
//}