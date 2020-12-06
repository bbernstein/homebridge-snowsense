const debug = require('debug')('homebridge-snowwatch');
const axios = require('axios');

function Weather(provider, apiKey, latitude, longitude, units) {
    const lang = 'en';
    this.provider = provider;
    this.apiKey = apiKey;
    this.latitude = latitude;
    this.longitude = longitude;

    switch (provider) {
        case 'darksky':
            switch(units) {
                case 'imperial': units = 'us'; break;
                case 'metric': units = 'uk'; break;
                case 'standard': units = 'si'; break;
            }
            this.url = `https://api.darksky.net/forecast/${this.apiKey}/${this.latitude},${this.longitude}?lang=${lang}&units=${units}&exclude=minutely,daily,alerts,flags`;
            break;
        case 'openweathermap':
            this.url = `https://api.openweathermap.org/data/2.5/onecall?lat=${this.latitude}&lon=${this.longitude}&appid=${this.apiKey}&units=${units}&lang=${lang}&exclude=minutely,alerts,daily`;
            break;
    }
}

Weather.prototype.readWeather = async function () {
    debug(`Calling ${this.provider} API: ${this.url}`);
    const payload = await axios.get(this.url);
    switch(this.provider) {
        case 'openweathermap':
            return this.adjustForOpenWeatherMap(payload.data);
        case 'darksky':
            return this.adjustForDarkSky(payload.data);
    }
}


/**
 * Adjust a single forecast from openweathermap
 *
 * @param forecast
 */
Weather.prototype.adjustWeatherForOpenWeatherMap = function(forecast) {
    const hasSnow = !!(forecast.weather.find(elt => elt.main === 'Snow') || forecast.snow);
    const hasPrecip = !!(forecast.weather.find(elt => elt.main === 'Snow') ||  forecast.weather.find(elt => elt.main === 'Rain') || forecast.snow || forecast.rain);
    return {
        dt: forecast.dt,
        temp: forecast.temp,
        hasSnow: hasSnow,
        hasPrecip: hasPrecip
    }
}

/**
 * Adjust a full payload of data from openweathermap
 *
 * @param data an openweathermap payload
 */
Weather.prototype.adjustForOpenWeatherMap = function(data) {
    return {
        current: this.adjustWeatherForOpenWeatherMap(data.current),
        hourly: data.hourly.map(forecast => this.adjustWeatherForOpenWeatherMap(forecast))
    }
}

/**
 * Adjust a single forecast from darksky
 *
 * @param forecast
 */
Weather.prototype.adjustWeatherForDarkSky = function(forecast) {
    const hasSnow = forecast.precipType === 'snow' || forecast.precipType === 'sleet';
    const hasPrecip = forecast.precipIntensity > 0;
    return {
        dt: forecast.time,
        temp: forecast.temperature,
        hasSnow: hasSnow,
        hasPrecip: hasPrecip
    }
}

/**
 * Adjust a full payload from darksky
 *
 * @param data a darksky api payload
 */
Weather.prototype.adjustForDarkSky = function(data) {
    return {
        current: this.adjustWeatherForDarkSky(data.currently),
        hourly: data.hourly.data.map(forecast => this.adjustWeatherForDarkSky(forecast))
    }
}

module.exports = {
    Weather: Weather
};
