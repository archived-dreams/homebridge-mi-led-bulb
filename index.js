const chroma = require("chroma-js");
const execSync = require('child_process').execSync;
const { hsvToRgb } = require('homebridge-lib').Colour

const RATE_LIMIT = 500

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-mi-led-bulb", "mi-led-bulb", MiLedBulb);
};

function MiLedBulb (log, config) {
    this.log = log;
    this.name = config['name'] || 'MI Led Bulb';
    this.ip = config['ip'];
    this.token = config['token'];

    this.on = false
    this.rainbow = false
    this.hue = 360
    this.saturation = 0
    this.brightness = 100
    this.temperature = 0

    this.getColorFromDevice();
}

MiLedBulb.prototype.getServices = function() {
    let informationService = new Service.AccessoryInformation();

    const info = this.sendCommand('info')

    informationService
        .setCharacteristic(Characteristic.Manufacturer, 'Xiaomi')
        .setCharacteristic(Characteristic.Model, String(/Model: (.*)/.exec(info)[1]).trim())
        .setCharacteristic(Characteristic.SerialNumber, this.ip);

    let lightbulbService = new Service.Lightbulb(this.name);

    lightbulbService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));

    lightbulbService
        .addCharacteristic(new Characteristic.Hue())
        .on('get', this.getHue.bind(this))
        .on('set', this.setHue.bind(this));

    lightbulbService
        .addCharacteristic(new Characteristic.Saturation())
        .on('get', this.getSaturation.bind(this))
        .on('set', this.setSaturation.bind(this));

    lightbulbService
        .addCharacteristic(new Characteristic.Brightness())
        .on('get', this.getBrightness.bind(this))
        .on('set', this.setBrightness.bind(this));

    lightbulbService
        .addCharacteristic(new Characteristic.ColorTemperature())
        .on('get', this.getTemperature.bind(this))
        .on('set', this.setTemperature.bind(this));

    // Rainbow mode
    const rainbowService = new Service.Switch(this.name + ' Rainbow');

    rainbowService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getRainbow.bind(this))
        .on('set', this.setRainbow.bind(this));

    return [informationService, lightbulbService, rainbowService];
}

MiLedBulb.prototype.sendCommand = function(command, callback) {
    const cmd = `miiocli yeelight --ip ${this.ip} --token ${this.token} ${command}`
    const result = execSync(cmd)
    if (callback) { callback(result.toString()) }
    return result.toString()
};

MiLedBulb.prototype.getColorFromDevice = function() {
    this.getState((settings) => {
        this.on = settings.on
        this.hue = settings.hue
        this.saturation = settings.saturation
        this.brightness = settings.brightness
        this.temperature = settings.temperature

        this.log("Device state: ", settings);

    })
};


let lastStateCall = 0;
MiLedBulb.prototype.getState = function (callback) {
    if (lastStateCall + RATE_LIMIT >= Date.now()) {
        callback(this)
        return
    }

    lastStateCall = Date.now()
    this.sendCommand('status', (stdout) => {
        const settings = {
            on: false,
            rainbow: false,
            hue: 360,
            saturation:  0,
            brightness: 100,
            temperature: 0,
        };

        // Turned on
        if (stdout.includes('Power: True')) {
            settings.on = true;
        }

        // Rainbow
        if (stdout.includes('Color flowing mode: True')) {
            settings.rainbow = true
        }

        // Temperature
        if (/Temperature: (\d+)/s.test(stdout)) {
            this.temperature = Number(/Temperature: (\d+)/.exec(stdout)[1]) || 0
        }

        // Brightness
        if (/Brightness: (\d+)/.test(stdout)) {
            settings.brightness = Number(/Brightness: (\d+)/.exec(stdout)[1]);
        }

        // Color
        if (/RGB: (\(\d+, \d+, \d+\))/s.test(stdout)) {
            const color = chroma(`rgb${/RGB: (\(\d+, \d+, \d+\))/s.exec(stdout)[1]}`)
            settings.hue = color.get('hsl.h') || 0
            settings.saturation = color.get('hsl.s')
        }

        callback(settings);
    });
};



