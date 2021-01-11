## homebridge-advanced-timer
<p align="center">
  <a href="https://www.npmjs.com/package/homebridge-advanced-timer">
    <img src="https://flat.badgen.net/npm/v/homebridge-advanced-timer" alt="NPM Version" />
  </a>
  <br>
  <strong><a href="#2-how-to-setup">Setup Guide</a> | <a href="#4-how-to-contribute">Contribute</a> </strong>
</p>

## 1) Description

advanced timer, get full use of iOS automation.



### features

- controled by a Homekit switch, easy to control.
- setting up interval plan, and can loop infinite or loop certain cycles.



### limitations

- after homebridge restart, can only start from the loop beginning
- ......



### examples

- every 30 mins, heat your room for 10 mins.
- check home temperature every 5 mins, and change heater target temperature.
- ......



## 2) Configure

### config.json field

|     field   name     |  type  | required |     default     |    range    | description                                                  |
| :------------------: | :----: | :------: | :-------------: | :---------: | ------------------------------------------------------------ |
|         name         | string |   yes    | 'AdvancedTimer' |     ---     | device name shows in HomeKit. we don't need it, but homebridge need it. |
|      intervals       | string |   yes    |       ''        |     ---     | Comma-separated trigger plan, every interval(in second) should longer than trigger_duration below. |
|        repeat        |  int   |   yes    |       -1        | -1 to 86400 | How many trigger plan cycles repeat, -1 for infinite loop.   |
|     enable_name      | string |    no    |    'Enable'     |     ---     | Timer enable switch name shows in HomeKit                    |
|     trigger_name     | string |    no    |    'Trigger'    |     ---     | Timer trigger indicator name shows in HomeKit.               |
|   trigger_at_start   |  bool  |    no    |      true       | true/false  | Trigger at service start without delay.                      |
| status_after_restart |  int   |    no    |        2        |   0, 1, 2   | Enable status after Homebridge restart.<br/>0: OFF,<br/>1: ON,<br/>2: Status before restart. |
|   trigger_duration   |  int   |    no    |        3        |   1 to 3    | Each time a trigger signal last duration, in second          |



### example of config.json file

```json
"accessories": [
    {
        "name": "heater_timer",
        
        // trigger plan:
        // trigger after 5min then trigger after 10min, means trigger at 5min and 15min
        "intervals": "5,10",
        
        // repeat trigger plan for 4 times
        "repeat": 4,
        "enable_name": "Enable",
        "trigger_name": "Trigger",
        "trigger_at_start": true,
        "status_after_restart": 2,
        "trigger_duration": 3,
        "accessory": "advanced_timer"
    }
]
```



## 4) How to contribute

everyone is welcome to contribute to this plugin. PR/issue/debug all are welcome.

or you can send me an e-mail: elfive@elfive.cn
