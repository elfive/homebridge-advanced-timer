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

module.exports = function (homebridge) {
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
        this.timer_start_delay_timeout = null;      // setTimeout return value, for clearTimeout usage
        this.timer_stop_delay_timeout = null;      // setTimeout return value, for clearTimeout usage
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
                    if (savedConfig !== undefined || savedConfig.last_trigger_status !== undefined) {
                        init_trigger_status = savedConfig.last_trigger_status
                    };
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
                this.start_trigger_service(false);
            } else {
                this.stop_trigger_service(true);
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
        var result = false;
        const filePath = api.user.storagePath() + '/advanced_timer.json';
        try {       // read
            if (fs.existsSync(filePath)) {
                const original_data = fs.readFileSync(filePath);
                result = JSON.parse(original_data);
            }
        } catch (error) {
            this.log.error('readFileSync failed: ' + error);
        }

        try {       // write
            if (result && result[this.config.name] !== undefined) {
                result[this.config.name] = Object.assign(result[this.config.name], data)
            } else {
                result = {};
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

        // trigger plan
        if (config.intervals === undefined) {
            this.log.error('missing config item: intervals.');
            return null;
        }
        config.intervals = config.intervals.split(',').map((value) => parseInt(value, 10));

        // intervals repeat count, default 0(INFINITE)
        config.repeat = getConfigValue(config.repeat, INFINITE);

        // service names
        config.enable_name = getConfigValue(config.enable_name, 'Enable');
        config.trigger_name = getConfigValue(config.trigger_name, 'Trigger');

        // trigger type, defalut 1(TRIGGER_TYPE_TTL)
        config.trigger_type = getConfigValue(config.trigger_type, TRIGGER_TYPE_TTL);
        
        // start delay(s)
        config.start_delay = getConfigValue(config.start_delay, 0);

        // stop delay(s)
        config.stop_delay = getConfigValue(config.stop_delay, 0);
        
        if (config.trigger_type === TRIGGER_TYPE_PULSE) {   // trigger type: pulse
            // trigger plan
            if (!config.intervals.every((value) => value > config.pulse_trigger_duration)) {
                this.log.error('every interval should longer than pulse_trigger_duration(' + config.pulse_trigger_duration + ')');
                return null;
            }

            // trigger duration(s)
            config.pulse_trigger_duration = getConfigValue(config.pulse_trigger_duration, 3);
        } else {                                            // trigger type: ttl
            // init enabled status: 0-disable, 1-enable, 2-last status, default 2(ENABLE_STATUS_LASTSTATUS), 
            config.enable_status_when_start = getConfigValue(config.enable_status_when_start, ENABLE_STATUS_LASTSTATUS);
            
            // init trigger status: 0-off, 1-on, 2-last status, default 2(TRIGGER_STATUS_LASTSTATUS), 
            config.trigger_status_when_start = getConfigValue(config.trigger_status_when_start, TRIGGER_STATUS_LASTSTATUS);

            // status after enabled: 0-off, 1-on, 2-last status, default 2(TRIGGER_STATUS_LASTSTATUS), 
            config.trigger_status_while_enabled = getConfigValue(config.trigger_status_while_enabled, TRIGGER_STATUS_LASTSTATUS);
            
            // status after disabled: 0-off, 1-on, 2-last status, default 2(TRIGGER_STATUS_IGNORED), 
            config.trigger_status_while_disabled = getConfigValue(config.trigger_status_while_disabled, TRIGGER_STATUS_IGNORED);
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
                }, this.config.pulse_trigger_duration * 1000);
                this.saveStoragedConfigToFile({
                    last_trigger_status: false
                });
            } else {        // ttl
                this.__set_trigger_status(!this.timer_triggered);
                this.log.debug('timer triggered status: ' + (this.timer_triggered ? 'triggered' : 'not triggered'));
                this.saveStoragedConfigToFile({
                    last_trigger_status: this.timer_triggered
                });
            }
        }
    }

    // trigger_all_intervals_once
    async trigger_all_intervals_once() {
        for (let index = 0; index < this.config.intervals.length; index++) {
            await new Promise(resolve => {
                this.log.debug('delay for ' + this.config.intervals[index] + " second(s).");
                this.timer_timeout = setTimeout(() => {
                    this.timer_timeout = null;
                    this.set_trigger_status();
                    resolve();
                }, this.config.intervals[index] * 1000)
            });
        }

        if (this.timer_enabled) {
            this.timer_triggered_count++;
            this.log.debug('triggered count: ' + this.timer_triggered_count);
        }
    }

    stop_trigger_service(skip_delay = false) {
        this.timer_enabled = false;
        if (null !== this.timer_timeout) {
            clearTimeout(this.timer_timeout);
            this.timer_timeout = null;
        }
        if (null !== this.timer_start_delay_timeout) {
            this.log.debug('clear last start delay process.');
            clearTimeout(this.timer_start_delay_timeout);
            this.timer_start_delay_timeout = null;
        }

        var set_disabled_trigger_status = () => {
            this.timer_stop_delay_timeout = null;
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
        };

        if (!skip_delay && this.config.stop_delay > 0) {
            this.timer_stop_delay_timeout = setTimeout(set_disabled_trigger_status, this.config.stop_delay * 1000);
            this.log('timer disabled, but trigger status will delay ' + this.config.stop_delay + ' second(s) to reset.');
        } else {
            set_disabled_trigger_status();
            this.log('timer disabled.');
        }
        this.saveStoragedConfigToFile({
            last_enable_status: this.timer_enabled,
            last_trigger_status: this.timer_triggered
        });
    }

    start_trigger_service(skip_delay = false) {
        if (null !== this.timer_stop_delay_timeout) {
            this.log.debug('clear last stop delay process.');
            clearTimeout(this.timer_stop_delay_timeout);
            this.timer_stop_delay_timeout = null;
        }

        this.timer_enabled = true;
        this.timer_triggered_count = 0;
        this.log('timer enabled.');

        if (this.config.trigger_type === TRIGGER_TYPE_TTL) {    // ttl
            var start_trigger_status = false;
            switch (this.config.trigger_status_while_enabled) {
                case TRIGGER_STATUS_NOTTRIGGERED:
                    start_trigger_status = false;
                    break;
                case TRIGGER_STATUS_TRIGGERED:
                    start_trigger_status = true;
                    break;
                case TRIGGER_STATUS_LASTSTATUS:
                default:
                    const savedConfig = this.readStoragedConfigFromFile();
                    if (savedConfig !== undefined && savedConfig.last_trigger_status !== undefined) {
                        start_trigger_status = savedConfig.last_trigger_status;
                    }
                    break;
            }
            this.__set_trigger_status(start_trigger_status);
            this.log.debug("timer triggered status: " + (start_trigger_status ? 'triggered' : 'not triggered'));
        }

        this.saveStoragedConfigToFile({
            last_enable_status: this.timer_enabled,
            last_trigger_status: this.timer_triggered
        });

        var trigger_function = () => {
            this.timer_start_delay_timeout = null;
            this.trigger_all_intervals_once()
            .catch()
            .then(() => {
                if (!this.timer_enabled) {
                    return;
                } else if (this.config.repeat !== INFINITE && this.timer_triggered_count >= this.config.repeat) {
                    this.stop_trigger_service(false);
                } else {
                    trigger_function();
                }
            });
        }

        if (!skip_delay && this.config.start_delay > 0) {
            this.timer_start_delay_timeout = setTimeout(trigger_function, this.config.start_delay * 1000);
            this.log('delay ' + this.config.start_delay + ' second(s) after timer enabled.');
        } else {
            trigger_function();
        }
    }

    // get timer enable status
    hb_get_enable(callback) {
        callback(null, this.timer_enabled);
    }

    // set timer enable status
    hb_set_enable(value, callback) {
        if (value) {    // enable timer
            this.start_trigger_service(false);
        } else if (this.timer_enabled) {    // disabled timer
            this.stop_trigger_service(false);
        }
        callback(null);
    }

    // get timer trigger status
    hb_get_trigger(callback) {
        callback(null, this.timer_triggered);
    }
}