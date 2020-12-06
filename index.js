const debug = require('debug')('homebridge-snowwatch');
const snowwatch = require('./src/SnowWatch');
let Service, Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerPlatform("homebridge-snowsense", "SnowSense", SnowSensePlatform);
};

// NOT A REAL TEST, JUST FOR DEBUGGING
// test()
//     .then(() => {
//         console.log("done");
//     });

// async function test() {
//     const openweathermapkey = "GET_KEY";
//     const darkskykey = "GET_KEY";
//
//     // const latitude = "42.326";
//     // const longitude = "-71.220";
//
//     // a snowy place in russia
//     const latitude = "44.80";
//     const longitude = "-68.78";
//
//     const units = "imperial";
//
//     const precipTempIsSnow = 32;
//
//     var snowingSoon;
//     const futurehours = 5;
//
//     const watcherdarksky = new snowwatch.SnowWatch('darksky', darkskykey, latitude, longitude, units, precipTempIsSnow);
//
//     snowingSoon = await watcherdarksky.snowingSoon(futurehours);
//     console.log("darksky snowingSoon:", snowingSoon);
//
//     const watcheropenweathermap = new snowwatch.SnowWatch('openweathermap', openweathermapkey, latitude, longitude, units, precipTempIsSnow);
//     snowingSoon = await watcheropenweathermap.snowingSoon(futurehours);
//     console.log("openweathermap snowingSoon:", snowingSoon);
// }

function SnowSensePlatform(log, config) {
    this.log = log;
    const provider = config['provider'] || 'darksky';
    const key = config['key'];
    const latitude = config['latitude'];
    const longitude = config['longitude'];
    const precipTempIsSnow = config['precipTempIsSnow'];

    let units = config['units'];

    // in case units were one of the darksky values
    switch (units) {
        case "si": units = "metric"; break;
        case "us": units = "imperial"; break;
        case "uk": units = "metric"; break;
        case "ca": units = "metric"; break;
    }

    if (!["imperial", "metric", "standard"].includes(units)) {
        units = "imperial";
    }

    this.station = new snowwatch.SnowWatch(provider, key, latitude, longitude, units, precipTempIsSnow);

    this.interval = ('forecastFrequency' in config ? parseInt(config['forecastFrequency']) : 15);
    this.interval = (typeof this.interval !== 'number' || (this.interval % 1) !== 0 || this.interval < 0) ? 15 : this.interval;

    // number of hours to consider "snowing soon" or "snowed recently"
    this.beforeSnowStarts = ('beforeSnowStarts' in config ? parseInt(config['beforeSnowStarts']) : 3);
    this.beforeSnowStarts = (typeof this.beforeSnowStarts !== 'number' || (this.beforeSnowStarts % 1) !== 0 || this.beforeSnowStarts < 0) ? 3 : this.beforeSnowStarts;
    this.afterSnowStops = ('afterSnowStops' in config ? parseInt(config['afterSnowStops']) : 3);
    this.afterSnowStops = (typeof this.afterSnowStops !== 'number' || (this.afterSnowStops % 1) !== 0 || this.afterSnowStops < 0) ? 3 : this.afterSnowStops;

    this.sensorConfig = ('sensors' in config ? config['sensors'] : '');
    if (this.sensorConfig === '') {
        this.sensorConfig = 'past,present,future,any';
    }

    this.updateWeather();
}

