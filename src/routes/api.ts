import express, { Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
var router = express.Router();

class SensorDataClass {
    _waterTemperature: number = 0;
    _waterMessage: string = 'water temperature could not be read';
    _roomTemperature: number = 0;
    _roomMessage: string = 'room temperature could not be read';
    _leakPresent: boolean = false;
    _leakMessage: string = 'leak sensor not read';

    get waterTemperature() {
        return this._waterTemperature;
    }

    set waterTemperature(value: number) {
        this._waterTemperature = value;
        this._waterMessage = '';
    }

    get waterMessage() {
        return this._waterMessage;
    }

    get roomTemperature() {
        return this._roomTemperature;
    }

    set roomTemperature(value: number) {
        this._roomTemperature = value;
        this._roomMessage = '';
    }

    get roomMessage() {
        return this._roomMessage;
    }

    get leakPresent() {
        return this._leakPresent;
    }

    set leakPresent(value: boolean) {
        this._leakPresent = value;
        this._leakMessage = '';
    }

    get leakMessage() {
        return this._leakMessage;
    }

    toJSON() {
        return {
            waterTemperature: this.waterTemperature,
            waterMessage: this.waterMessage,
            roomTemperature: this.roomTemperature,
            roomMessage: this.roomMessage,
            leakPresent: this.leakPresent,
            leakMessage: this.leakMessage,
        };
    }
}

interface TemperatureReading {
    name: string;
    description: string;
    address: string;
    temperature_c: number;
    temperature_f: number;
}

interface LeakReading {
    updated_at: Date;
    leak_detected: boolean;
}

router.get('/sensors', async function (req: Request, res: Response) {
    const sensorData = new SensorDataClass();
    try {
        const temperatures = await readTemperatures();

        temperatures.forEach((temp: TemperatureReading) => {
            if (temp.name == 'Room') {
                sensorData.roomTemperature = temp.temperature_f;
            } else if (temp.name == 'Water') {
                sensorData.waterTemperature = temp.temperature_f;
            }
        });

        const leaks = await readLatestLeak();
        if (leaks.length == 1) {
            sensorData.leakPresent = leaks[0].leak_detected;
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    }

    res.json(sensorData.toJSON());
});

async function readTemperatures() {
    let temperatures: TemperatureReading[] = [];
    try {
        const tempResponse = await axios.get(
            `http://10.0.10.240:8080/v1/temperatures`,
        );

        temperatures = tempResponse.data as TemperatureReading[];
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
    return temperatures;
}

async function readLatestLeak() {
    let leakReadings: LeakReading[] = [];
    try {
        const leakResponse = await axios.get(
            `http://10.0.10.240:8080/v1/leaks?filter=current`,
        );

        leakReadings = leakResponse.data as LeakReading[];
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
    return leakReadings;
}

function handleRequestError(error: AxiosError) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    if (error.response) {
        console.error(
            `Error received '${error.response.status}': ${error.response.data}`,
        );
    } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        const httpRequest: XMLHttpRequest = error.request;
        console.error(
            `Error received '${httpRequest.statusText}': ${httpRequest.responseText}`,
        );
    } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error Message:', error.message);
    }
}

export default router;
