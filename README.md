# homebridge-snowswitch
A switch that turns on when it's showing out using local weather forecast

This is a plugin for [homebridge](https://github.com/nfarina/homebridge) that is a simple switch that automatically switches ON when it's going to snow soon and OFF a while after it stops snowing.

This was inspired by and code borrowed from [homebridge-weather-station-extended](https://github.com/naofireblade/homebridge-weather-station-extended).

## Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-snowswitch`
3. Gather a free developer key for Weather Underground [here](http://www.wunderground.com/weather/api/).
4. Update your configuration file. See the samples below.

## Configuration

Add the following information to your config file. Make sure to add your API key and provide your city or postal code.

The **location** field is the location identifier from Weather Underground. You can find your local weather station on [Weather Underground](http://www.wunderground.com) and setting this field to **pws:\<your-nearest-weather-station\>** or simply enter your zip code.

The **snowhours** field is how early we want the switch to turn on before it snows and how long after to turn it off. In other words. In other words, setting it to **3** will turn on the switch 3 hours before it snows and turn it off 3 hours after it stops.
### Simple

```json
"platforms": [
   {
      "platform": "SnowSwitch",
      "name": "Snow Switch",
      "key": "XXXXXXXXXXXXXXX",
      "location": "02134",
      "snowhours": 3
   }
]
```


## Contributors

This plugin borrowed code from and was inspired by [homebridge-weather-station-extended](https://github.com/naofireblade/homebridge-weather-station-extended) which is a fork of [homebridge-weather-station](https://github.com/kcharwood/homebridge-weather-station) which is a fork of [homebridge-wunderground](https://www.npmjs.com/package/homebridge-wunderground).
