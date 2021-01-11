'use strict';

let Service, Characteristic, api;

const fs = require('fs');
const packageConfig = require('./package.json')

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    api = homebridge;
    homebridge.registerAccessory('homebridge-advanced-timer', 'advanced_timer', advanced_timer_plugin);
}

function getConfigValue(original, default_value) {
    return (original !== undefined ? original : default_value);
}

class advanced_timer_plugin {
    constructor(log, config) {
        this.log = log;
        this.services = [];
        this.timer_status = false;      // false for disabled, true for enabled
        this.config = null;
        this.status = 0;        // timer status, 0-stopped, 1-started
        this.triggered = false; // trigger status, false-not triggered, true-triggered
        this.triggered_count = 0;
        this.config = config;
    }

    getServices() {
        var service_name = null;

        this.log('check config usability...');
        config = this.configCheck(config)
        if (!config) {
            this.log.error('config usability check failed.');
            return this.services;
        }
        this.log('config usability check passed.');

        this.log('begin to initialize advanced timer service.');
        // timer enable switch service
        service_name = getConfigValue(this.config.enable_name, 'enable');               // service name
        this.enable_service = new Service.Switch(service_name, service_name);
        this.enable_service.getCharacteristic(Characteristic.On)
            .on('get', this.hb_get_enable.bind(this))
            .on('set', this.hb_set_enable.bind(this));
        this.services.push(this.enable_service);

        var timer_init_status = false;
        switch (this.config.status_after_restart) {
            case 0:
                timer_init_status = false;
            case 1:
                timer_init_status = true;
            case 2:
            default:
                const config = this.readStoragedConfigFromFile();
                if (config !== undefined && config.last_status !== undefined) {
                    timer_init_status = getConfigValue(config.last_status, false);
                } else {
                    timer_init_status = false;
                }
        }

        // timer trigger
        service_name = getConfigValue(this.config.trigger_name, 'trigger');             // service name
        this.timer_trigger = new Service.MotionSensor(service_name, service_name);
        this.timer_trigger.setCharacteristic(Characteristic.MotionDetected, timer_init_status);     // status after homebridge restart
        this.timer_trigger.getCharacteristic(Characteristic.MotionDetected)
            .on('get', this.hb_get_trigger.bind(this));
        this.services.push(this.timer_trigger);

        // divice information
        this.info_service = new Service.AccessoryInformation();
        this.info_service
            .setCharacteristic(Characteristic.Identify, packageConfig['name'])
            .setCharacteristic(Characteristic.Manufacturer, packageConfig['author'])
            .setCharacteristic(Characteristic.Model, packageConfig['name'])
            .setCharacteristic(Characteristic.SerialNumber, packageConfig['version'])
            .setCharacteristic(Characteristic.Name, this.config.name)
            .setCharacteristic(Characteristic.FirmwareRevision, packageConfig['version']);
            this.services.push(this.info_service);

        this.log('initialize advanced timer service finished.');
        setTimeout(() => {
            if (timer_init_status) {
                this.start_trigger_service();
            } else {
                this.stop_trigger_service();
            }
        }, 1000);
        return this.services;
    }

    readStoragedConfigFromFile() {
        var result = {};
        try {
            const filePath = api.user.storagePath() + '/advanced_timer.json';
            if (!fs.existsSync(filePath)) return {};
            const rawdata = fs.readFileSync(filePath);
            result = JSON.parse(rawdata)[this.config.name];
        } catch (error) {
            this.log.error('readstoragedConfigFromFile failed: ' + error);
        } finally {
            return result;
        }
    }

    saveStoragedConfigToFile(data) {
        var result = {};
        try {
            const filePath = api.user.storagePath() + '/advanced_timer.json';
            if (fs.existsSync(filePath)) {
                const original_data = fs.readFileSync(filePath);
                result = JSON.parse(original_data);
                result[this.config.name] = Object.assign(result[this.config.name], data)
            } else {
                result[this.config.name] = data;
            }

            const rawdata = JSON.stringify(result);
            fs.writeFileSync(filePath, rawdata);
            return true;
        } catch (error) {
            this.log.error('saveStoragedConfigToFile failed: ' + error);
        }
    }

    // config usability check
    // return valid config or null
    configCheck(config) {
        // name
        config.name = getConfigValue(config.name, 'AdvancedTimer');

        // trigger duration
        config.trigger_duration = getConfigValue(config.trigger_duration, 3) * 1000;

        // trigger intervals
        if (config.intervals === undefined) {
            this.log.error('missing config item: intervals.');
            return null;
        }
        config.intervals = config.intervals.split(',').map((value) => parseInt(value, 10) * 1000);

        // intervals repeat count, default -1
        if (config.repeat === undefined) {
            this.log('missing config item: repeat, using -1 instead.');
            config.repeat = -1;
        }

        // service names
        // if (config.service_names === undefined) {
        //     this.log('missing config item: service_names, using default name instead.');
        // }

        // status after restart: 0-off, 1-on, 2-last status, default 2, 
        if (config.status_after_restart === undefined) {
            this.log('missing config item: status_after_restart, using 2 instead.');
            config.status_after_restart = 2;
        }

        return config;
    }

    set_trigger() {
        if (this.timer_status) {
            this.triggered = true;
            this.log.debug('timer triggered.');
            this.timer_trigger.setCharacteristic(Characteristic.MotionDetected, this.triggered);
            setTimeout(() => {
                this.triggered = false;
                this.timer_trigger.setCharacteristic(Characteristic.MotionDetected, this.triggered);
            }, this.config.trigger_duration);
        }
    }

    // trigger_all_intervals_once
    async trigger_all_intervals_once() {
        for (let index = 0; index < this.config.intervals.length; index++) {
            await new Promise(resolve => {
                setTimeout(() => {
                    this.set_trigger();
                    resolve();
                }, this.config.intervals[index])
            });
        }

        if (this.timer_status) {
            this.triggered_count++;
            this.log.debug('triggered count: ' + this.triggered_count);
        }
    }

    stop_trigger_service() {
        this.timer_status = false;
        this.saveStoragedConfigToFile({last_status: this.timer_status});
        this.log('timer disabled.');
    }

    start_trigger_service() {
        if (this.timer_status) {
            this.log.debug('timer service aready started.');
            return;
        }
        this.timer_status = true;
        this.triggered_count = 0;
        this.saveStoragedConfigToFile({last_status: this.timer_status});
        this.log('timer enabled.');
        
        const max_count = this.config.repeat;
        var trigger_function = () => {
            this.trigger_all_intervals_once()
            .catch()
            .then(() => {
                if (!this.timer_status) {
                    return;
                } else if (max_count !== -1 && this.triggered_count >= max_count) {
                    this.stop_trigger_service();
                } else {
                    trigger_function();
                }
            });
        }

        if(this.config.trigger_at_start) {
            this.set_trigger();
        }
        trigger_function();
    }

    // get timer enable status
    hb_get_enable(callback) {
        callback(null, this.timer_status);
    }
    
    // set timer enable status
    hb_set_enable(value, callback) {
        if (value) {    // enable timer
            this.start_trigger_service();
        } else if (this.timer_status) {    // disabled timer
            this.stop_trigger_service();
        }
        callback(null);
    }

    // get timer trigger status
    hb_get_trigger(callback) {
        callback(null, this.triggered);
    }
}