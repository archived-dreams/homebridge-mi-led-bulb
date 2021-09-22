# homebridge-mi-led-bulb

This is a [Homebridge](https://github.com/nfarina/homebridge) plugin for exposing the all Xiaomi color leed lamps (tested on Xiaomi Mi Smart LED Bulb Essential)


### npm

```
npm install -g homebridge-mi-led-bulb
```


## Example Configuration

```json
{
  "bridge": {},
  "accessories": [
    {
      "accessory": "mi-led-bulb",
      "name": "Lamp in the bedroom",
      "ip": "192.168.0.100",
      "token": "**********************"
    }
  ],
  "platforms": []
}
``` 
