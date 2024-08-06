import express, { Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import moment from 'moment';
var router = express.Router();

class SensorDataClass {
    _waterTemperature: number = 0;
    _waterMessage: string = 'Water temperature could not be read';
    _roomTemperature: number = 0;
    _roomMessage: string = 'Room temperature could not be read';
    _leakPresent: boolean = false;
    _leakMessage: string = 'Leak sensor could not be read';
    ozoneStatus: string = 'Ozone status could not be read';
    ozoneStart: string = '';
    ozoneEnd: string = '';
    ozoneTimeLeft: string = '';
    pumpStatus: string = 'Pump status could not be read';

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
            pumpStatus: this.pumpStatus,
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

interface PumpStatus {
    pump_on: boolean;
}

interface PlungeResponse {
    message: string;
    id?: string;
    start_time?: Date;
    start_room_temp?: string;
    start_water_temp?: string;
    end_time?: Date;
    end_water_temp?: string;
    end_room_temp?: string;
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
            sensorData.ozoneStart = sensorData.ozoneStart = moment(
                ozoneStatus.start_time,
            ).format('YYYY-MM-DD h:mm:ssa');
            sensorData.ozoneEnd = moment(ozoneStatus.end_time).format(
                'YYYY-MM-DD h:mm:ssa',
            );
            sensorData.ozoneTimeLeft = formatSecondsToHHMMSS(
                ozoneStatus.seconds_left,
            );
        }

        const pumpStatus = await readPumpStatus();
        if (pumpStatus) {
            sensorData.pumpStatus = pumpStatus.pump_on ? 'Running' : 'Stopped';
        } else {
            sensorData.pumpStatus = 'Pump status could not be read';
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
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
});

router.post('/plunge/start', async function (req: Request, res: Response) {
    let plungeResponse: PlungeResponse = {
        message: 'unable to start plunge timer',
    };
    try {
        const response = await axios.post('http://10.0.10.240:8080/v1/plunges');
        plungeResponse = response.data as PlungeResponse;
        plungeResponse.message = 'Started';
    } catch (error) {
        if (axios.isAxiosError(error)) {
            plungeResponse.message = error.response?.data;

            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
    console.log(plungeResponse);
    res.json(plungeResponse);
});

router.put('/plunge/stop', async function (req: Request, res: Response) {
    let plungeResponse: PlungeResponse = {
        message: 'unable to stop plunge timer',
    };
    try {
        // Look for a currently running plunge
        let response = await axios.get(
            'http://10.0.10.240:8080/v1/plunges?filter=current',
        );

        const plungeResponses = response.data as PlungeResponse[];
        if (plungeResponses.length == 0) {
            // TODO: error
        }

        plungeResponse = plungeResponses[0];

        // update the current plunge to stop it
        response = await axios.put(
            `http://10.0.10.240:8080/v1/plunges/${plungeResponse.id}`,
        );
        plungeResponse = response.data as PlungeResponse;
        plungeResponse.message = 'Stopped';
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response && error.response.status == 404) {
                plungeResponse = {
                    message: error.response?.data,
                };
            }

            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
    res.json(plungeResponse);
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
        const response = await axios.get(`http://10.0.10.240:8080/v1/ozone`);

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

async function readPumpStatus() {
    try {
        const response = await axios.get(`http://10.0.10.240:8080/v1/pump`);

        const pumpResult: PumpStatus = response.data;
        return pumpResult;
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

export default router;
