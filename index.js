"use strict";
var inherits = require('util').inherits, 
debug = require('debug')('homebridge-snowsense'),
snowwatch = require('./SnowWatch'),
Service,
Characteristic;

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerPlatform("homebridge-snowsense", "SnowSense", SnowSensePlatform);
}

function SnowSensePlatform(log, config) {
  this.log = log;
  let key = config['key']
  let latitude = config['latitude']
  let longitude = config['longitude']

  // minimum probability of snow to consider it "snowy". Default 50% (0.5)
  var precipProbabilityMin = ('precipProbabilityMin' in config ? config['precipProbabilityMin'] : 0.5)
  if (typeof precipProbabilityMin != 'number' || precipProbabilityMin < 0 || precipProbabilityMin > 1.0) {
    precipProbabilityMin = 0.5
  }

  this.station = new snowwatch.SnowWatch(key, latitude, longitude, precipProbabilityMin);

  this.interval = ('forecastFrequency' in config ? parseInt(config['forecastFrequency']) : 15);
  this.interval = (typeof this.interval !=='number' || (this.interval%1)!==0 || this.interval < 0) ? 15 : this.interval;

  // number of hours to consider "snowing soon" or "snowed recently"
  this.beforeSnowStarts = ('beforeSnowStarts' in config ? parseInt(config['beforeSnowStarts']) : 3);
  this.beforeSnowStarts = (typeof this.beforeSnowStarts !=='number' || (this.beforeSnowStarts%1)!==0 || this.beforeSnowStarts < 0) ? 3 : this.beforeSnowStarts;
  this.afterSnowStops = ('afterSnowStops' in config ? parseInt(config['afterSnowStops']) : 3);
  this.afterSnowStops = (typeof this.afterSnowStops !=='number' || (this.afterSnowStops%1)!==0 || this.afterSnowStops < 0) ? 3 : this.afterSnowStops;

  this.sensorConfig = ('sensors' in config ? config['sensors'] : '');
  if (this.sensorConfig == '') {
    this.sensorConfig = 'past,present,future,any';
  }

  this.updateWeather();
}

SnowSensePlatform.prototype = {
  accessories: function(callback) {
    this.accessories = [];
    
    for (let sensor of this.sensorConfig.split(",")) {
      switch(sensor.trim().toLowerCase()) {
        case 'past':
          debug("adding PAST sensor");
          let wasSnowingAccessory = new WasSnowingAccessory(this);
          this.accessories.push(wasSnowingAccessory);
          break;
        case 'present':
        case 'now':
          debug("adding PRESENT sensor");
          let isSnowingAccessory = new IsSnowingAccessory(this);
          this.accessories.push(isSnowingAccessory);
          break;
        case 'future':
        case 'later':
          debug("adding FUTURE sensor");
          let willSnowAccessory = new WillSnowAccessory(this);
          this.accessories.push(willSnowAccessory);
          break;
        case 'any':
        case 'all':
          debug("adding ANY sensor");
          let isSnowyAccessory = new IsSnowyAccessory(this);
          this.accessories.push(isSnowyAccessory);
      }
    }





    callback(this.accessories);
  },

  updateWeather: function() {
    let that = this;

    debug("updateWeather");
    that.station.snowingSoon(that.beforeSnowStarts)
      .then(isSnowingSoon => {
        let wasSnowing = that.station.snowedRecently(that.afterSnowStops);
        let isSnowing = that.station.currentlySnowing;
        let willSnow = that.station.snowPredicted;
        let hasSnowed = that.station.hasSnowed;

        let isSnowy = wasSnowing || isSnowing || willSnow;
        debug("isSnowy="+isSnowy+" past="+hasSnowed+" now="+isSnowing+" willSnow="+willSnow);
        for (var i = 0; i < that.accessories.length; i++) {
          let snowTime = that.accessories[i].snowTime;
          if (snowTime !== undefined) {
            let service = that.accessories[i].service;
            let curCharacteristic = service.getCharacteristic(Characteristic.OccupancyDetected);
            var curValue = false;
            if (curCharacteristic != undefined) {
              curValue = curCharacteristic.value;
            }
            var newValue = false;
            switch (snowTime) {
              case "past":
                newValue = hasSnowed;
                break;
              case "now":
                newValue = isSnowing;
                break;
              case "future":
                newValue = willSnow;
                break;
              case "any":
                newValue = isSnowy;
                break;
            }
            if (curValue != newValue) {
              // if value has changed or hasn't been set, set the new value
              that.log("Changing value of " + service.displayName + " from " + curValue + " to "+newValue);
              service.setCharacteristic(Characteristic.OccupancyDetected, newValue);
            }
          }
        }
      });

    setTimeout(this.updateWeather.bind(this), (this.interval) * 60 * 1000);
  }
}

function IsSnowyAccessory(platform) {
  this.platform = platform;
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
    let that = this;
    that.log("Identify!");
    callback();
  },

  getServices: function () {
    return [this.informationService, this.service];
  },
}

function IsSnowingAccessory(platform) {
  this.platform = platform;
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
    let that = this;
    that.log("Identify!");
    callback();
  },

  getServices: function () {
    return [this.informationService, this.service];
  },
}

function WasSnowingAccessory(platform) {
  this.platform = platform;
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
    let that = this;
    that.log("Identify!");
    callback();
  },

  getServices: function () {
    return [this.informationService, this.service];
  },
}


function WillSnowAccessory(platform) {
  this.platform = platform;
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
    let that = this;
    that.log("Identify!");
    callback();
  },

  getServices: function () {
    return [this.informationService, this.service];
  },
}

