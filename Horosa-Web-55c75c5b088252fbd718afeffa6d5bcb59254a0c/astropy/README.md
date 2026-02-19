# astrostudy

整个系统由3部分组成：前端（客户端）--> java服务端 --> python web服务端。

## java服务端
向客户端暴露星盘计算接口，已经一些用户账号管理之类的功能。它不进行具体的星盘计算，而是把客户端的星盘计算请求转发给python web服务端。 
它最大的作用就是缓存python端的计算结果和用户账户相关的业务逻辑。

## python web服务端
负责具体的星盘计算，推运计算等，它位于内网不直接与客户端对接。
是以flatlib为核心库的微服务，它分为2个包，astrostudy包和websrv包.
* astrostudy
	此包主要负责实现星盘，推运等计算功能，它包括星盘基本数据计算，法达星限，太阳弧推运等具体实现。
* websrv
	此包负责以RESTFUL url的方式把astrostudy包的计算结果反馈给客户端。它使用cherrypy框架，提供url方式的服务。
	如果以后需要切换web框架，也可在此包下直接切换。
	
# 请求数据需要进行签名

```
function sign(token, headers, body){
    let hd = '';
    if(headers){
        hd = `${headers.ClientChannel}${headers.ClientApp}${headers.ClientVer}`;
    }
    const txt = body ? body : '';
    const tk = token ? token : '';
    const data = `${tk}${Constants.SignatureKey}${hd}${txt}`;
    const res = CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
    return res;
}
```

上述js代码演示了需要签名的数据依次由4部分组成：token值，签名key，客户端标识，请求体。这4个部分依次连接成一个字符串，就是上述代码中的：
```
const data = `${tk}${Constants.SignatureKey}${hd}${txt}`;
```
* token值：token是用户登录后，服务端返回的一个字符串，如果未登录，这个值就为空
* 签名key：这里先约定为：12AB456E2959，以后具体上线时可以再改成其它的key
* 客户端标识：依次为3个部分组成：
    * 客户端渠道，这里为字符串：1；以后可以根据ios，android，pc等进行编码。
    * 客户端应用，这里为字符串：1；以后可以根据游戏，手机app，网站登进行编码。
    * 客户端应用版本，这里为字符串：1.0；以后可以根据具体应用版本进行编码。
* 请求体：json字符串。如果没有请求数据，请求体就为空串。

把这4个部分依次连接起来后，用sha256编码成16进制字符串，然后把这个签名串放在请求头的Signature字段中发送给服务端。
```
        const usrtoken = localStorage.getItem(Constants.TokenKey);
        opts.headers = {
            ...headers,
            Token: usrtoken, 
            'Content-Type': 'application/json; charset=UTF-8', 
            LocalIp: LocalIp,
            ClientChannel: Constants.ClientChannel,
            ClientApp: Constants.ClientApp,
            ClientVer: Constants.ClientVer,
        };
        opts.headers.Signature = sign(usrtoken, opts.headers, opts.body);
    
        const st = new Date().getTime();
        const response = await fetch(url, opts);
    
        const endt = new Date().getTime();
        const delta = endt - st;
        if(delta > 1000){
            console.log(`response time in ${delta} ms for ${url}`);
        }
    
```
上述代码演示了请求签名，发送等过程。请求头中Token，Signature，ClientChannel，ClientApp，ClientVer这5个字段必须有；LocalIp尽量有。

# 接口返回格式
```json5
{
  "ResultCode": 0,
  "Result": {}

}
```
java微服务返回给客户端的数据也为json字符串，顶层由2个字段组成：ResultCode和Result。
* ResultCode： 为整形。请求结果正常时为0，有任何错误都为非0数字。
* Result：为json对象或字符串。当请求结果正常时，此为一个json对象。但有错误发生时，此为错误消息字符串。
下文中的各个接口说明，将只列出Result字段的内容。
   
# 接口说明
为客户端提供两大类接口：星盘基本数据和推运。所有接口为restful url方式，参数都以POST方法提交，
参数为json字符串放在请求体中；微服务的响应结果也为json字符串，放在响应体中返回给请求端。  
微服务的测试地址为：http://spacex.f3322.net:9999/ 建议用insomnia （https://insomnia.rest）软件进行测试  


## 星盘数据接口： http://spacex.f3322.net:9999/

请求参数：

```

{
	"date": "1976/07/06",
	"time": "21:11",
	"zone": "+08:00",
	"lat": "26n05",
	"lon": "119e18",
	"hsys": 0,
	"tradition": 1,
	"simpleAsp": 0,
	"strongRecption": 0,
	"virtualPointReceiveAsp": 1,
	"predictive": 1,
	"pdaspects": [0, 60, 90, 120, 180]
}

```

