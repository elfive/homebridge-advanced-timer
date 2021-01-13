  ## homebridge-advanced-timer
  <p align="center">
    <a href="https://www.npmjs.com/package/homebridge-advanced-timer">
      <img src="https://flat.badgen.net/npm/v/homebridge-advanced-timer" alt="NPM Version" />
    </a>
    <a href="https://www.npmjs.com/package/homebridge-advanced-timer">
      <img src="https://flat.badgen.net/npm/dt/homebridge-advanced-timer" alt="Total NPM Downloads" />
    </a>
    <a href="https://github.com/homebridge/homebridge/wiki/Verified-Plugins">
      <img src="https://flat.badgen.net/badge/homebridge/verified/purple" alt="Verified by Homebridge" />
    </a>
    <br>
    <strong><a href="#2-configure">Setup Guide</a> | <a href="#3-how-to-contribute">Contribute</a> </strong>
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

### trigger mode

<p align="center">
  <img src="https://raw.githubusercontent.com/elfive/homebridge-advanced-timer/master/images/trigger_mode.jpg" alt="screenshot" />
</p>

*note: trigger plan(intervals): 2,6* 



  ### config.json field

|        field   name        |  type  | required |     default     |    range    | description                                                  |
| :------------------------: | :----: | :------: | :-------------: | :---------: | ------------------------------------------------------------ |
| accessory | string | yes | 'advanced_timer' | 'advanced_timer' | MUST BE 'advanced_timer' |
|            name            | string |   yes    | 'AdvancedTimer' |     ---     | device name shows in HomeKit. we don't need it, but homebridge need it. |
|         intervals          | string |   yes    |       ---       |     ---     | Comma-separated trigger plan, every interval(in second), if pulse trigger mode is selected, all interval value should longer than trigger_duration below. |
|           repeat           |  int   |   no  |       0        | 0 to 86400 | How many trigger plan cycles repeat, 0 for infinite loop.   |
|        enable_name         | string |    no    |    'Enable'     |     ---     | Timer enable switch name shows in HomeKit                    |
|        trigger_name        | string |    no    |    'Trigger'    |     ---     | Timer trigger indicator name shows in HomeKit.               |
| trigger_type | int | no | 1 | 0, 1 | like electronic, trigger type has two different type:<br/>0: Pulse<br/>1: TTL |
| pulse_trigger_duration | int | no | 3 | 1 to 3 | Each time a trigger signal last duration, in second,<br/>only works in Pulse trigger type |
| start_delay<br/>(unit: second) | int | no | 0 | 0 to 86400 | After timer enable status set to enable, delay before trigger plan starts, only works in TTL trigger type. |
| stop_delay<br/>(unit: second) | int | no | 0 | 0 to 86400 | Delay after trigger plan stops or after timer enable status set to disable, only works in TTL trigger type. |
| enable_status_when_start | int | no | 2 | 0, 1, 2 | Enable status after Homebridge start.<br/>0: OFF,<br/>1: ON,<br/>2: Last Status. |
| trigger_status_when_start | int | no | 2 | 0, 1, 2 | Enable status after Homebridge start.<br/>0: OFF,<br/>1: ON,<br/>2: Last Status. |
| trigger_status_while_enabled | int | no | 0 | 0, 1, 2 | Trigger status while service enabled.<br/>0: Not Triggered,<br/>1: Triggered,<br/>2: Last Status. |
| trigger_status_while_disabled | int | no | 0 | 0, 1, 2 | Trigger status while service disabled.<br/>0: Not Triggered,<br/>1: Triggered,<br/>2: Last Status. |



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
          "enabled_status_after_restart": 2,
          "trigger_duration": 3,
          "accessory": "advanced_timer"
      }
  ]
  ```



  ## 3) How to contribute

  everyone is welcome to contribute to this plugin. PR/issue/debug all are welcome.

  or you can send me an e-mail: elfive@elfive.cn
