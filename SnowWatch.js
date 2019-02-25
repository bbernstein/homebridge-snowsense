'use strict';

var inherits = require('util').inherits,
debug = require('debug')('snowwatch'),
//debug = console.log,
DarkSky = require('dark-sky');


function SnowWatch(apiKey, latitude, longitude, precipProbabilityMin) {
  this.latestForecast = null;
  this.latestForecastTime = null;
  this.apiKey = apiKey;
  this.latitude = latitude;
  this.longitude = longitude;
  this.precipProbabilityMin = precipProbabilityMin

  this.lastTimeSnowForecasted = -1;
  this.currentlySnowing = false;
  this.snowPredicted = false;
  this.hasSnowed = false;

  this.client = new DarkSky(this.apiKey)
          .longitude(this.longitude)
          .latitude(this.latitude)
          .units('si')
          .language('en')
          .exclude('daily,minutely,flags,alerts');
}

SnowWatch.prototype.getWeather = function() {
  let that = this;
  var now = Date.now();
  var cacheMillis = 1000 * 60 * 5;  // 5 minute cache, don't check more frequently than that
  if (this.latestForecast == null || this.latestForecastTime == null || this.latestForecastTime < now - cacheMillis) {
    debug("Reading new forecast at "+(new Date(now)).toLocaleTimeString());
    this.latestForecast = this.client.get();
    this.latestForecastTime = now;
  }
  return this.latestForecast;
}

SnowWatch.prototype.isSnowyEnough = function(forecast) {
  let ftime = new Date(forecast.time * 1000);   // convert seconds to millis
  debug("snowy? time=" + ftime.toLocaleTimeString()
    + " precip=" + forecast.precipType 
    + ", prob=" + forecast.precipProbability 
    + ", minProb=" + this.precipProbabilityMin
    + ", enough? " + (forecast.precipProbability >= this.precipProbabilityMin));
  return (
        forecast.precipType == 'snow' 
      ||  forecast.precipType == 'sleet'
    )
    && forecast.precipProbability >= this.precipProbabilityMin;
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
    // just for debugging, not used elsewhere
    let howManyMinutesAgo = (this.lastTimeSnowForecasted - now) / (1000 * 60);
    debug("snowedRecently? "+result+" minutesAgo: "+howManyMinutesAgo);
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

    var currentlySnowing = false;
    var snowPredicted = false;

    // if there is snow in the current hour, we're done
    debug("checking current conditions");
    if (that.isSnowyEnough(result.currently)) {
      currentlySnowing = true;
      debug("snowing CURRENTLY");
    }

    // check for the next (hoursInFuture) hours if an snow-like icon is spotted
    debug("checking forecast hours");
    for(let hourWeather of result.hourly.data) {
      let hourMillis = hourWeather.time * 1000;
      if (hourMillis <= millisInFuture) {
        if (that.isSnowyEnough(hourWeather)) {
          snowPredicted = true;
          // break when we find a snowy hour
          debug("snowing LATER");
          break;
        }
      }
    }

    // in case we want to do anything with past/current/future snow
    that.currentlySnowing = currentlySnowing;
    that.snowPredicted = snowPredicted;
    that.hasSnowed = that.hasSnowed || currentlySnowing;

    if (that.currentlySnowing || that.snowPredicted) {
      that.lastTimeSnowForecasted = now;
      return true;
    }
    debug("NOT snowing now or soon");
    // no snow in forecast and timeout has lapsed, forget about snow
    that.hasSwowed = false;
    
    return false;
  })
}

module.exports = {
  SnowWatch: SnowWatch
}