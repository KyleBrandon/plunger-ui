import express, { Request, Response } from 'express';
import axios, { AxiosError, AxiosResponse } from 'axios';
var router = express.Router();

interface PumpStatus {
    pump_on: boolean;
}

interface PlungeResponse {
    id?: string;
    running?: boolean;
    expected_duration?: number;
    remaining_time?: number;
    elapsed_time?: number;
    room_temp?: string;
    water_temp?: string;
    average_water_temp?: string;
    average_room_temp?: string;
}

router.post('/change-filter', async function (req: Request, res: Response) {
    const { date } = req.body;
    const filterDate = new Date(date);
    let d = new Date(date);
    const remindDate = new Date(d.setDate(d.getDate() + 14));

    const data = {
        changed_at: filterDate,
        remind_at: remindDate,
    };
    console.log(data);
    try {
        await axios.post('http://10.0.10.240:8080/v2/filters/change', data);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
});

router.get('/pump', async function (req: Request, res: Response) {
    let pumpStatus = await readPumpStatus();
    res.json(pumpStatus);
});

router.post('/pump', async function (req: Request, res: Response) {
    try {
        let pumpStatus = await readPumpStatus();

        if (pumpStatus && pumpStatus.pump_on) {
            await axios.post('http://10.0.10.240:8080/v1/pump/stop');
        } else {
            await axios.post('http://10.0.10.240:8080/v1/pump/start');
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
});

router.get('/plunge', async function (req: Request, res: Response) {
    let status = await readPlungeStatus();
    res.json(status);
});

router.post('/plunge', async function (req: Request, res: Response) {
    let plungeStatus: PlungeResponse = {};
    try {
        plungeStatus = await readPlungeStatus();
        let response: AxiosResponse;
        if (plungeStatus.running) {
            response = await axios.put(
                `http://10.0.10.240:8080/v2/plunges/stop`,
            );
        } else {
            response = await axios.post(
                'http://10.0.10.240:8080/v2/plunges/start',
            );
        }

        plungeStatus = response.data as PlungeResponse;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
    res.json(plungeStatus);
});

async function readPlungeStatus() {
    let plungeResponse: PlungeResponse = {};
    try {
        const response = await axios.get(
            'http://10.0.10.240:8080/v2/plunges/status',
        );
        plungeResponse = response.data as PlungeResponse;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }

    return plungeResponse;
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

export default router;