MiLedBulb.prototype.getPowerState = function(callback) {
    this.getState((settings) => {
        this.log('getPowerState', settings.on)
        callback(null, settings.on);
    });
};

MiLedBulb.prototype.setPowerState = function(value, callback) {
    this.log('setPowerState', value ? 'on' : 'off')
    this.sendCommand(value ? 'on' : 'off', () => callback());
};



MiLedBulb.prototype.getHue = function(callback) {
    this.getState((settings) => {
        this.log('getHue', settings.hue)
        callback(null, Math.round(settings.hue || 0));
    });
};

MiLedBulb.prototype.setHue = function(value, callback) {
    try {
        this.hue = Number(value || 0);
        this.log('setHue', value, this.hue, this.saturation)
        const { r, g, b } = hsvToRgb(this.hue, this.saturation)
        this.sendCommand(`set_rgb ${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}`, () => callback());
    } catch (e) {
        console.warn('setHue', e)
        callback()
    }
};




MiLedBulb.prototype.getBrightness = function(callback) {
    this.getState((settings) => {
        this.log('getBrightness', settings.brightness)
        callback(null, settings.brightness);
    });
};

MiLedBulb.prototype.setBrightness = function(value, callback) {
    this.brightness = Number(value || 0);
    this.log('setBrightness', value)
    this.sendCommand(`set_brightness ${this.brightness}`, () => callback());
};




MiLedBulb.prototype.getSaturation = function(callback) {
    this.getState((settings) => {
        this.log('getSaturation', settings.saturation)
        callback(null, settings.saturation);
    });
};

MiLedBulb.prototype.setSaturation = function(value, callback) {
    try {
        this.saturation = Number(value || 0);
        this.log('setSaturation', value, this.hue, this.saturation)
        const { r, g, b } = hsvToRgb(this.hue, this.saturation)
        this.sendCommand(`set_rgb ${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}`, () => callback());
    } catch (e) {
        this.log.warn('setSaturation', e)
        callback()
    }
};




MiLedBulb.prototype.getTemperature = function(callback) {
    this.getState((settings) => {
        this.log('getTemperature', settings.temperature)

        let temperature = Math.round((640 - settings.temperature) / 10)
        if (temperature < 140) {
            temperature = 140
        } else if (temperature > 500) {
            temperature = 500
        }
        callback(null, temperature);
    });
};

MiLedBulb.prototype.setTemperature = function(value, callback) {
    try {
        let temperature = (640 - Number(value)) * 10
        if (temperature < 1700) {
            temperature = 1700;
        } else if (temperature > 6500) {
            temperature = 6500;
        }
        this.temperature = temperature
        this.log('setTemperature', temperature, value)
        this.sendCommand(`set_color_temp ${this.temperature}`, () => callback());
    } catch (e) {
        this.warn('setTemperature', e)
    }
};


MiLedBulb.prototype.getRainbow = function(callback) {
    this.getState((settings) => {
        this.log('getRainbow', settings.rainbow)
        callback(null, settings.rainbow);
    });
};

MiLedBulb.prototype.setRainbow = function(value, callback) {
    this.log('setRainbow', value)
    this.rainbow = value
    if (this.rainbow) {
        this.sendCommand(`raw_command set_scene '["cf", 0, 0, "1000,1,1047627,80,2000,1,1032444,100,1000,1,16519104,80,2000,1,16711696,100,2000,1,1047746,40"]'`, () => callback());
    } else {
        // this.sendCommand(`raw_command set_scene '["color", 16777215, 100]'`, () => callback());
        this.setTemperature(0, callback)
    }
    // https://python-miio.readthedocs.io/en/latest/_modules/miio/yeelight.html#Yeelight.set_scene
    // https://www.yeelight.com/download/Yeelight_Inter-Operation_Spec.pdf
    // https://github.com/sahilchaddha/homebridge-yeelight-platform/blob/781e2c160e8cb6c00b103402664385435cc6e7c6/src/flows.js
};