SnowSensePlatform.prototype = {
    accessories: function (callback) {
        this.accessories = [];

        for (const sensor of this.sensorConfig.split(",")) {
            switch (sensor.trim().toLowerCase()) {
                case 'past':
                    debug("adding PAST sensor");
                    const wasSnowingAccessory = new WasSnowingAccessory(this);
                    this.accessories.push(wasSnowingAccessory);
                    break;
                case 'present':
                case 'now':
                    debug("adding PRESENT sensor");
                    const isSnowingAccessory = new IsSnowingAccessory(this);
                    this.accessories.push(isSnowingAccessory);
                    break;
                case 'future':
                case 'later':
                    debug("adding FUTURE sensor");
                    const willSnowAccessory = new WillSnowAccessory(this);
                    this.accessories.push(willSnowAccessory);
                    break;
                case 'any':
                case 'all':
                    debug("adding ANY sensor");
                    const isSnowyAccessory = new IsSnowyAccessory(this);
                    this.accessories.push(isSnowyAccessory);
            }
        }
        callback(this.accessories);
    },

    updateWeather: function () {
        const that = this;

        debug("updateWeather");
        that.station.snowingSoon(that.beforeSnowStarts)
            .then(() => {
                const wasSnowing = that.station.snowedRecently(that.afterSnowStops);
                const isSnowing = that.station.currentlySnowing;
                const willSnow = that.station.snowPredicted;
                const hasSnowed = that.station.hasSnowed;

                const isSnowy = wasSnowing || isSnowing || willSnow;
                debug("isSnowy=" + (isSnowy ? "YES" : "NO") +
                    " past=" + (hasSnowed ? "YES" : "NO") +
                    " now=" + (isSnowing ? "YES" : "NO") +
                    " willSnow=" + (willSnow ? "YES" : "NO"));

                for (let i = 0; i < that.accessories.length; i++) {
                    const snowTime = that.accessories[i].snowTime;
                    if (snowTime !== undefined) {
                        const service = that.accessories[i].service;
                        const curCharacteristic = service.getCharacteristic(Characteristic.OccupancyDetected);
                        const curValue = curCharacteristic ? curCharacteristic.value : 0;
                        let newValue = 0;
                        switch (snowTime) {
                            case "past":
                                newValue = hasSnowed ? 1 : 0;
                                break;
                            case "now":
                                newValue = isSnowing ? 1 : 0;
                                break;
                            case "future":
                                newValue = willSnow ? 1 : 0;
                                break;
                            case "any":
                                newValue = isSnowy? 1 : 0;
                                break;
                        }
                        if (curValue !== newValue) {
                            // if value has changed or hasn't been set, set the new value
                            that.log("Changing value of " + service.displayName + " from " + curValue + " to " + newValue);
                            service.setCharacteristic(Characteristic.OccupancyDetected, newValue);
                        }
                    }
                }
            });

        setTimeout(this.updateWeather.bind(this), (this.interval) * 60 * 1000);
    }
};

function IsSnowyAccessory(platform) {
    this.log = platform.log;
    this.name = "IsSnowy";
    this.snowTime = "any";

    this.service = new Service.OccupancySensor(this.name);

    this.informationService = new Service.AccessoryInformation();
    this.informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, "github.com/bbernstein")
        .setCharacteristic(Characteristic.Model, "SnowSense")
}

IsSnowyAccessory.prototype = {
    identify: function (callback) {
        const that = this;
        that.log("Identify IsSnowyAccessory!");
        callback();
    },

    getServices: function () {
        return [this.informationService, this.service];
    },
};

function IsSnowingAccessory(platform) {
    this.log = platform.log;
    this.name = "IsSnowing";
    this.snowTime = "now";
    this.service = new Service.OccupancySensor(this.name);

    this.informationService = new Service.AccessoryInformation();
    this.informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, "github.com/bbernstein")
        .setCharacteristic(Characteristic.Model, "SnowSense")
}

IsSnowingAccessory.prototype = {
    identify: function (callback) {
        const that = this;
        that.log("Identify IsSnowingAccessory!");
        callback();
    },

    getServices: function () {
        return [this.informationService, this.service];
    },
};

function WasSnowingAccessory(platform) {
    this.log = platform.log;
    this.name = "WasSnowing";
    this.snowTime = "past";
    this.service = new Service.OccupancySensor(this.name);

    this.informationService = new Service.AccessoryInformation();
    this.informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, "github.com/bbernstein")
        .setCharacteristic(Characteristic.Model, "SnowSense")
}

WasSnowingAccessory.prototype = {
    identify: function (callback) {
        const that = this;
        that.log("Identify WasSnowingAccessory!");
        callback();
    },

    getServices: function () {
        return [this.informationService, this.service];
    },
};


function WillSnowAccessory(platform) {
    this.log = platform.log;
    this.name = "WillSnow";
    this.snowTime = "future";
    this.service = new Service.OccupancySensor(this.name);

    this.informationService = new Service.AccessoryInformation();
    this.informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, "github.com/bbernstein")
        .setCharacteristic(Characteristic.Model, "SnowSense")
}

WillSnowAccessory.prototype = {
    identify: function (callback) {
        const that = this;
        that.log("Identify WillSnowAccessory!");
        callback();
    },

    getServices: function () {
        return [this.informationService, this.service];
    },
};

