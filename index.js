"use strict";
var inherits = require('util').inherits, 
debug = require('debug')('homebridge-snowswitch'),
snowwatch = require('./SnowWatch'),
Service,
Characteristic;

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerPlatform("homebridge-snowswitch", "SnowSwitch", SnowSwitchPlatform);
}

function SnowSwitchPlatform(log, config) {
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

	this.interval = ('forecastFrequency' in config ? parseInt(config['forecastFrequency']) : 4);
	this.interval = (typeof this.interval !=='number' || (this.interval%1)!==0 || this.interval < 0) ? 4 : this.interval;

	// number of hours to consider "snowing soon" or "snowed recently"
	this.beforeSnowStarts = ('beforeSnowStarts' in config ? parseInt(config['beforeSnowStarts']) : 3);
	this.beforeSnowStarts = (typeof this.beforeSnowStarts !=='number' || (this.beforeSnowStarts%1)!==0 || this.beforeSnowStarts < 0) ? 3 : this.beforeSnowStarts;
	this.afterSnowStops = ('afterSnowStops' in config ? parseInt(config['afterSnowStops']) : 3);
	this.afterSnowStops = (typeof this.afterSnowStops !=='number' || (this.afterSnowStops%1)!==0 || this.afterSnowStops < 0) ? 3 : this.afterSnowStops;

	this.updateWeather();
}

SnowSwitchPlatform.prototype = {
	accessories: function(callback) {
		this.accessories = [];
		
		let isSnowyAccessory = new IsSnowyAccessory(this);
		this.accessories.push(isSnowyAccessory);

		callback(this.accessories);
	},

	updateWeather: function() {
		let that = this;

		debug("updateWeather");
		that.station.snowingSoon(that.beforeSnowStarts)
			.then(isSnowingSoon => {
				let isSnowy = isSnowingSoon || that.station.snowedRecently(that.afterSnowStops);
				debug("isSnowy="+isSnowy);
				for (var i = 0; i < that.accessories.length; i++) {
					if (that.accessories[i].isSnowyService !== undefined) {
						let service = that.accessories[i].isSnowyService;
						let curCharacteristic = service.getCharacteristic(Characteristic.On);
						var curValue = false;
						if (curCharacteristic != undefined) {
							curValue = curCharacteristic.value;
						}
						debug("Current value of "+service.displayName+"="+curCharacteristic.value+". New value="+isSnowy);
						if (curValue != isSnowy) {
							// if value has changed or hasn't been set, set the new value
							that.log("Changing value of " + service.displayName + " from " + curValue + " to "+isSnowy);
							service.setCharacteristic(Characteristic.On, isSnowy);
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

	this.isSnowyService = new Service.Switch(this.name);

	this.informationService = new Service.AccessoryInformation();
	this.informationService
	.setCharacteristic(Characteristic.Name, this.name)
	.setCharacteristic(Characteristic.Manufacturer, "github.com/bbernstein")
	.setCharacteristic(Characteristic.Model, "SnowSwitch")
}

IsSnowyAccessory.prototype = {
	identify: function (callback) {
		let that = this;
		that.log("Identify!");
		callback();
	},

	getServices: function () {
		return [this.informationService, this.isSnowyService];
	},
}
