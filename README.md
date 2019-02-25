# homebridge-snowsense
A switch that turns on when it's showing out using local weather forecast

This is a plugin for [homebridge](https://github.com/nfarina/homebridge) that is a simple Occupancy Sensor that automatically detects occupancy ON when it's going to snow soon and OFF a while after it stops snowing. Think of **snow** being the **occupant** and you have ample warning of when the (un)welcome guest arrives.

This is based on my earlier project, [homebridge-snowswitch](https://github.com/bbernstein/homebridge-snowswitch) that was similar but acted as a switch rather than a sensor.

Thanks to [rmkjr](https://github.com/rmkjr) for suggeting moving from a Switch to an Occupancy Sensor.

## Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-snowsense`
3. Gather a free *Secret Key* for  [Dark Sky API](https://darksky.net/dev)
4. Update your configuration file. Read below.

## Configuration

Add the following information to your config file.

**key** [no default] is the *Secret Key* as assigned from [DarkSky](https://darksky.net/dev)

**latitude** and **longitude** fields [no default] identify the location for the snow checking. You can find the coordinates by looking at [Google Maps](https://maps.google.com/) and finding the numbers after the **@** symbol. Eg: **@40.7484405,-73.9878584** means Latitude is 40.748 and Longitude is -73.988.

**forecastFrequency** field [default=15] is how frequently (in **minutes**) to download the weather forecast. Don't do it too frequently or you will use up your API limit for the day.

**beforeSnowStarts** field [default=3] is number of **hours** before snow starts that the occupancy should go **on**.

**afterSnowStops** field [default=3] is number of **hours** after snow stops that the occupancy should go **off**.

**precipProbabilityMin** field [default=0.5] is minimum probability of snow that you want to consider it snowy. From my exerimenting, it appeared that the "snowing" icon is displayed when that probability is over 0.5, but you may want to be more pessimistic. Thanks to [i3laze](https://github.com/i3laze) for the suggestion.



```json
"platforms": [
	{
		"platform": "SnowSense",
		"name": "Snow Sense",
		"key": "XXXXXXX_GET_YOUR_OWN_KEY_XXXXXXX",
		"latitude": "42.326",
		"longitude": "-71.220",
		"forecastFrequency": 15,
		"beforeSnowStarts": 3,
		"afterSnowStops": 3,
		"precipProbabilityMin": 0.25
	}
]
```

## Why this exists

I created this for a specific use case, which is to turn on and off snow melting mats outside my house.

I have been happy with [HeatTrak](https://heattrak.com/) Snow Melting Mats and when I purchased wireless outlets for them, I liked them even more. So, on one snowy weekend I decided to take the automation to the next level and build this plug-in.

Now, if the local forecast expects snow in the next few hours, the Snow Melting Mats will turn on, and when the snow stops falling, they Mats will turn off a few hours later.

I bought a set of [Etekcity](https://www.amazon.com/gp/product/B074GVPYPY) outlets and installed [homebridge](https://github.com/nfarina/homebridge) and [homebridge-vesync](https://www.npmjs.com/package/homebridge-vesync) to control them from the my Apple-centric home using HomeKit.

To make them work with [HomeKit](https://www.apple.com/ios/home/), I needed to get [homebridge](https://www.npmjs.com/package/homebridge) working. I had an old [Raspberry Pi](https://www.raspberrypi.org/) sitting around so I [installed it there](https://github.com/nfarina/homebridge/wiki/Running-HomeBridge-on-a-Raspberry-Pi) and put the device in a closet with the rest of my network gear. 

This should work pretty well with any switches you can get working with [HomeKit](https://www.apple.com/ios/home/), and if you can also get a [homebridge](https://www.npmjs.com/package/homebridge) setup working and a [DarkSky](https://darksky.net/dev) API key, then the HomeKit App end of this is pretty trivial. 

I had originally made additions to [homebridge-weather-station-extended](https://github.com/naofireblade/homebridge-weather-station-extended), a more sophisticated weather forecasting add-on where I had added fields indicating that it had snowed recently or was expected to snow soon, but that required more complex setup from the iPhone App. I wanted to make something simpler at the front-end and have this single-purpose.

Thanks to @mbriney on github for pointing out that the wunderground api is going away and suggesting DarkSky for the replacement api.

## How to set up the automation

- Launch the [iPhone or iPad **Home** app](https://support.apple.com/en-us/HT204893)
- Create scenes; one to turn **on** the Snow Mats and another to turn them **off**
- Create a new **Automation**
- Select **An accessory is Controlled** as the trigger for the automation
- Select the Controller **IsSnowy**
- Select *When* to be **Turns On**
- Select the **Snow Mats On** scene
- Repeat for turning **Off** when the controller **Turns Off**


## Contributors

This plugin borrowed code from and was inspired by [homebridge-weather-station-extended](https://github.com/naofireblade/homebridge-weather-station-extended) which is a fork of [homebridge-weather-station](https://github.com/kcharwood/homebridge-weather-station) which is a fork of [homebridge-wunderground](https://www.npmjs.com/package/homebridge-wunderground).
