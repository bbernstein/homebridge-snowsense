const debug = require('debug')('homebridge-snowwatch');
const weather = require('./Weather');

function SnowWatch(provider, apiKey, latitude, longitude, units, precipTempIsSnow) {
    this.latestForecast = null;
    this.latestForecastTime = null;
    this.precipTempIsSnow = precipTempIsSnow;

    this.lastTimeSnowForecasted = -1;
    this.currentlySnowing = false;
    this.snowPredicted = false;
    this.hasSnowed = false;

    this.weather = new weather.Weather(provider, apiKey, latitude, longitude, units);
}

SnowWatch.prototype.readWeather = async function () {
    return await this.weather.readWeather();
}

SnowWatch.prototype.getWeather = async function () {
    let now = Date.now();
    let cacheMillis = 1000 * 60 * 5;  // 5 minute cache, don't check more frequently than that
    if (this.latestForecast == null || this.latestForecastTime == null || this.latestForecastTime < now - cacheMillis) {
        debug("Reading new forecast at " + (new Date(now)).toLocaleTimeString());
        this.latestForecast = await this.readWeather();
        this.latestForecastTime = now;
    }
    return this.latestForecast;
};

SnowWatch.prototype.isSnowyEnough = function (forecast) {
    const ftime = new Date(forecast.dt * 1000);   // convert seconds to millis
    const result = (
            forecast.hasSnow
            || (this.precipTempIsSnow && forecast.temp <= this.precipTempIsSnow)
        )
        && forecast.hasPrecip;
    if (forecast.temp > 50) {
        debug("forecast: %o"+forecast);
    }
    debug("time=%s, precip=%s, temp=%s, snowTemp=%s, result=%s",
        ftime.toLocaleTimeString(), forecast.hasPrecip, forecast.temp, this.precipTempIsSnow, result ? "YES" : "NO");
    return result;
};

SnowWatch.prototype.snowedRecently = function (hoursInPast) {
    let now = Date.now();
    let millisInPast = now - hoursInPast * 60 * 60 * 1000;
    // if snow was in the forecast after (millisInPast), then it snowed recently
    const result = millisInPast < this.lastTimeSnowForecasted;
    if (result) {
        // just for debugging, not used elsewhere
        const howManyMinutesAgo = (now - this.lastTimeSnowForecasted) / (1000 * 60);
        debug("snowedRecently? " + (result ? "YES" : "NO") + " minutesAgo: " + howManyMinutesAgo);
    } else {
        // no snow in forecast and timeout has lapsed, forget about snow
        this.hasSnowed = false;
    }
    return result;
};

SnowWatch.prototype.snowingSoon = async function (hoursInFuture) {
    debug("Calling snowingSoon");
    const that = this;
    try {
        const result = await this.getWeather();

        const now = Date.now();
        let millisInFuture = now + hoursInFuture * 60 * 60 * 1000;

        let currentlySnowing = false;
        let snowPredicted = false;

        // if there is snow in the current hour, we're done
        debug("checking current conditions");
        if (that.isSnowyEnough(result.current)) {
            currentlySnowing = true;
            debug("snowing CURRENTLY");
        }

        // check for the next (hoursInFuture) hours if an snow-like icon is spotted
        debug("checking forecast hours");
        for (const hourWeather of result.hourly) {
            const hourMillis = hourWeather.dt * 1000;
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

        return false;
    } catch (e) {
        console.error("Error SnowWatch.prototype.snowingSoon", e);
    }
};

module.exports = {
    SnowWatch: SnowWatch
};