参数      | 数据类型     | 说明  
-------- | ----------- | ------
date  | 字符串 | 星盘日期，必填
time  | 字符串 | 星盘时间，必填
zone  | 字符串 | 时区，必填
lat  | 字符串 | 纬度，必填
lon  | 字符串 | 经度，必填
hsys  | 整形 | 分宫制：0--Whole Sign; 1--Alcabitus; 2--Regiomontanus; 3--Placidus; 4--Koch。 如果没有此参数，将使用整宫制
tradition  | 布尔型 | 是否为古典星盘：1--无三王星的古典星盘；0--含有三王星的星盘。 如果没有此参数，默认为古典星盘，不包含三王星
simpleAsp  | 布尔型 | 是否为简单相位计算法：1--计算相位容许度按2颗行星的容许度相加除以2；0--根据行星各自的相位容许度进行相位计算。 如果没有此参数，默认为0
strongRecption  | 布尔型 | 是否为强接纳：1--接纳，互融只算ruler, exalt；0--只要含有2个加分项的先天禀赋，就认为存在接纳或互融。 如果没有此参数将使用非强接纳
virtualPointReceiveAsp  | 布尔型 | 虚拟点是否可以接收到相位：1--可以接收到相位；0--不会接收到相位。 如果没有此参数，0
predictive  | 布尔型 | 是否需要返回推运数据：1--需要推运数据；0--不需要推运数据； 如果没有此参数，将不返回推运数据
pdaspects  | 整形数组 | 主限法需要计算的相位。 如果没有此参数，将使用主要相位进行计算

返回数据：
```
{
    "chart": {
        "antiscias": {},
        "angles": {},
        "objects":{},
        "houses": {},
        "isDiurnal": true / false,
        "orientOccident": {},
        "stars": []
    },
    "aspects": {
        "immediateAsp": {},
        "normalAsp": {},
        "signAsp": {}
    },
    "mutuals": {
        "abnormal": {},
        "normal": {}
    },
    "receptions": {
        "abnormal": {},
        "normal": {}    
    },
    "surround": {
        "attacks":{},
        "houses": {},
        "planets": {}
    },
    "predictives": {
        "firdaria": {},
        "primaryDirection": {}
    }   
}
```
字段      | 数据类型     | 说明  
-------- | ----------- | ------
chart  | 对象类型 | 星盘信息
aspects  | 对象类型 | 行星间相位
mutuals  | 对象数组 | 互融关系
receptions  | 对象数组 | 接纳关系
surround  | 对象类型 | 光线围攻，绕日，绕月，夹宫
predictives  | 对象类型 | 主限法推运和法达星限

* chart 对象说明：
```
"chart": {
    "angles":{ // 上升，下降，天底，天顶，这4点数据
        "content": {
            "Asc": {
              "id": "Asc",
              "house": "House1", // 所落宫位
              "lat": 0.0,  // 黄道纬度
              "lon": 322.2776183982974,  // 黄道经度，也就是黄道度数
              "sign": "Aquarius",
              "signlon": 22.27761839829742,  // 把黄道度数换算成所落星座内的度数
              "type": "Generic"
            },
            "Desc":{ ... },
            "IC": { ... },
            "MC": {}
        }
    },
    "houses": { // 12宫，宫位数据
        "House1": {
            "hsys": "Whole Sign", // 所用的宫位制
            "id": "House1",
            "hsys": "Whole Sign", // 所用的宫位制
            "exalt": null, // 擢升星
            "ruler": "Saturn", // 宫主星
            "planets": [], // 宫内星
            "lat": 0.0,
            "lon": 300.0,
            "sign": "Aquarius",
            "signlon": 0.0,
            "size": 30.0,
            "type": "House"
        },
        ...
    },    
    "objects": { // 各行星，虚点数据
          "Moon": {
              "id": "Moon",
              "exaltHouse": "House4", // 在哪一宫擢升
              "house": "House10", 所落宫位
              "ruleHouses": [ // 是哪些宫的宫主星
                "House6"
              ],
              "lat": -0.16192417416753077,
              "latspeed": 1.2677073784605695,
              "lon": 218.66853661657632,
              "lonspeed": 14.238696793091977, //当天的黄经运行速度，如果为负值，代表逆行
              "sign": "Scorpio",
              "signlon": 8.668536616576318,
              "type": "Planet",
              "isPeregrine": false,  // 是否游走
              "isRetrograde": false, // 是否逆行
              "isVOC": false,  // 是否空亡，只有月亮有此字段
              "moonPhase": "Second Quarter", // 月亮所处象限，只有月亮有此字段
              "score": -1  // 评估先天禀赋分数
              "dignities": {  // 行星所在星座的不同先天禀赋
                "dayTrip": "Venus", // 白天三分主星
                "exalt": null,  
                "exile": "Venus",
                "face": "Mars",
                "fall": "Moon",
                "nightTrip": "Mars", // 夜晚三分主星
                "partTrip": "Moon",  // 共管三分主星
                "ruler": "Mars",  // 月主星
                "term": "Venus"  // 月亮所落的界主
              },
              "selfDignity": [ // 此行星具有的先天禀赋
                  "partTrip",
                  "fall"
              ],              
              "governSign": "Leo", // 宰制星座
              "governPlanets": [ // 在宰制星座内的行星
                "Mars",
                "Saturn"
              ]                            
          },
            ...
    },
    "isDiurnal": false, // 是否是日生盘
    "orientOccident": { // 相对各个行星的东升西入
    
    },
    "stars": [] // 行星汇合恒星
}
```


