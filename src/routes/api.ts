import express, { Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import moment from 'moment';
var router = express.Router();

class SensorDataClass {
    _waterTemperature: number = 0;
    _waterMessage: string = 'water temperature could not be read';
    _roomTemperature: number = 0;
    _roomMessage: string = 'room temperature could not be read';
    _leakPresent: boolean = false;
    _leakMessage: string = 'leak sensor not read';
    ozoneStatus: string = 'ozone not read';
    ozoneStart: string = '';
    ozoneEnd: string = '';
    ozoneTimeLeft: string = '';

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
            ozoneStatus: this.ozoneStatus,
            ozoneStart: this.ozoneStart,
            ozoneEnd: this.ozoneEnd,
            ozoneTimeLeft: this.ozoneTimeLeft,
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

interface OzoneStatus {
    status: string;
    start_time: Date;
    end_time: Date;
    result: string;
    seconds_left: number;
    cancel_requested: boolean;
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

        const ozoneStatus = await readOzoneStatus();
        if (ozoneStatus) {
            sensorData.ozoneStatus = ozoneStatus.status;
            sensorData.ozoneStart = moment(ozoneStatus.start_time).format(
                'YYYY-MM-DD HH:mm:ss',
            );
            sensorData.ozoneEnd = moment(ozoneStatus.end_time).format(
                'YYYY-MM-DD HH:mm:ss',
            );
            sensorData.ozoneTimeLeft = formatSecondsToHHMMSS(
                ozoneStatus.seconds_left,
            );
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    }

    res.json(sensorData.toJSON());
});

router.post('/ozone', async function (req: Request, res: Response) {
    try {
        let ozoneStatus = await readOzoneStatus();

        if (ozoneStatus && ozoneStatus.status == 'Running') {
            await axios.post('http://10.0.10.240:8080/v1/ozone/stop');
        } else {
            await axios.post('http://10.0.10.240:8080/v1/ozone/start');
        }
    } catch (error) {}
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

async function readOzoneStatus() {
    try {
        const response = await axios.get(
            `http://10.0.10.240:8080/v1/ozone/status`,
        );

        const ozoneResult: OzoneStatus = response.data;
        return ozoneResult;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
    return null;
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

function formatSecondsToHHMMSS(totalSeconds: number) {
    // Calculate hours, minutes, and seconds
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = (totalSeconds % 60).toFixed(0);

    // Format the values to two digits
    const formattedHours = String(hours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    // Combine into HH:MM:SS format
    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

const TIME_LOCALE_OPTIONS = {
    // timeZone: 'America/New_York', // Specify your local time zone, if needed
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true, // Use 12-hour format, set to false for 24-hour format
};

export default router;
