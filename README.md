# homebridge-snowsense
An Occupancy Sensor that indicates snowy conditions using local weather forecast

This is a plugin for [homebridge](https://github.com/nfarina/homebridge) that is a simple Occupancy Sensor that automatically detects occupancy ON when it's going to snow soon and OFF a while after it stops snowing. Think of **snow** being the **occupant** and you have ample warning of when the (un)welcome guest arrives.

This is based on my earlier project, [homebridge-snowswitch](https://github.com/bbernstein/homebridge-snowswitch) that was similar but acted as a switch rather than a sensor. That former project is no longer supported and does not work.


## New in v2.x

The app was mostly rewritten in TypeScript with settings now compatible with [homebridge-config-ui-x](https://www.npmjs.com/package/homebridge-config-ui-x) so it can be installed and configured without manually editing a config file.


## Installation

For any installation, you'll first need to get an *API Key* from [OpenWeather API](https://openweathermap.org/api/).

### Homebridge UI

Go to 'Plugins' page, search for `homebridge-snowsense` and click 'install'.

### Manually

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-snowsense`
3. Update your configuration file. Read below.

## Configuration

### Homebridge UI

Click the 'Settings' button for the plugin and enter the required information.

### Manually

Add the following information to your config file.

**apiKey** [no default] is the *Secret Key* as assigned from [OpenWeather](https://openweathermap.org/api)

**apiVersion** [default=3.0] is the version of the API to use. If you ware new to this, then you'll want to use 3.0.

**apiThrottleMinutes** [default=15] is the number of minutes to wait between API calls. This is to prevent exceeding the API call limit.

**debug** [default=false] is a flag to enable debug logging.

**location** field [no default] identifies the location for the snow checking. It can be a "city,state,country" (eg "Boston,MA,US"), or zip code (eg 02134), or "latitude,longitude" pair.

**units** [default='imperial'] (values 'metric' or 'imperial') is the units defined in [OpenWeather Docs](https://openweathermap.org/api/one-call-api). Basically, 'imperial' is Fahrenheit and 'metric' is Celcius. 

**hoursBeforeSnowIsSnowy** field [default=3] is number of **hours** before snow starts that the occupancy should go **on**.

**hoursAfterSnowIsSnowy** field [default=3] is number of **hours** after snow is last seen that the occupancy should go **off**.

Here's what the config might look like inside the `platforms` section.

```
{
    "platform": "SnowSense"
    "name": "Snow Sense",
    "apiKey": "**** get your key from OpenWeather ****",
    "apiVersion": 3.0,
    "apiThrottleMinutes": 15,
    "debug": false,
    "units": "imperial",
    "location": "Boston,ma,us",
    "hoursBeforeSnowIsSnowy": 3,
    "hoursAfterSnowIsSnowy": 3
}
```

## Why this exists

I created this for a specific use case, which is to turn on and off snow melting mats outside my house.

I have been happy with [HeatTrak](https://heattrak.com/) Snow Melting Mats and when I purchased wireless outlets for them, I liked them even more. So, on one snowy weekend I decided to take the automation to the next level and build this plug-in.

Now, if the local forecast expects snow in the next few hours, the Snow Melting Mats will turn on, and when the snow stops falling, they Mats will turn off a few hours later.

I bought a set of [Etekcity](https://www.amazon.com/gp/product/B074GVPYPY) outlets and installed [homebridge](https://github.com/nfarina/homebridge) and [homebridge-vesync](https://www.npmjs.com/package/homebridge-vesync) to control them from the my Apple-centric home using HomeKit.

To make them work with [HomeKit](https://www.apple.com/ios/home/), I needed to get [homebridge](https://www.npmjs.com/package/homebridge) working. I had an old [Raspberry Pi](https://www.raspberrypi.org/) sitting around so I [installed it there](https://github.com/nfarina/homebridge/wiki/Running-HomeBridge-on-a-Raspberry-Pi) and put the device in a closet with the rest of my network gear. 

This should work pretty well with any switches you can get working with [HomeKit](https://www.apple.com/ios/home/), and if you can also get a [homebridge](https://www.npmjs.com/package/homebridge) setup working and a [DarkSky](https://darksky.net/dev) API key, then the HomeKit App end of this is pretty trivial. 

## How to set up the automation

- Launch the [iPhone or iPad **Home** app](https://support.apple.com/en-us/HT204893)
- Create scenes; one to turn **on** the Snow Mats and another to turn them **off**
- Create a new **Automation**
- Select **An accessory is Controlled** as the trigger for the automation
- Select the Controller **IsSnowy**
- Select *When* to be **Turns On**
- Select the **Snow Mats On** scene
- Repeat for turning **Off** when the controller **Turns Off**


## Thanks

* Thanks to @apollo316 on github for pointing out that the DarkSky api is going away and @nicoryan and others for recommending OpenWeather.
* Thanks to @rmkjr for suggeting moving from a Switch to an Occupancy Sensor.
* Thanks to @scoutbeer for detailed feedback and help testing v2.0.

