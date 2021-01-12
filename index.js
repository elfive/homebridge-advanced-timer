'use strict';

let Service, Characteristic, api;

const fs = require('fs');
const packageConfig = require('./package.json')

const INFINITE = 0;

const TRIGGER_TYPE_PULSE = 0;
const TRIGGER_TYPE_TTL = 1;

const ENABLE_STATUS_DISABLED = 0;
const ENABLE_STATUS_EABLED = 1;
const ENABLE_STATUS_LASTSTATUS = 2;

const TRIGGER_STATUS_NOTTRIGGERED = 0;
const TRIGGER_STATUS_TRIGGERED = 1;
const TRIGGER_STATUS_IGNORED = 2;
const TRIGGER_STATUS_LASTSTATUS = 2;

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
        this.config = config;
        this.services = [];
        this.timer_enabled = false;     // false for disabled, true for enabled
        this.timer_triggered = false;   // trigger status, false-not triggered, true-triggered
        this.timer_triggered_count = 0; // triggered count
        this.timer_timeout = null;      // setTimeout return value, for clearTimeout usage
    }

    getServices() {
        this.log.debug('begin to initialize advanced timer service.');
        const savedConfig = this.readStoragedConfigFromFile();
        
        var service_name = null;

        // check config usability
        this.log.debug('check config usability...');
        this.config = this.configCheck(this.config)
        if (!this.config) {
            this.log.error('config usability check failed.');
            return this.services;
        }
        this.log.debug('config usability check passed.');

        // timer enabled status after start
        var init_enable_status = false;
        switch (this.config.enable_status_when_start) {
            case ENABLE_STATUS_DISABLED:
                init_enable_status = false;
                break;
            case ENABLE_STATUS_EABLED:
                init_enable_status = true;
                break;
            case ENABLE_STATUS_LASTSTATUS:
            default:
                init_enable_status =
                    (savedConfig === undefined || savedConfig.last_enable_status === undefined ? false : savedConfig.last_enable_status);
                break;
        }
        this.timer_enabled = init_enable_status;

        // timer trigger status after start
        var init_trigger_status = false;
        if (this.config.trigger_type === TRIGGER_TYPE_TTL) {
            switch (this.config.trigger_status_when_start) {
                case TRIGGER_STATUS_NOTTRIGGERED:
                    init_trigger_status = false;
                    break;
                case TRIGGER_STATUS_TRIGGERED:
                    init_trigger_status = true;
                    break;
                case TRIGGER_STATUS_LASTSTATUS:
                default:
                    init_trigger_status =
                        (savedConfig === undefined || savedConfig.last_trigger_status === undefined ? false : savedConfig.last_trigger_status);
                break;
            }
        }
        this.timer_triggered = init_trigger_status;

        // timer enable switch service
        service_name = getConfigValue(this.config.enable_name, 'enable');               // service name
        this.enable_service = new Service.Switch(service_name, service_name);
        this.enable_service.setCharacteristic(Characteristic.On, init_enable_status);
        this.enable_service.getCharacteristic(Characteristic.On)
            .on('get', this.hb_get_enable.bind(this))
            .on('set', this.hb_set_enable.bind(this));
        this.services.push(this.enable_service);
        
        // timer trigger
        service_name = getConfigValue(this.config.trigger_name, 'trigger');             // service name
        this.timer_trigger = new Service.MotionSensor(service_name, service_name);
        this.__set_trigger_status(init_trigger_status);     // trigger status after homebridge restart
        this.timer_trigger.getCharacteristic(Characteristic.MotionDetected)
            .on('get', this.hb_get_trigger.bind(this));
        this.services.push(this.timer_trigger);

        this.log(packageConfig.author.name);
        // divice information
        this.info_service = new Service.AccessoryInformation();
        this.info_service
            .setCharacteristic(Characteristic.Identify, packageConfig.name)
            .setCharacteristic(Characteristic.Manufacturer, (packageConfig.author.name !== undefined ? packageConfig.author.name : "elfive@elfive.cn"))
            .setCharacteristic(Characteristic.Model, packageConfig.name)
            .setCharacteristic(Characteristic.SerialNumber, packageConfig.version)
            .setCharacteristic(Characteristic.Name, this.config.name)
            .setCharacteristic(Characteristic.FirmwareRevision, packageConfig.version);
            this.services.push(this.info_service);

        setTimeout(() => {
            if (init_enable_status) {
                this.start_trigger_service();
            } else {
                this.stop_trigger_service();
            }

        }, 500);

        this.log.debug('initialize advanced timer service finished.');
        return this.services;
    }

    readStoragedConfigFromFile() {
        var result = {};
        try {
            const filePath = api.user.storagePath() + '/advanced_timer.json';
            if (fs.existsSync(filePath)) {
                const rawdata = fs.readFileSync(filePath);
                if (JSON.parse(rawdata)[this.config.name] !== undefined) {
                    result = JSON.parse(rawdata)[this.config.name];
                }
            }
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
                if (result[this.config.name] !== undefined) {
                    result[this.config.name] = Object.assign(result[this.config.name], data)
                } else {
                    result[this.config.name] = data;
                }
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
        config.pulse_trigger_duration = getConfigValue(config.pulse_trigger_duration, 3) * 1000;

        // trigger intervals
        if (config.intervals === undefined) {
            this.log.error('missing config item: intervals.');
            return null;
        }
        config.intervals = config.intervals.split(',').map((value) => parseInt(value, 10) * 1000);
        if (config.trigger_type === TRIGGER_TYPE_PULSE &&
            !config.intervals.every((value) => value > config.pulse_trigger_duration)) {
            this.log.error('every interval should longer than pulse_trigger_duration(' + config.pulse_trigger_duration / 1000 + ' seconds).');
            return null;
        }
        
        // intervals repeat count, default 0(INFINITE)
        if (config.repeat === undefined) {
            this.log.debug('missing config item: repeat, using 0(infinite) instead.');
            config.repeat = INFINITE;
        }

        // service names
        if (config.enable_name === undefined) {
            this.log.debug('missing config item: service_names, using default name "Enable" instead.');
            config.enable_name = 'Enable';
        }
        if (config.trigger_name === undefined) {
            this.log.debug('missing config item: service_names, using default name "Trigger" instead.');
            config.trigger_name = 'Trigger';
        }

        // status after restart: 0-off, 1-on, 2-last status, default 2(ENABLE_STATUS_LASTSTATUS), 
        if (config.enable_status_when_start === undefined) {
            this.log.debug('missing config item: enable_status_when_start, using 2(Last statsu) instead.');
            config.enable_status_when_start = ENABLE_STATUS_LASTSTATUS;
        }

        return config;
    }

    __set_trigger_status(trigger_status) {
        this.timer_triggered = trigger_status;
        this.timer_trigger.setCharacteristic(Characteristic.MotionDetected, this.timer_triggered);
    }

    set_trigger_status() {
        if (this.timer_enabled) {
            if (this.config.trigger_type === TRIGGER_TYPE_PULSE) {    // pulse
                this.__set_trigger_status(true);
                this.log.debug('timer triggered status: pull up');
                setTimeout(() => {
                    this.__set_trigger_status(false);
                    this.log.debug('timer triggered status: pull down');
                }, this.config.pulse_trigger_duration);
                this.saveStoragedConfigToFile({last_trigger_status: false});
            } else {        // ttl
                this.__set_trigger_status(!this.timer_triggered);
                this.log.debug('timer triggered status: ' + (this.timer_triggered ? 'triggered' : 'not triggered'));
                this.saveStoragedConfigToFile({last_trigger_status: this.timer_triggered});
            }
        }
    }

    // trigger_all_intervals_once
    async trigger_all_intervals_once() {
        for (let index = 0; index < this.config.intervals.length; index++) {
            await new Promise(resolve => {
                this.log.debug('delay for ' + this.config.intervals[index] / 1000 + " seconds.");
                this.timer_timeout = setTimeout(() => {
                    this.timer_timeout = null;
                    this.set_trigger_status();
                    resolve();
                }, this.config.intervals[index])
            });
        }

        if (this.timer_enabled) {
            this.timer_triggered_count++;
            this.log.debug('triggered count: ' + this.timer_triggered_count);
        }
    }

    stop_trigger_service() {
        this.timer_enabled = false;
        if (null !== this.timer_timeout) {
            clearTimeout(this.timer_timeout);
            this.timer_timeout = null;
        }
        if (this.config.trigger_type === TRIGGER_TYPE_TTL) {    // ttl
            switch (this.config.trigger_status_while_disabled) {
                case TRIGGER_STATUS_NOTTRIGGERED:
                    this.__set_trigger_status(false);
                    this.log.debug("timer triggered status: not triggered");
                    break;
                case TRIGGER_STATUS_TRIGGERED:
                    this.__set_trigger_status(true);
                    this.log.debug("timer triggered status: triggered");
                    break;
                case TRIGGER_STATUS_IGNORED:
                default:
                    break;
            }
        }

        this.saveStoragedConfigToFile({last_enable_status: this.timer_enabled, last_trigger_status: this.timer_triggered});
        this.log('timer disabled.');
    }

    start_trigger_service() {
        this.timer_enabled = true;
        this.timer_triggered_count = 0;
        this.log('timer enabled.');
        
        if (this.config.trigger_type === TRIGGER_TYPE_TTL) {    // ttl
            switch (this.config.trigger_status_while_enabled) {
                case TRIGGER_STATUS_NOTTRIGGERED:
                    this.__set_trigger_status(false);
                    this.log.debug("timer triggered status: not triggered");
                    break;
                case TRIGGER_STATUS_TRIGGERED:
                    this.__set_trigger_status(true);
                    this.log.debug("timer triggered status: triggered");
                    break;
                case TRIGGER_STATUS_IGNORED:
                default:
                    break;
            }
        }
        this.saveStoragedConfigToFile({last_enable_status: this.timer_enabled, last_trigger_status: this.timer_triggered});

        const max_count = this.config.repeat;
        var trigger_function = () => {
            this.trigger_all_intervals_once()
            .catch()
            .then(() => {
                if (!this.timer_enabled) {
                    return;
                } else if (max_count !== INFINITE && this.timer_triggered_count >= max_count) {
                    this.stop_trigger_service();
                } else {
                    trigger_function();
                }
            });
        }

        trigger_function();
    }

    // get timer enable status
    hb_get_enable(callback) {
        callback(null, this.timer_enabled);
    }
    
    // set timer enable status
    hb_set_enable(value, callback) {
        if (value) {    // enable timer
            this.start_trigger_service();
        } else if (this.timer_enabled) {    // disabled timer
            this.stop_trigger_service();
        }
        callback(null);
    }

    // get timer trigger status
    hb_get_trigger(callback) {
        callback(null, this.timer_triggered);
    }
}