'use strict';

var inherits = require('util').inherits,
debug = require('debug')('snowwatch'),
DarkSky = require('dark-sky');


function SnowWatch(apiKey, latitude, longitude) {
	this.latestForecast = null;
	this.latestForecastTime = null;
	this.lastTimeSnowForecasted = -1;
	this.apiKey = apiKey;
	this.latitude = latitude;
	this.longitude = longitude;
}

SnowWatch.prototype.getWeather = function() {
	var client = new DarkSky(this.apiKey);

	var options = {
	  units: 'si',
	  exclude: 'daily,minutely,flags'
	};

	var now = Date.now();
	var cacheMillis = 1000 * 60 * 5;	// 5 minute cache, don't check more frequently than that
	if (this.latestForecast == null || this.latestForecastTime == null || this.latestForecastTime < now - cacheMillis) {
		debug("Reading new forecast at "+now);

		this.latestForecast = 
			client
				.latitude(this.latitude)
				.longitude(this.longitude)
				.units('si')
				.language('en')
				.exclude('daily,minutely,flags')
				.get()
		this.latestForecastTime = now;
	}
	return this.latestForecast;
}

SnowWatch.prototype.isSnowyEnough = function(forecast) {
	return (
				forecast.precipType == 'snow' 
			||	forecast.precipType == 'sleet'
		)
		&& forecast.precipProbability > 0.5;
}

SnowWatch.prototype.iconMeansSnow = function(icon) {
	// https://darksky.net/dev/docs
	// all icons that have snow-like conditions have "snow" or "sleet" in them
	// an alternative implementation might be to check precipType for the same
	return icon && (
				icon.includes("snow") 
				|| icon.includes("sleet")
			);
}

SnowWatch.prototype.lastSnowPrediction = function() {
	return this.lastTimeSnowForecasted;
}

SnowWatch.prototype.snowedRecently = function(hoursInPast) {
	var now = Date.now();
	var millisInPast = now - hoursInPast * 60 * 60 * 1000;
	// if snow was in the forecast after (millisInPast), then it snowed recently
	let result = millisInPast < this.lastTimeSnowForecasted;
	if (result) {
		let howLongAgo = (this.lastTimeSnowForecasted - now) / (1000 * 60);
		debug("snowedRecently? "+result+" minutesAgo: "+howLongAgo);
	}
	return result;
}

SnowWatch.prototype.snowingSoon = function(hoursInFuture) {
	debug("Calling snowingSoon");
	let that = this;
	return this.getWeather().then(result => {

		// debug("forecast: "+JSON.stringify(result, null, '  '));

		let now = Date.now();
		var nowDate = new Date(now);
		var millisInFuture = now + hoursInFuture * 60 * 60 * 1000;

		// if there is snow in the current hour, we're done
		if (that.isSnowyEnough(result.currently)) {
			that.lastTimeSnowForecasted = now;
			debug("snowing CURRENTLY");
			return true;
		}

		// check for the next (hoursInFuture) hours if an snow-like icon is spotted
		for(let hourWeather of result.hourly.data) {
			let hourMillis = hourWeather.time * 1000;
			if (hourMillis <= millisInFuture) {
				if (that.isSnowyEnough(hourWeather)) {
					that.lastTimeSnowForecasted = now;
					// break when we find a snowy hour
					debug("snowing SOON");
					return true;
				}
			}
		}
		// no snow was found above
		debug("NOT snowing currently or soon");
		return false;
	})
}

module.exports = {
	SnowWatch: SnowWatch
}