* aspects 对象说明：内含3个字段：immediateAsp， normalAsp， signAsp
```
"aspects": {
    "immediateAsp":{ // 行星与另外2颗行星间的离相，入相关系
    
    },
    "normalAsp": { // 标准的行星相位关系
    
    },
    "signAsp":{ // 按星座为标准进行相位计算
    
    }
}
```
    每颗行星的相位分为4类：都为对象数组
    * Applicative: 入相位
    * Exact: 精确相位，指是离相并且误差偏移小于1度
    * Separative: 离相位
    * None: 不属于上面3类的，都归在此类。一般是远行星的相位基本在这个分类
    * Obvious: 显相位，指误差偏移小等于3度的相位


* mutuals 对象说明：
```
"mutuals": {
    "abnormal":[],
    "normal": []
}
```
    mutuals代表星盘中的互融关系，分为2类：
    * abnormal: 邪互融
    * normal: 正互融。


* receptions 对象说明：
```
"receptions": {
    "abnormal":[],
    "normal": []
}
```
    receptions字段代表行星间接纳关系。含有2个字段：
    * abnormal: 邪接纳。
    * normal: 正接纳。


* predictives 对象说明：
```
"predictives": {
    "firdaria": [ // 法达星限
      {
        "mainDirect": "Moon", // 月亮主限
        "subDirect": [ // 子限数组
          {
            "date": "1976-07-06", // 开始时间
            "subDirect": "Moon"  // 月亮子限
          },
          {
            "date": "1977-10-19",
            "subDirect": "Saturn"
          },
          {
            "date": "1979-02-01",
            "subDirect": "Jupiter"
          },
          {
            "date": "1980-05-15",
            "subDirect": "Mars"
          },
          {
            "date": "1981-08-28",
            "subDirect": "Sun"
          },
          {
            "date": "1982-12-10",
            "subDirect": "Venus"
          },
          {
            "date": "1984-03-24",
            "subDirect": "Mercury"
          }
        ]
      },
      ...
    ],
    "primaryDirection": [ // 主限法
      [
        0.2030843614316095, // 主限法计算出的度数，可代表时间。
        "T_Mercury_Virgo", // 处女座的水星界,promittor
        "N_Mars_0",  // 与火星的合相，significator
        "Z",  // 代表黄道计算法，还有一种"M"代表mundus计算法
        "1976-09-19" // 根据度数换算出的事件发生时间
      ], 
      ...    
    ]
}
```
    predictives字段代表推运，现阶段返回2种推运：法达星限与主限法
    * 法达星限：主限和子限，上述例子已作出说明
    * 主限法：返回一个二维数组，每个子数组都具有5个元素
        元素0：主限法计算出的度数，可代表时间。
        元素1：promittor
        元素2：significator
        元素3："Z"代表黄道计算法，"M"代表mundus计算法。现阶段只返回黄道计算法
        元素4：根据度数换算出的事件发生时间
    * 进一步解释下元素1（promittor）和元素2（significator）
        promittor和significator都是字符串由下划线"_"分隔成3个部分。
        第一部分会有6个字符出现：
            T: 代表界
            D: 代表右相位(right side)
            S: 代表左相位(left side)
            A: 代表映点
            C: 代表反映点
            N: 代表合相或对冲相，如果第3部分是0，就代表合相；若为180，则为对冲相
        第二部分就是行星
        第三部分代表星座或相位值:
            第一部分为T，第三部分肯定为星座
            第一部分为N，第三部分肯定为0或180
            第一部分为D或S，第三部分肯定为除了0和180外的相位值
            第一部分为A或C，不存在第三部分


### 推运接口


