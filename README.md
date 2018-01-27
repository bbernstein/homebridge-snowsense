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

The **interval** field is how frequently (in minutes) to download the weather from wunderground.

### Simple

```json
"platforms": [
   {
      "platform": "SnowSwitch",
      "name": "Snow Switch",
      "key": "XXXXXXXXXXXXXXX",
      "location": "02134",
      "interval": "30",
      "snowhours": 3
   }
]
```

## Why this exists

I created this for a specific use case, which is to turn on and off snow melting mats outside my house.

I have been happy with [HeatTrak](https://heattrak.com/) Snow Melting Mats and when I purchased wireless outlets for them, I liked them even more. So, on one snowy weekend day I decided to take the automation to the next level and build this plug-in.

Now if the local forecast expects snow in the next few hours, the Snow Melting Mats will turn on, and when the snow stops falling, they Mats will turn off a few hours later.

I bought a set of [Etekcity](https://www.amazon.com/gp/product/B074GVPYPY) outlets and [homebridge-vesync](https://www.npmjs.com/package/homebridge-vesync) plug-in to control them from the network.

To make them work with HomeKit, I needed to get [homebridge](https://www.npmjs.com/package/homebridge) working. I had an old [Raspberry Pi](https://www.raspberrypi.org/) sitting around so I [installed it there](https://github.com/nfarina/homebridge/wiki/Running-HomeBridge-on-a-Raspberry-Pi) so I could just stick it in a closet with the rest of my network gear. 

This should work pretty well with any switches you can get working with HomeKit, and if you can also get a HomeBridge setup working and a Weather Underground API, then the Mobile Home end of this is pretty trivial. 

I had originally made additions to a more sophisticated weather forecasting add-on where I had added fields indicating that it had snowed recently or was expected to snow soon, but that required adding another plug-in to do periodic switches to trigger the activity of checking for the weather. I wanted to make something simpler at the front-end and have this single-purpose.

## How to set up the automation

- Launch the iPhone or iPad **Home** app
- Create scenes to turn on the Snow Mats and another to turn them off
- Create a new **Automation**
- Select **An accessory is Controlled** as the trigger for the automation
- Select the Controller **IsSnowy**
- Select *When* to be **Turns On**
- Select the **Snow Mats On** scene
- Repeat for turning **Off** when the controller **Turns Off**


## Contributors

This plugin borrowed code from and was inspired by [homebridge-weather-station-extended](https://github.com/naofireblade/homebridge-weather-station-extended) which is a fork of [homebridge-weather-station](https://github.com/kcharwood/homebridge-weather-station) which is a fork of [homebridge-wunderground](https://www.npmjs.com/package/homebridge-wunderground).
