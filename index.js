"use strict";
var inherits = require('util').inherits, 
debug = require('debug')('homebridge-weather-station-extended'),
wunderground = require('wundergroundnode'),
Service,
Characteristic;

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerPlatform("homebridge-snowswitch", "SnowSwitch", SnowSwitchPlatform);
}

function SnowSwitchPlatform(log, config) {
	this.log = log;
	this.config = config;
	this.location = config['location'];
	this.forecastDays = ('forecast' in config ? config['forecast'] : '');
	this.station = new wunderground(config['key']);
	this.interval = ('interval' in config ? parseInt(config['interval']) : 4);
	this.interval = (typeof this.interval !=='number' || (this.interval%1)!==0 || this.interval < 0) ? 4 : this.interval;

	// number of hours to consider "snowing soon" or "snowed recently"
	this.snowHoursWindow = ('snowhours' in config ? parseInt(config['snowhours']) : 3);
	this.snowHoursWindow = (typeof this.snowHoursWindow !=='number' || (this.snowHoursWindow%1)!==0 || this.snowHoursWindow < 0) ? 3 : this.snowHoursWindow;

	// assume it hasn't snowed recently by default
	this.lastSnowTime = new Date(0);

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

		debug("Update weather online");
		this.station.conditions().hourlyForecast().request(this.location, function(err, response) {
			if (!err) {
				let futureHours = response['hourly_forecast'];
				let conditions = response['current_observation'];
				
				
				// check if snowing now or in the next few hours (condition 3 is frozen stuff)
				let snowSoon = getConditionCategory(conditions['icon']) == 3;
				for (let hr=0; hr < that.snowHoursWindow; hr++) {
					snowSoon = snowSoon || (getConditionCategory(futureHours[hr]['icon']) == 3);
				}

				let snowedRecently = snowSoon;

				let now = new Date();
				if (snowSoon){
					that.lastSnowTime = now;
				}
				else {
					let recentMillis = 1000 * 60 * 60 * that.snowHoursWindow;	// hours to millis
					snowedRecently = (now.getTime() - that.lastSnowTime.getTime() < recentMillis)
				}

				for (var i = 0; i < that.accessories.length; i++) {
					if (that.accessories[i].isSnowyService !== undefined 
						&& response['current_observation']
						&& response['hourly_forecast'] )
					{
						debug("Update values for " + that.accessories[i].isSnowyService.displayName);
						let service = that.accessories[i].isSnowyService;

						service.setCharacteristic(Characteristic.On, snowedRecently);
					}
				}

				if (!response['current_observation'])
				{
					that.log.error("Found no current observations");
					that.log.error(response);
				}
				if (!response['hourly_forecast'])
				{
					that.log.error("Found no hourly forecast");
					that.log.error(response);
				}
			}
			else {
				that.log.error("Error retrieving weather");
				that.log.error(response);
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
		this.platform.station.conditions().request(this.platform.location, function(err, response) {
			if (err) {
				that.log.error(err);
			}
			else {
				that.log(response);
			}
		});
		callback();
	},

	getServices: function () {
		return [this.informationService, this.isSnowyService];
	},
}

function getConditionCategory(icon) {
	switch (icon) {
		case "snow":
		case "sleet":
		case "flurries":
		case "chancesnow":
		case "chancesleet":
		case "chanceflurries":
			return 3;
		case "rain":
		case "tstorms":
		case "chancerain":
		case "chancetstorms":
			return 2;
		case "cloudy":
		case "mostlycloudy":
		case "partlysunny":
		case "fog":
		case "hazy":
			return 1;
		case "partlycloudy":
		case "mostlysunny":
		case "sunny":
		case "clear":
		default:
			return 0;
	}
}