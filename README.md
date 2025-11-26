# iris-logger

## 开发

使用tauri、vite、react开发。

需要自己修改安卓手机GPS定位相关代码。

### TODO

- ~~amap的api通过dotenv导入~~
- ~~数据库id自增~~
- ~~前端添加防抖~~
- ~~前端分割代码~~
- ~~字体大小~~
- ~~reset后退出调用apphandle~~

### GPS

`tauri-plugin-geolocation = { path = "/home/arco/Downloads/plugins-workspace/plugins/geolocation" }`

```kotlin
import android.location.LocationListener
import android.os.Bundle

@SuppressLint("MissingPermission")
fun sendLocation(enableHighAccuracy: Boolean, successCallback: (location: Location) -> Unit, errorCallback: (error: String) -> Unit) {
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

    lm.requestSingleUpdate(LocationManager.GPS_PROVIDER, object : LocationListener {
        override fun onLocationChanged(location: Location) {
            successCallback(location)
            lm.removeUpdates(this)
        }
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
    }, null)
}
```

### SIGN APK

see [Android Code Signing](https://v2.tauri.app/distribute/sign/android/)

the jks's password check dotenv

### sqlite db

位置在`/home/arco/.config/com.arco.iris-logger/data.db`

### build

```bash
cargo tauri android build --target armv7
```
